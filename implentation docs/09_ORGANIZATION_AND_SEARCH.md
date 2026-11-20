# 09 — Organization and Search

## Objective
Help users retrieve and manage saved intentions without forcing a rigid productivity system.

## MVP organization
- Inbox and active items.
- Completed and archived states.
- System categories suggested by AI.
- User-editable category and tags.
- Status and date filters.
- Text search across title, summary and user-provided content where appropriate.

## Search behavior
- Search only within the authenticated user's records.
- Use parameterized queries and safe escaping.
- Support pagination and stable sorting.
- Debounce interactive search.
- Show a clear no-results state.
- Preserve search terms when navigating to item details and back.

## Optional semantic search
Do not add vector databases by default. First validate whether normal PostgreSQL search meets the MVP need. Consider PostgreSQL full-text search or pgvector only when there is a clear user benefit and evaluation data.

## API
- `GET /api/v1/intentions`
- Query parameters for `q`, `status`, `category`, `tag`, `created_after`, `created_before`, `limit` and `cursor` or page.
- `PATCH /api/v1/intentions/{id}` for user-approved edits.

## UX
- Keep filters easy to understand.
- Avoid too many categories.
- Make AI-suggested tags editable/removable.
- Ensure list and detail layouts work on mobile.

## Tests
- Search results never leak across users.
- Filters combine correctly.
- Pagination does not duplicate or skip records.
- Empty and malformed queries are handled.
- Editing tags/category updates the visible result.

## Deliverable
A functional searchable library with filters, pagination and user-controlled organization.
