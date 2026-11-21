# MaybeLater — Capture and Inbox (Stage 06)

Saving something is fast and never depends on AI: the original is stored first, then analysis runs on its own.

## Flow

```text
Browser composer --POST /api/v1/captures--> validate -> detect kind -> handler.prepare()
   (client_request_id per attempt)          -> replay / duplicate check -> INSERT intention + activity
                                            -> 201 with the item (analysis_status: pending | off)
                                            -> after the response: run_analysis() (separate session)
```

- **Input kinds:** handlers live in `app/services/capture.py` (`HANDLERS`). Text and URL exist today. Image, screenshot and voice each add a handler (plus an upload route) without changing the flow.
- **Kind detection:** a capture that is exactly one `http(s)://` link becomes a URL item. Text that merely contains a link stays a note.
- **Original kept apart:** `original_content`, `original_url` and `user_note` are written once. Edits change only the interpretation fields, which become `edited` in `field_states`, so later AI analysis never overwrites them.
- **Analysis:** `app/services/analysis.py` runs after the response is sent, in its own session.
  - Without an AI key the item is saved with `off`, never stuck on "processing".
  - With a key it starts as `pending`, then becomes `ready` or `failed`. A failure records an error code and leaves the item untouched.
  - The model call itself arrives in stage 07.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/captures` | `{content, note?, client_request_id?}`. Returns 201 `{result: "created", item}`. Returns 200 with `result: "duplicate"` when the link is already open, or `"replayed"` for a retried attempt. Rate limit: 30 per minute per user. |
| GET | `/api/v1/intentions` | `status=open\|inbox\|active\|completed\|archived\|all` (default `open`), `limit` 1–100, `cursor`. Newest first, keyset pagination. A bad cursor returns 400 `invalid_cursor`. |
| GET | `/api/v1/intentions/{id}` | 404 for a missing item and for another user's item |
| PATCH | `/api/v1/intentions/{id}` | `title`, `summary`, `intent`, `user_note`, `category_id`, `tags`, `resurface_condition`, `status`. The original cannot be edited (a 422). Status changes set or clear `completed_at` and `archived_at`. |
| DELETE | `/api/v1/intentions/{id}` | 204. Hard delete; its reminders, analyses and history go with it. |
| GET | `/api/v1/categories` | System categories plus the user's own |

## Edge cases

| Case | Handling |
|---|---|
| Duplicate URL | `normalized_url` lower-cases the scheme and host, drops the default port and removes `utm_*`, `fbclid`, `gclid` and similar. The rest of the query and the fragment are kept. If an *open* item has the same link, it is returned with `result: "duplicate"`. A completed or archived link can be saved again. Duplicates are per user. |
| Empty or whitespace-only text | Rejected in the browser (Zod) and on the server, with a 422 `validation_error` |
| Very long input | 20,000 characters for content and 1,000 for the note; the database CHECK enforces the same. The 1 MB body cap applies too. |
| Malformed or unsafe URL | `validate_capture_url`: http(s) only, no credentials, no localhost, private or metadata addresses. Returns a 422 `unsafe_url`. |
| AI provider unavailable | The capture still returns 201. Analysis is marked `failed` (or `off` without a key), and the inbox and detail pages say so. |
| User double-clicks submit | The button is disabled while saving, and `client_request_id` plus a unique `(user_id, client_request_id)` index make a second request return the same item (`replayed`). The server handles a race between two identical requests too. |
| Network failure after the server saved | The composer keeps the text and the same attempt id. Retrying returns the saved item instead of a copy, and changing the text starts a new attempt. |
| Deleted item with pending analysis | `run_analysis` reloads the item by id and user. If it is gone, it does nothing, and a failure write skips missing items. |
| Server-side URL fetching | None in this stage. When stage 07 fetches page metadata it must call `resolve_public_url` first and use timeouts and size limits. |

## Web app

- **Capture:** "Save something" in the sidebar, phone top bar or empty state opens the composer. It detects link vs note as you type, takes an optional "why", and saves with Ctrl/⌘+Enter. A toast confirms only after the server answers, with an Open action. Duplicates say "That link is already in your inbox."
- **Inbox (`/app`):** filters Open, Done, Archived and All, kept in the URL (`?status=`). Rows show the title, the reason, the analysis state ("Reading it", "No suggestions"), the category, the host and when it was saved. The row menu offers done, not done, archive, move to inbox and delete; status changes can be undone from the toast. "Load more" fetches the next page. Every view has loading, empty, error and success states.
- **Detail (`/app/items/{id}`):** shows what you saved, with "Open original" opening links in a new tab with `noopener noreferrer`. You can edit the title, why you saved it, the category and the tags, and use done, archive and delete. A deleted or foreign item shows "This item no longer exists".

## Tests

| Layer | File | Covers |
|---|---|---|
| API | `backend/tests/test_capture.py` | 33 tests: text and URL persistence; validation of empty, whitespace, too-long, localhost, private-IP and credential captures; text containing a link; duplicate detection across tracking parameters, after completion and per user; idempotent retry; activity without content; 401; newest-first pagination with no gaps; bad cursor; status filters; cross-user isolation on get, patch and delete; edits marking `field_states`; original immutable; category ownership; complete, archive and restore; delete; capture when the provider is unavailable; analysis of a deleted item; provider error recorded; successful analysis; URL normalisation |
| Web, unit | `src/features/capture/capture-composer.test.tsx` | Link detection, success clears the field, retry reuses the attempt id and keeps the text, new text gets a new attempt, duplicate message, whitespace rejected without a request |
| End to end | `frontend/e2e/capture.spec.ts`, run at 1440 and 390 | Empty inbox, then save a link, recognise a duplicate, save a note, newest first, open, edit and reload, mark done, the Done filter, delete from the row menu |
