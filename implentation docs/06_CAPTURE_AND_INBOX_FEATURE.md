# 06 — Capture and Inbox Feature

## Objective
Make saving an intention fast, reliable and forgiving. The original capture must be stored even if AI analysis is unavailable.

## MVP input types
1. Plain text.
2. URL.

Design the service boundary so image, screenshot and voice inputs can be added later without rewriting the entire capture flow.

## User experience
- Provide an obvious quick-capture action.
- Support a short text thought or pasted URL.
- Keep the initial form minimal.
- Show immediate success feedback after the server confirms storage.
- Show a processing state if AI analysis is started.
- Allow the user to continue using the app if analysis fails.
- Display captured items in an inbox with useful title/source/date/status information.
- Provide detail, edit, archive, complete and delete actions.

## Backend behavior
- Validate content length and accepted URL schemes.
- Normalize URLs safely without destroying meaningful query parameters.
- Store the raw input and source type first.
- Create an intention record owned by the authenticated user.
- Trigger AI analysis as a separate operation or background task.
- Return the saved item even if analysis has not completed.
- Avoid fetching arbitrary URLs without SSRF protections, timeouts and size limits.

## API
- `POST /api/v1/captures`
- `GET /api/v1/intentions`
- `GET /api/v1/intentions/{id}`
- `PATCH /api/v1/intentions/{id}`
- `DELETE /api/v1/intentions/{id}`

## Inbox behavior
- Default sort: newest first.
- Include pagination.
- Add basic status filters.
- Clearly distinguish processing, analyzed and failed-analysis states.
- Include helpful empty states with a direct capture action.

## Edge cases
- Duplicate URL.
- Empty or whitespace-only text.
- Very long input.
- Malformed URL.
- AI provider unavailable.
- User double-clicks submit.
- Network failure after server save.
- Deleted item with a pending analysis job.

## Tests
Cover validation, ownership, duplicate submissions, provider failure and capture persistence.

## Deliverable
A fully connected capture-to-inbox flow with real database persistence and tests.
