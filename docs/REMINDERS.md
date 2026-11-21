# MaybeLater — Reminders (Stage 11)

A **reminder** is a time the user chose for one saved item. When that time comes, the server delivers it and it shows up under **Reminders** in the app, even if no browser tab is open. Reminders are separate from **resurfacing** (stage 10): resurfacing suggests items inside the app, while a reminder is an explicit "tell me at this time".

## Consent

- **A reminder exists only because the user confirmed it.** The picker first states the exact time and clock ("You'll be reminded on Saturday 21 November at 10:00 (Europe/Berlin)"). Choosing a preset or a day schedules nothing; only **Set reminder** does.
- **The API makes the choice explicit:** `POST /reminders` requires `confirm`. With `confirm: false` the result is a **draft**, which the worker never delivers.
- **The database enforces it:** `ck_reminders_approved_before_scheduling` refuses a scheduled, snoozed or sent reminder without `approved_at`.
- **AI cannot create reminders.** No agent has a reminder tool (a test in `test_agents.py` checks this). An AI-suggested "when" is only `resurface_condition` text.
- **Only in-app delivery exists.** Email, web push and mobile push are not built, and will not be until consent, unsubscribe, retry and failure handling are designed for them.

## Lifecycle

```
draft ──confirm──▶ scheduled ──(worker, when due)──▶ sent ──complete──▶ done (completed_at)
  │                  │   ▲                            │
  │                  │   └──────── reschedule ────────┤
  │                  └── snooze ──▶ snoozed ──(worker)┘
  └──── cancel ──────┴──── cancel ───┴──▶ cancelled (final)
```

| Action | Allowed from | Result |
|---|---|---|
| Create (`confirm: true`) | — | `scheduled`, `approved_at = now`. Records a `reminder_created` activity. |
| Create (`confirm: false`) | — | `draft` |
| `confirm` | draft | `scheduled`, but only if the time is still in the future |
| `reschedule` | draft, scheduled, snoozed, sent | A draft gets the new time and stays a draft. Otherwise the reminder is `scheduled` at the new time as a new version. |
| `snooze` | scheduled, snoozed, sent | `snoozed` until the chosen time, as a new version |
| `complete` | scheduled, snoozed, sent | Sets `completed_at`. A reminder that hadn't come due yet is also `cancelled`, so it won't arrive. |
| Cancel (`DELETE`) | draft, scheduled, snoozed | `cancelled`, which is final. Cancelling twice does no harm. A reminder that was already delivered must be completed instead (409). |

Further rules:
- **One open reminder per item** (draft, scheduled or snoozed), enforced by the partial unique index `uq_reminders_one_open_per_intention`. A second one returns 409 `reminder_exists`.
- **Deleting an item** deletes its reminders and their delivery records (database cascade).

## Time and time zones

- Each reminder stores a **UTC instant** (`scheduled_at`) and the **IANA zone the user picked the time in** (`timezone`). The API also returns `local_time` (for example `2026-11-21T10:00`), the time as it reads on that clock.
- **The web app sends wall-clock times:** `{local: "2026-11-21T10:00", timezone}`, where the zone comes from the user's Settings. The server converts this to an instant, so the result is correct even when the browser is in a different zone.
- **Daylight saving:**
  - A time skipped by spring-forward (for example 02:30 on that night) is refused with `time_does_not_exist`; it is never silently moved.
  - A time that happens twice at fall-back takes the first occurrence.
  - "9:00 tomorrow" stays 9:00 on the local clock across the change.
- **Presets** are resolved on the server: `in_an_hour`, `this_evening` (19:00, only while still ahead), `tomorrow` 09:00, `weekend` Saturday 10:00, and `next_week` Monday 09:00.
- **Allowed range:** after now and within one year; otherwise the response is 422 `invalid_reminder_time`.

## Scheduling and delivery (`app/services/reminder_delivery.py`)

**The scheduler is PostgreSQL itself, not Redis with ARQ.** A worker loop runs every `REMINDER_WORKER_INTERVAL_SECONDS` (20 by default) and claims due reminders with `SELECT … FOR UPDATE SKIP LOCKED`. Why not Redis:
- The only channel is in-app, so delivering means updating a database row.
- A Postgres queue keeps that update and the delivery record in one transaction.
- It needs no new infrastructure.

Redis with ARQ is still an option once external channels exist (stage 14).

- **Where it runs:** inside the API process by default (`REMINDER_WORKER_ENABLED=true`). When the API runs as several processes, turn that off and run one `python -m app.worker`. Running both at once is also safe.
- **Exactly once per version:**
  - Each change of time (reschedule or snooze) increments `schedule_version`.
  - Before a channel is called, a `reminder_deliveries` row is written. It is unique on `(reminder_id, schedule_version)` and carries an `idempotency_key` (`reminder:<id>:v<version>`) that external providers will receive.
  - If two workers run at the same time, the second skips the locked rows.
  - If a delivery row already says `delivered` (for example after a crash between sending and marking the reminder), the worker only marks the reminder `sent` and never sends again.
