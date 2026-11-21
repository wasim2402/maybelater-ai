# MaybeLater — Smart Resurfacing (Stage 10)

**Resurfacing** shows saved items inside the app when they're worth another look. It never sends anything: notifications are **reminders** (stage 11), a separate and explicit choice.

## The rules engine (`backend/app/services/resurfacing.py`)

`evaluate(items, preferences, timezone, now)` is a **pure function**: no database, no clock and no randomness. The same inputs always give the same ranked list, and it never uses AI.

| Signal (rank) | Fires when | Leaves when |
|---|---|---|
| **date** (1) | A day the user chose ("Bring it back") has arrived | The item is opened, snoozed, dismissed, completed or archived |
| **snooze** (2) | A snooze the user set has ended | The same |
| **condition** (3) | A condition the **user confirmed** (kept or wrote) matches now in their time zone: weekend, weekday, evening (18–23), morning (6–12) or lunch (11–14) | Dismissed (quiet for 30 days), or once the frequency cooldown applies |
| **stale** (4, off by default) | Not looked at for N days (14, 30 or 90, chosen in Settings) | The same |

Further rules:
- **Never:** completed or archived items, or items still snoozed.
- **AI never decides eligibility.** An AI-suggested condition (`field_states.resurface_condition = "suggested"`) does nothing until the user keeps or edits it. Unknown phrases ("before the March trip") stay as a note and never trigger.
- **Dates and snoozes** are the user's own instructions, so they apply even with suggestions switched off.
- **Not now (dismiss)** removes the item from the list. Conditions and staleness stay quiet for 30 days, and a date chosen later still brings it back.
- **Frequency:** daily, a few times a week or weekly sets the cooldown before the same condition or stale item can return (1, 2 or 7 days). Seeing it again on the same local day is fine.
- **Ranking:** by signal rank, then oldest due first, then id, so the order is stable. If a date and an ended snooze both apply, the most recent instruction explains it. At most 20 results.
- **Reasons** are plain sentences: "You asked to see this again today.", "Your snooze ended yesterday.", "You saved this for 'this weekend', and it's the weekend.", "You haven't looked at this in 40 days."

## Time zones

- Everything is evaluated in the user's IANA time zone (Settings). For example, Sunday 23:30 UTC is already Monday in Berlin, so "this weekend" no longer matches there, while it still does in New York.
- **Presets are wall-clock times in that zone, resolved on the server:** tomorrow 09:00; this weekend Saturday 10:00 (next week's if that has passed); next week Monday 09:00; in a month 09:00. Daylight-saving changes are handled by `zoneinfo`: "9 am tomorrow" stays 9 am local across the change, as the tests check for Berlin and New York.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/recommendations` | `{items: [{item, signal, reason, next_action, due_at}], generated_at}`. Records what was shown: `last_resurfaced_at`, and one `resurfaced` activity per item per local day. |
| POST | `/api/v1/intentions/{id}/snooze` | `{preset}` or `{at}` (with an offset; in the future; within a year) |
| DELETE | `/api/v1/intentions/{id}/snooze` | End a snooze |
| POST | `/api/v1/intentions/{id}/dismiss` | Not now |
| POST | `/api/v1/intentions/{id}/resurface` | `{preset}`, `{at}` or `{clear: true}`. Setting a date also ends a snooze. |
| POST | `/api/v1/intentions/{id}/viewed` | The item was opened. Returns 204. |

Notes:
- Every endpoint is scoped to the signed-in user; another user's item returns 404.
- Showing and opening are **not edits**: `last_resurfaced_at` and `last_viewed_at` are written without moving `updated_at`.
- Tests replace the server clock through `app.state.clock`.

## Web app

- **Resurfaced** is in the navigation, with a count of items waiting. Each card shows the reason, the item, its category and site, and four actions: **Open**, **Snooze** (tomorrow morning, this weekend, next week or in a month), **Not now** and **Done** (with undo). The empty state explains how to make things come back.
- **Item page, "Bring it back":** choose a day from the presets or pick a date and time, see when it will return, clear it, or end a snooze. Opening the item marks it as looked at.
- **Inbox rows** show "Back Sat 21 Nov" or "Snoozed until …".
- **Settings, Resurfacing:** a "Suggest items to look at again" switch, how often the same item can come back, and an optional "Bring back items I haven't looked at". It explains that chosen days and snoozes always apply.
- Time labels use a minute-stable clock (`useNow`), so renders stay pure, and the list refreshes every 5 minutes and on window focus.

## Tests

| Layer | File | Covers |
|---|---|---|
| Engine (pure) | `backend/tests/test_resurfacing_engine.py` (30) | Dates arriving; snoozes never early; completed and archived excluded; opening and dismissing clear, while a new date brings back; dates and snoozes work with suggestions off; the condition vocabulary; only confirmed conditions trigger; **weekend boundaries per time zone**; the **evening condition across a DST change**; 30-day dismissal suppression; frequency cooldown with same-day repeats allowed; stale off by default; transparent, order-independent ranking; cap; naive "now" rejected; presets in the user's zone, including Saturday-afternoon and Monday edge cases and **"tomorrow 9 am" across DST in Berlin and New York**; the snooze-vs-date explanation |
| API | `backend/tests/test_resurfacing_api.py` (18) | Presets in the user's zone; a chosen date arriving; open, snooze and dismiss clear it; a snooze returning; never early; completed and archived excluded; **no cross-user items, and 404s on others' items**; confirmed conditions on a Saturday; suggestions switch and stale preference; shown once per day; showing and opening don't change `updated_at`; invalid times (past, over a year, no offset, both or neither, unknown preset) return 422; clearing; a new date ends a snooze |
| End to end | `frontend/e2e/resurfacing.spec.ts` | With the real clock: choose a time two minutes ahead for two items, wait, both appear with the reason and the nav count; snooze one away; open the other and it leaves; resurfacing settings persist. Needs the current backend on port 8000. |
