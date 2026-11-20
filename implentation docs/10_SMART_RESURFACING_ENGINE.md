# 10 — Smart Resurfacing Engine

## Objective
Bring saved intentions back when they are likely to matter, without creating noisy or surprising reminders.

## Important distinction
**Resurfacing** is showing a potentially relevant saved item inside the app.  
**Reminder delivery** is sending a notification at a scheduled time.

These are related but separate systems.

## MVP resurfacing signals
- User explicitly selected a date.
- User snoozed an item until a date.
- User selected a simple context/condition.
- Item has not been reviewed for a user-configured period (optional and off by default).

Do not infer sensitive personal attributes or use hidden tracking to decide when to resurface items.

## Rules engine
Implement deterministic rules first:
1. Find eligible items for the authenticated user.
2. Exclude completed, archived and deleted items.
3. Respect snooze and dismissal state.
4. Apply user's timezone and selected schedule.
5. Rank candidates using transparent signals.
6. Return a concise reason for each candidate.

Use AI only as an optional ranking/explanation layer after deterministic eligibility has been established.

## API
- `GET /api/v1/recommendations`
- Optional `POST /api/v1/intentions/{id}/snooze`
- Optional `POST /api/v1/intentions/{id}/dismiss`

## UX
- Explain why an item resurfaced.
- Offer open, snooze, dismiss and complete actions.
- Avoid repeating the same item too frequently.
- Let users control frequency and disable suggestions.
- Provide a quiet, non-alarming presentation.

## Tests
- Timezone boundaries and daylight-saving changes.
- Snoozed items do not appear early.
- Completed/archived items are excluded.
- Dismissed items follow the configured suppression rule.
- One user's candidate list never includes another user's items.

## Deliverable
A deterministic, testable resurfacing service and a useful in-app resurfaced-items experience.
