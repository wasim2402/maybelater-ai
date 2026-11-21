# MaybeLater — Organisation and Search (Stage 09)

Find things again without a rigid system: search as you type, a few filters that combine, your own categories, and tags.

## Search

- **Engine:** PostgreSQL full-text search. No extra service, no vector database. `intentions.search_vector` is a **generated, stored** `tsvector` (migration `fe95352b43f6`) with a GIN index, and PostgreSQL keeps it current on every insert and update.
- **What is searched, and its weight:**
  - title (A);
  - your note and the intent (B);
  - the summary and the original captured text (C).

  The `simple` text configuration keeps words as written, with no language-specific stemming, so it works for any language and for names.
- **Matching:**
  - Every word must match, as a word prefix: `sourd` finds "sourdough", and `lemon cake` needs both words.
  - Links also match on their URL text: `bbc` finds `https://www.bbc.co.uk/...`.
  - A search made only of symbols returns "no matches", not everything.
- **Safety:**
  - The search box is reduced to letters and digits, at most 8 terms of 40 characters, before it reaches the query syntax.
  - Everything is a bound parameter, and `%` and `_` are escaped for URL matching.
  - Every query is scoped to the signed-in user.
- **Order and paging:** newest first, with keyset pagination on `(created_at, id)`, so filtered pages never skip or repeat items.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/intentions` | Parameters listed below. Bad values return 422 `validation_error` with the field named. |
| GET | `/api/v1/categories` | System categories plus the user's own |
| POST | `/api/v1/categories` | `{name}`. Returns 201. Names are unique per user and case-insensitive, and may not repeat a system category (409 `category_exists`). At most 50 per user, and only the owner sees them. |
| GET | `/api/v1/tags` | The user's tags with counts, most used first |
| PATCH | `/api/v1/intentions/{id}` | `category_id` (system or own; another user's returns 404) and `tags` (cleaned, lower-cased, de-duplicated, at most 20) |

`GET /api/v1/intentions` parameters:

| Parameter | Values |
|---|---|
| `q` | Words to find, up to 200 characters |
| `status` | `open` (default), `inbox`, `active`, `completed`, `archived` or `all` |
| `category` | A category id, or `none` for uncategorised items |
| `tag` | One tag |
| `created_after`, `created_before` | ISO 8601 with a time zone offset. The start is inclusive and the end exclusive. |
| `limit`, `cursor` | Paging |

## Web app

- **Search box:** results update 300 ms after you stop typing. Escape or the × clears it, and the previous results stay visible, dimmed, while the next ones load.
- **Filters:** Open, Done, Archived and All; category (including "No category"); tag (with counts); and when it was saved (last 7 days, last 30 days or this year, counted from local midnight). **Clear filters** resets everything except the status.
- **Everything lives in the URL** (`/app?q=lemon&tag=baking&since=30d`), so reload, back and forward keep the view. The item page's **Inbox** link returns to the exact search you came from (remembered for the browser tab).
- **No results:** "Nothing matches 'zeppelin'", with a hint and a **Clear filters** button. The status line is announced to screen readers.
- **Organising:** on the item page, choose a category or **New category…** to create your own, and edit the tags as a comma-separated list. AI-suggested tags can be kept, edited or dismissed (`docs/AI.md`).

## Bugs found and fixed in this stage

1. **Fast filter changes undid each other.** Changing the tag and then the category quickly built the second change from stale filters and brought the tag back. Changes now build on the latest requested filters.
2. **"Saved." never appeared after saving the details form** (from stage 07). The form re-mounts when the item changes on the server, including after its own save, which dropped the confirmation. The saved state now lives in the parent.
3. **The auth end-to-end test was stale** since the stage 06 inbox replaced the placeholder text it checked. It now checks that the inbox loads through the API.

## Tests

| Layer | File | Covers |
|---|---|---|
| API | `backend/tests/test_search.py` (34) | Matches in title, note, summary and original; word prefixes; every word required; case and spacing ignored; URL text; **no leaks across users**; SQL-injection-like, wildcard, tsquery-syntax, very long and emoji queries; literal `%` and `_`; empty query; term sanitising; **filters that combine** (text, category, tag, status, none); dates with an inclusive start and exclusive end; malformed filters return 422; **pagination under a filter without gaps or repeats**; edits searchable immediately; custom categories (private, unusable by others); duplicate names refused; slugs; per-user tag counts |
| Web, unit | `src/features/intentions/inbox-url.test.ts` | Filters round-trip through the URL, unknown values ignored, query building, "since" windows from local midnight |
| End to end | `frontend/e2e/search.spec.ts`, run at 1440 and 390 | Search as you type with the URL following; every word required; open an item and come back to the same search; create a category and tags; tag, category and "No category" filters; reload keeps the view; a no-results message with Clear filters |

**Running end-to-end tests:** start the API with AI switched off (`AI_ENABLED=false`) so the results do not depend on Gemini or use your quota. Background suggestions would change items' categories while the test runs.
