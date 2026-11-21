# MaybeLater — Reminder Notifications (Web Push and Chime)

When a reminder comes due, the user can get a **system notification with sound**, even when MaybeLater is closed. This is Web Push, built on top of reminder delivery (`docs/REMINDERS.md`):
- **App closed or in the background:** the device shows a notification and plays its own notification sound.
- **App open and focused:** MaybeLater shows a toast and plays a soft **chime**.

## Consent and control

| Requirement | How |
|---|---|
| Opt in per device | Settings, Notifications, **Turn on notifications**. The browser's permission prompt appears; only after it is allowed is the device subscribed. Nothing asks for permission on its own. |
| Easy to turn off | **Turn off on this device**; remove any listed device; or block notifications in the browser |
| Signing out | Signing out unsubscribes this browser, so a shared computer stops getting the account's reminders |
| Deleting the account | All push subscriptions are removed (database cascade) |
| Pausing and quiet hours | "Show my reminders" off and quiet hours hold pushes exactly like in-app delivery |
| Sound | The in-app chime can be switched off ("Play a chime in the app", stored in `preferences.reminders.sound`). The notification sound for a closed app is the device's own, controlled by its system settings. |
| Not created by AI | Only reminders the user confirmed are delivered and pushed (`docs/REMINDERS.md`, Consent) |

## How it works

```
reminder due ──worker──▶ in-app delivery (status sent) ──same transaction──▶ queue web_push delivery
                                                                               │
worker pass ──▶ send_pending_pushes ──VAPID + aes128gcm──▶ push service (FCM / Mozilla / Apple)
                                                                               │
browser ──▶ service worker (public/sw.js) ──▶ system notification  or  message to the open app ──▶ toast + chime
```

- **Server:** `app/services/push.py` (sending, subscriptions) and `app/api/routes/notifications.py` (API), using **pywebpush** with VAPID keys (RFC 8292). Payloads are end-to-end encrypted to the browser (RFC 8291), so the push service can't read them.
- **Once per version:**
  - A `web_push` row in `reminder_deliveries` is written in the transaction that delivers the reminder. The row is unique per (reminder, version, channel).
  - Pushes are claimed with `FOR UPDATE SKIP LOCKED`.
  - A delivered row is never sent again.
  - As a further guard, each push carries `Topic` (an undelivered duplicate is replaced at the push service) and `tag` (`reminder-<id>`, so the device replaces rather than stacks).
- **Failures:**

  | Response | What happens |
  |---|---|
  | 2xx | Delivered |
  | 404 or 410 | The subscription is disabled (the user unsubscribed or it expired) |
  | 429, 5xx or network error | Retried after 1, 5, 15 and 60 minutes, up to 5 attempts |
  | Other 4xx | Failed, not retried |

  If the reminder was snoozed, rescheduled or completed in the meantime, the pending push is dropped (`superseded`). Only status codes are stored, never content.
- **Payload:** `{type: "reminder", title: "Reminder", body: <item title, at most 120 characters>, url: "/app/items/<id>", tag, reminder_id}`. The time to live is 4 hours and urgency is high.
- **Allowed endpoints:** the server only sends to known push services (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`) over https on port 443, so a crafted subscription can't make the server call other addresses.

## The browser side

- **`public/sw.js`** caches nothing and never calls the API.
  - **On push:** it tells any open MaybeLater tabs. If one is focused, that tab shows the toast and chime; otherwise the worker shows a system notification (it stays until dismissed).
  - **On click:** it focuses an open tab on the item, or opens one.
  - It is served with `Cache-Control: no-cache` and a strict CSP (`next.config.ts`).
- **The chime** (`features/notifications/chime.ts`) is two soft sine notes generated with the Web Audio API, so there is no audio file. Browsers only allow sound after the user has interacted with the page, so audio unlocks on the first tap or key press.
- **Settings, Notifications** covers each state of this device:
  - Not set up on the server
  - Browser unsupported
  - iPhone or iPad not yet installed to the Home Screen
  - Blocked (with how to unblock)
  - Off ("Turn on notifications")
  - On ("Send a test notification" or "Turn off on this device")

  Below that: the chime switch with **Play sound**, and the list of devices with notifications on.
- **iPhone and iPad:** Web Push works only for sites added to the Home Screen. `app/manifest.ts` makes MaybeLater installable.

## Setup

```powershell
cd backend
.venv\Scripts\python.exe scripts\generate_vapid_keys.py   # writes VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to backend/.env
```

Then restart the API. The status panel shows `Reminders  in-app + push notifications`.

- Without keys, push is reported as unavailable and reminders stay in-app only.
- **Keep the keys:** replacing them invalidates every device's subscription, and the script refuses unless given `--force`.
- `VAPID_SUBJECT` is the contact for push services (default `mailto:notifications@maybelater.example`); set your own for production.

| Variable | Secret | Purpose |
|---|---|---|
| `VAPID_PUBLIC_KEY` | no | Sent to browsers as `applicationServerKey` |
| `VAPID_PRIVATE_KEY` | **yes** | Signs push requests. Server only. |
| `VAPID_SUBJECT` | no | Contact URL for push services |

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/notifications/push` | `{available, public_key, devices: [{id, label, created_at, last_success_at}]}` |
| POST | `/api/v1/notifications/push/subscriptions` | The browser's `PushSubscription.toJSON()` plus `label`. Upserts by endpoint; the same browser signing in as another user moves the subscription. Returns 201. |
| POST | `/api/v1/notifications/push/unsubscribe` | `{endpoint}`. Idempotent, scoped to the user. Returns 204. |
| DELETE | `/api/v1/notifications/push/subscriptions/{id}` | Removes a listed device (the owner only). Returns 204. |
| POST | `/api/v1/notifications/push/test` | A test notification to each device. Limited to 5 per minute. `{sent}`. Returns 503 `push_not_configured` without keys. |

## Tests

| Layer | File | Covers |
|---|---|---|
| Backend | `tests/test_push.py` (30) | Endpoint allow-list (11 cases); status and availability; refused subscriptions (bad host, key lengths, missing keys); upsert and account takeover of a device; unsubscribe (idempotent, owner only); removing a device; test sends; **a due reminder pushed once** with the exact payload, topic and urgency; **two push workers send once**; no push without a device; **cancelled and paused reminders not pushed**; **retries back off and send once**; **410 disables a device while others still receive**; a push for a reminder handled in the meantime is dropped; a rejected push isn't retried; account deletion removes devices |
| Web unit | `src/features/notifications/notifications.test.ts` (5) | Device labels; support detection, including iPhone needing install; the chime plays two notes, and stays silent until audio is unlocked |
| Real-service check | (manual script, run 2026-11-21) | Real Chrome subscribed through `fcm.googleapis.com` via `public/sw.js`; the app's `WebPushSender` sent an encrypted push (**201 Created**); the service worker **received and decrypted** it. Whether Windows displayed the notification can't be read back by automation, but `showNotification` completed without error. |
| End to end | `e2e/notifications.spec.ts` | Turn on with real Chrome (persistent profile), the device is listed, a test push is sent, the chime setting persists, turn off. Needs an API restarted with VAPID keys. |
