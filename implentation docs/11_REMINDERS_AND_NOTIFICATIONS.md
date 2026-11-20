# 11 — Reminders and Notifications

## Objective
Allow users to create and manage reminders for their saved intentions.

## MVP
- User selects a date and time.
- User confirms the reminder.
- Reminder is stored with timezone information.
- User can edit, snooze, cancel or mark it complete.
- In-app reminder state is visible.

## Later delivery channels
- Email.
- Web push.
- Mobile push.

Do not add delivery channels until consent, unsubscribe, retry and failure handling are defined.

## Scheduling
Use Redis + ARQ or another documented scheduler when asynchronous delivery is implemented. Do not rely on a browser tab staying open.

## Reminder lifecycle
`draft → scheduled → sent` with alternate transitions to `snoozed` or `cancelled`.

Use idempotency so retries do not send duplicate notifications. Store delivery attempts and safe failure metadata.

## API
- `POST /api/v1/reminders`
- `PATCH /api/v1/reminders/{id}`
- `DELETE /api/v1/reminders/{id}` or a cancellation action
- `GET /api/v1/reminders`

## Consent and controls
- Never create a reminder solely because an AI suggested one.
- Make the date/time explicit before confirmation.
- Provide notification preferences and an easy way to disable delivery.
- Respect quiet hours if the user configures them.
- Use the user's timezone consistently.

## Tests
- Duplicate job prevention.
- Timezone and daylight-saving boundaries.
- Cancelled reminders are not delivered.
- Retry behavior does not duplicate sends.
- User ownership and preference checks.

## Deliverable
A user-approved reminder workflow with reliable scheduling boundaries and tested lifecycle transitions.