- **Retries:**
  - A retryable failure backs off for 1, 5, 15 and then 60 minutes.
  - After 5 attempts, or after a permanent error, the delivery is `failed` and is not retried.
  - Only short error codes are stored (`last_error_code`), never message content.
- **Paused delivery:** if the user turned reminders off, due reminders stay due. They are delivered on the first pass after reminders are turned back on.
- **Quiet hours:** these are local start and end times on the user's current clock, and may wrap past midnight (for example 22:00 to 07:00). A reminder due in quiet hours is delivered on the first pass after they end.
- **On delivery:** the reminder becomes `sent` and a `reminder_sent` activity is recorded.
- **What the web app does:** it polls `GET /reminders?state=due` every minute and when the window regains focus. It shows a count in the navigation, and a toast when something new comes due while it is open.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/reminders?state=due\|upcoming\|history\|all&intention_id=` | `{items: [ReminderOut with item], delivery_paused}`. `due` is delivered and not completed; `upcoming` is draft, scheduled or snoozed; `history` is completed or cancelled. |
| POST | `/api/v1/reminders` | `{intention_id, confirm, preset \| at \| local, timezone?}`. Exactly one time field is allowed. `at` needs an offset and `local` must not have one. Returns 201. |
| PATCH | `/api/v1/reminders/{id}` | `{action: "confirm" \| "complete"}`, or `{action: "reschedule" \| "snooze", preset \| at \| local, timezone?}` |
| DELETE | `/api/v1/reminders/{id}` | Cancels. Returns the reminder. |

All reminders are owned by a user. Another user's reminder or item returns 404.

## Web app

- **Item page, "Reminder" panel:**
  - With no reminder: **Set a reminder** opens the picker (quick choices, a day and time, and a sentence stating the exact time), then **Set reminder**.
  - Waiting: shows when it will arrive, with **Change**, **Later** (snooze) and **Cancel reminder**.
  - Due: **Done**, **Snooze** and **Pick another time**.
- **Reminders page** (in the navigation, with the due count):
  - **Due now**: Open, Snooze and Done.
  - **Coming up**: each reminder can be cancelled.
  - A note appears when reminders are turned off.
- **Settings, Reminders:** **Show my reminders** (on or off) and **Quiet hours** (from and until). The section states that nothing is emailed or pushed yet.
- **Resurfaced** now uses its own icon (Repeat2); the bell belongs to Reminders.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `REMINDER_WORKER_ENABLED` | `true` | Run the delivery loop inside the API process |
| `REMINDER_WORKER_INTERVAL_SECONDS` | `20` | Time between passes (1 to 300) |

## Tests

| Layer | File | Covers |
|---|---|---|
| Time rules (pure) | `backend/tests/test_reminders_time.py` (19) | Wall-clock times per zone; the same local hour either side of a DST change (Berlin and New York); times skipped by spring-forward refused; repeated fall-back times take the first occurrence; "tomorrow 9:00" across the DST night; presets per zone; "this evening" refused after 19:00; past, now and over-a-year times refused; quiet hours, including wrap past midnight, equal start and end, and the local clock across DST |
| API and worker | `backend/tests/test_reminders_api.py` (33) | Scheduling in the user's zone or a chosen zone; confirmation required; drafts never delivered; an expired draft can't be confirmed; invalid times; one open reminder per item; presets; **ownership**; delivered **once** when due and never early; complete; completing a waiting reminder calls it off; **cancelled reminders never delivered** (and cancel is final); a delivered reminder can't be cancelled; snooze is a new version, delivered again; reschedule moves the time and keeps approval; malformed actions; item deletion cascades; **two workers at once deliver each reminder once**; **retries back off and never send twice** (same idempotency key); a permanent failure stops; **a delivery recorded before a crash is not resent**; paused delivery resumes; **quiet hours hold delivery until 07:00 local**; one user's preferences don't affect another's |
| Unit (web) | `frontend/src/features/reminders/reminders.test.tsx` (5) | Wall-clock reading per zone and across DST; the zone label; the picker states the exact time and calls `onConfirm` only on the button, with `{local, timezone}`; "this evening" offered only while still ahead |
| End to end | `frontend/e2e/reminders.spec.ts` | With the real clock: set a reminder two minutes ahead, see it under Coming up, leave the page, and the server delivers it; it appears under Due now with the nav count; mark it done; set a preset reminder and cancel it; quiet hours persist. Needs a backend running stage 11 code. |
