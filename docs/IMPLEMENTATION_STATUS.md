# MaybeLater — Implementation Status

Update this file after each numbered implementation stage. Stage documents live in `implentation docs/`.

| Stage | Document | Status | Notes |
|---|---|---|---|
| 01 | `01_PRODUCT_REQUIREMENTS.md` | Done | `docs/PRODUCT_REQUIREMENTS.md`: scope, user stories, requirement → screen → API → test matrix |
| 02 | `02_DESIGN_SYSTEM_AND_UX.md` | Done | `docs/DESIGN_SYSTEM.md`; theme in `src/theme/`; landing `/`, `/login`, `/signup`; Taste Skill gate PASS. Auth not wired (stage 05). |
| 03 | `03_SYSTEM_ARCHITECTURE.md` | Done | `docs/ARCHITECTURE.md`; shared error format, request ids, JSON logs, size and rate limits, SSRF guards, readiness check, typed web API client |
| 04 | `04_DATABASE_AND_DATA_MODELS.md` | Done | `docs/DATA_MODEL.md`; 6 tables, initial migration `08f4688f0da9` with 9 system categories; ownership, consent and deletion enforced by the database |
| 05 | `05_AUTH_AND_USER_ACCOUNTS.md` | Done | `docs/AUTH.md`; Better Auth (web) + EdDSA JWT verified by FastAPI via JWKS; protected `/app`, settings, sign-out, account deletion; e2e passing at 1440 and 390 |
| 06 | `06_CAPTURE_AND_INBOX_FEATURE.md` | Done | `docs/CAPTURE.md`; capture with idempotent retries and duplicate links, inbox with filters and pagination, detail and edit, done, archive and delete; analysis as a separate step |
| 07 | `07_AI_UNDERSTANDING_FEATURE.md` | Done | `docs/AI.md`; OpenAI structured outputs behind the provider boundary, SSRF-safe page metadata, suggestions that never overwrite user decisions, review UI with keep, edit, dismiss and retry. Live OpenAI call not verified (no key). |
| 08 | `08_AI_AGENTS_AND_TOOLS.md` | Done | `docs/AGENTS.md`; Capture Understanding Agent with 3 narrow, audited tools; later agents documented only; evaluation set and live run (12/12 passed) |
| 09 | `09_ORGANIZATION_AND_SEARCH.md` | Done | `docs/SEARCH.md`; PostgreSQL full-text search, combinable filters in the URL, own categories, tag counts; e2e at 1440 and 390 |
| 10 | `10_SMART_RESURFACING_ENGINE.md` | Done | `docs/RESURFACING.md`; pure, deterministic rules engine (date, snooze, confirmed condition, opt-in stale) in the user's time zone; Resurfaced page, bring-it-back, snooze and not-now actions, settings. |
| 11 | `11_REMINDERS_AND_NOTIFICATIONS.md` | Done | `docs/REMINDERS.md`; reminders confirmed by the user, stored with their zone; delivered once per version by a PostgreSQL-backed worker on the server (SKIP LOCKED, idempotent delivery records, retries with backoff); quiet hours and pause; Reminders page, item panel, settings. |
| 12 | `12_USER_DASHBOARD_AND_SETTINGS.md` | Done | `docs/APP_SHELL.md`; dashboard with quick capture, "Back for you" (real due reminders and resurfaced items only), recently saved, search and filters; reduce-motion setting applied app-wide; responsive shell tested end to end at 390, 768 and 1440 px. |
| 13 | `13_TESTING_AND_QUALITY.md` | Not started | |
| 14 | `14_DEPLOYMENT_AND_OPERATIONS.md` | Not started | |
| 15 | `15_MVP_ACCEPTANCE_CHECKLIST.md` | Not started | |

## Agent run log

### 2026-11-20 — Stage 01
- **Stage:** 01 — Product Requirements
- **Summary:** Wrote the MVP requirements summary: problem, users, journey, must-have scope (R1–R10), later items, non-goals, user stories (US1–US8), principles, and analytics events that exclude content. Mapped every MVP requirement to a planned screen, API operation, test and owning stage. Recorded that the repo uses `frontend/` and `backend/` instead of the docs' `apps/web` and `apps/api`.
- **Files changed:** `docs/PRODUCT_REQUIREMENTS.md` (new), `docs/IMPLEMENTATION_STATUS.md` (new).
- **Validation:** Documentation-only stage, no code changed. Baseline checks on the existing scaffold: `npm run lint` passed, `npm run typecheck` passed, `npm test` passed (1 test), backend `pytest` passed (1 test).
- **Known issues:** The account data-deletion API endpoint is not yet in the API contract; stage 05 or 12 must define it or document the limitation. Screen routes are proposals until stages 02 and 12.
- **Next stage:** 02 — `02_DESIGN_SYSTEM_AND_UX.md` (not started).

### 2026-11-21 — Stage 02
- **Stage:** 02 — Design System and UX
- **Summary:** Built the design system from the client's palette (sage, white, beige, grey) using the Taste Skill workflow. Colours, radius and type roles live in `src/theme/tokens.css` and fonts in `src/theme/fonts.ts`; both the app and the landing page read only from these two files. Added restyled shadcn controls and the reusable product components: app shell, intention row, status and category labels, capture composer, AI suggestion panel, reminder picker, state views, confirmation dialog and toasts. Built the public landing page on the Taste Skill kit, in its own root layout, with Lenis on the landing page only. Added the auth screen designs.
- **Files changed:**
  - `frontend/src/theme/*`
  - `frontend/src/app/globals.css`
  - `frontend/src/app/(app)/*`: layout, providers, login, signup
  - `frontend/src/app/(marketing)/*`: layout, page, marketing.css, taste-kit, smooth-scroll
  - `frontend/src/components/{app-shell,feedback}/*`
  - `frontend/src/components/ui/{button,input,textarea,dropdown-menu,sonner}.tsx`
  - `frontend/src/features/{intentions,capture,ai,reminders,auth}/*`
  - `frontend/public/assets/*`: the vendored Taste Skill kit
  - `frontend/public/share.jpg`
  - `frontend/eslint.config.mjs`: ignores the vendored kit
  - Removed: the Next.js starter page, the root layout and the starter SVGs
  - `docs/DESIGN_SYSTEM.md`
- **Validation:**
  - `npm run lint`: pass. `npm run typecheck`: pass. `npm test`: pass (1 test). `npm run build`: pass, all routes static.
  - Taste Skill: copy-lint 0 FAIL; layout check clean at 1024 and below; consistency 0 FAIL at 1440, 1024 and 390; **gate PASS**.
  - Screenshots checked by eye at 1440, 820 and 390 (in `shots/`, gitignored).
- **Known issues:**
  1. Auth forms validate but are not connected; sign-up arrives in stage 05.
  2. Taste Skill items traced to kit code, which the skill says not to edit:
     - The iris-opens moment adds 0.305 layout shift while scrolling at 1440 and trips `flush` at 820 and 768.
     - perf counts next/font's local "Fallback" faces as extra font families.
  3. The skill bans smooth-scroll libraries, but Lenis is kept on the landing page because the tech stack requires it.
  4. `metadataBase` and the canonical URL wait for the production domain (stage 14).
  5. On this machine, Vitest must run from a shell whose path starts with `D:\`. A lowercase `d:\` loads two copies of Vitest and fails with "failed to find the current suite".
- **Next stage:** 03 — `03_SYSTEM_ARCHITECTURE.md` (not started).

- **Follow-up (2026-11-21):** removed the `/design` reference page and its link from the auth screens, at the user's request.

### 2026-11-21 — Stage 03
- **Stage:** 03 — System Architecture
- **Summary:** Built the shared API foundation every later endpoint inherits:
  - one error body with stable codes and no stack traces, carrying the request id;
  - request ids (`X-Request-ID`) and JSON access logs that omit query strings and bodies;
  - a crash guard inside CORS, so the browser can read a 500;
  - a request body size cap and a sliding-window `RateLimit` dependency;
  - SSRF-safe URL validation, both shape and DNS;
  - UTC and time-zone helpers, cursor `Page[T]` and error schemas, and an `AIProvider` boundary;
  - settings that reject `*` CORS and require a strong `AUTH_SECRET` outside development, and API docs only in development;
  - a `/api/v1/health/ready` database check.

  On the web side: a typed API client with Zod validation and `ApiError`, and a React Query retry policy that never retries a 4xx.
- **Files changed:**
  - `backend/app/main.py`
  - `backend/app/core/{config,errors,middleware,request_context,logging,rate_limit,url_safety,time,deps}.py`
  - `backend/app/api/routes/health.py`
  - `backend/app/schemas/{common,health}.py`
  - `backend/app/services/ai/provider.py`
  - `backend/requirements.txt` and `requirements.lock.txt` (added `tzdata`)
  - `backend/tests/{conftest,test_api_foundation,test_core_units,test_health}.py`
  - `frontend/src/lib/api/{client,errors,client.test}.ts`
  - `frontend/src/app/(app)/providers.tsx`
  - `.env.example` (fixed the broken `BETTER_AUTH_SECRET` line; added `LOG_LEVEL` and `MAX_REQUEST_BYTES`)
  - `docs/ARCHITECTURE.md`
- **Validation:**
  - Backend: `pytest` 43 passed.
  - Frontend: `npm run lint` and `npm run typecheck` pass; `npm test` 7 passed.
  - The API ran alone with the real `backend/.env`: health 200; ready 200 (database ok, AI not configured); CORS and request id headers present; JSON logs.
  - The web dev server ran alone: `/`, `/login` and `/signup` return 200.
- **Known issues:**
  1. Rate limits are kept in memory, per process; they move to Redis when the API scales out (stage 14).
  2. The current-user dependency and ownership enforcement land in stage 05, with auth.
  3. The OpenAI provider implementation lands in stage 07.
- **Next stage:** 04 — `04_DATABASE_AND_DATA_MODELS.md` (not started).

### 2026-11-21 — Stage 04
- **Stage:** 04 — Database and Data Models
- **Summary:** Added SQLAlchemy models for users, categories, intentions, intention_analyses, reminders and activities, plus the initial Alembic migration with a 9-row system category seed. The database itself enforces:
  - ownership, through composite foreign keys to `intentions(id, user_id)`;
  - consent: a reminder cannot be scheduled, snoozed or sent without `approved_at`;
  - valid statuses and types, URL rules, size bounds and timestamp rules;
  - explicit deletion behaviour: intention deletes cascade to reminders, analyses and activities, a deleted category leaves its intentions uncategorised, and account deletion removes everything the user owns.

  Captured content is kept apart from AI interpretation, and `field_states` records who stands behind each editable value, so AI never overwrites user edits. Added the validated `UserPreferences` schema and constraint naming conventions.
- **Files changed:**
  - `backend/app/db/base.py`
  - `backend/app/models/{__init__,enums,user,category,intention,analysis,reminder,activity}.py`
  - `backend/app/schemas/user.py`
  - `backend/alembic/env.py` (URL override for tests; type and default comparison)
  - `backend/alembic/versions/08f4688f0da9_initial_schema.py`
  - `backend/tests/{db_utils,test_migrations,test_schema_rules}.py`
  - `docs/DATA_MODEL.md`
- **Validation:**
  - `pytest`: 63 passed. This covers a fresh migration, downgrade to base and re-upgrade, no drift between models and migrations, and every constraint and cascade rule against PostgreSQL 18.4.
  - `alembic upgrade head` applied to the local development database.
- **Known issues:**
  1. Better Auth's own tables arrive in stage 05; account deletion must remove those rows too.
  2. The rule that AI writes only `suggested` fields is documented in the schema and enforced in the service in stage 07.
- **Next stage:** 05 — `05_AUTH_AND_USER_ACCOUNTS.md` (not started).

### 2026-11-21 — Stage 05
- **Stage:** 05 — Authentication and User Accounts
- **Summary:** Better Auth 1.7.24 in Next.js: email and password, HTTP-only session cookies, database-backed rate limits, and its tables in a separate `auth` schema (`npm run auth:migrate`). The JWT plugin issues 15-minute EdDSA tokens. FastAPI verifies them on its own:
  - public keys come from JWKS; EdDSA only; `exp`, `iat`, `sub`, `iss` and `aud` are all checked;
  - the identity comes only from `sub`, and the app user is created on first contact;
  - `current_user` protects routes, and rate limits key on the user.

  Added `GET`, `PATCH` and `DELETE /api/v1/me`. The web side has a bearer-token client (memory cache, refresh, retry once on 401, session-expired redirect, no cookies sent to the API), `src/proxy.ts` for early redirects, and a server-validated protected layout under `<Suspense>`. Built the working login and signup with vague errors and safe `next` redirects; `/app` reads the account from the API; and `/app/settings` covers display name, time zone, sign-out and account deletion. Deletion checks the password, then a `beforeDelete` hook deletes the API data before removing the auth account.
- **Files changed:**
  - Backend:
    - `app/core/{auth,deps,config}.py`
    - `app/services/users.py`
    - `app/api/routes/me.py`, `app/api/router.py`
    - `tests/test_auth.py`, `tests/test_core_units.py`
  - Frontend:
    - `src/lib/auth/{options,server,client}.ts`
    - `src/app/api/auth/[...all]/route.ts`
    - `src/proxy.ts`
    - `src/lib/api/{client,token}.ts` and their tests
    - `src/features/account/api.ts`
    - `src/features/auth/{auth-form,auth-form.test}.ts(x)`
    - `src/app/(app)/app/{layout,session-shell,page,inbox-home}.tsx`
    - `src/app/(app)/app/settings/*`
    - `src/app/(app)/{login,signup}/page.tsx`
    - `src/components/app-shell/app-shell.tsx`
    - `scripts/migrate-auth.mts`, `e2e/auth.spec.ts`, `playwright.config.ts`
    - `package.json`: `better-auth@1.7.24`, `pg@8.23.1`, `server-only`, `@types/pg`, `auth:migrate`
    - `tsconfig.json`
  - Shared: `.env.example`, `docs/AUTH.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`
- **Validation:**
  - Backend `pytest`: 84 passed (24 new auth and account tests).
  - Frontend: lint and typecheck pass; `vitest` 22 passed; `next build` passes (`/app` partially prerendered, proxy active).
  - Playwright end to end against the real web app, API and PostgreSQL: 2 tests passed at desktop (1440) and at phone width (390).
  - After the runs, the database holds no test accounts.
- **Known issues:**
  1. There is no email sender yet, so email verification and password reset are not offered. Sign-up therefore cannot fully hide whether an email exists, though its message never confirms it.
  2. Playwright's own browser download is out of date on this machine; use `PLAYWRIGHT_CHANNEL=chrome` or run `npx playwright install`.
  3. The auth rate limits are strict (5 sign-ups per 10 minutes per IP), so repeated local end-to-end runs can hit them; clear `auth."rateLimit"` in development if needed.
  4. `backend/.env` still contains the old `AUTH_SECRET` line, which is now unused and can be removed.
- **Next stage:** 06 — `06_CAPTURE_AND_INBOX_FEATURE.md` (not started).

### 2026-11-21 — Stage 06
- **Stage:** 06 — Capture and Inbox
- **Summary:**
  - `POST /api/v1/captures`, with one handler per input kind (text and URL now; image and voice plug in later). It runs safe URL validation and normalisation, stores the original first, and records a `captured` activity.
  - `client_request_id` idempotency, so double-clicks and retries after a network failure return the same item.
  - Duplicate links (ignoring tracking parameters) return the open item.
  - Analysis runs after the response in its own session: `off` without a key, otherwise `pending`, then `ready` or `failed`. It is safe if the item was deleted meanwhile.
  - Intentions list (newest first, keyset cursor, status filters), detail, edit (user edits marked in `field_states`; the original is immutable), status changes with timestamps, hard delete, and a categories list.
  - Web: global capture from the shell, the empty state and the phone bar, with a toast after the server confirms; inbox with filters in the URL, load more, row actions with undo and delete confirmation; item detail with the original, "Open original" and editable title, reason, category and tags.
- **Files changed:**
  - Backend:
    - `app/models/intention.py`
    - migration `325c29f0dab2` (`normalized_url`, `client_request_id` and indexes)
    - `app/core/url_safety.py` (`normalize_url`)
    - `app/schemas/intentions.py`
    - `app/services/{capture,intentions,analysis,activity}.py`
    - `app/api/routes/intentions.py`, `app/api/router.py`
    - `tests/{api_utils,test_capture}.py`
  - Frontend:
    - `src/features/intentions/{types,api,labels,intention-row}.ts(x)`
    - `src/features/capture/capture-composer.tsx` and its test
    - `src/components/app-shell/app-shell.tsx`
    - `src/app/(app)/app/{session-shell,inbox-home}.tsx`
    - `src/app/(app)/app/items/[id]/*`
    - `vitest.setup.ts` (Testing Library cleanup)
    - `e2e/capture.spec.ts`
  - `docs/CAPTURE.md`
- **Validation:**
  - Backend `pytest`: 124 passed (33 new).
  - Frontend: lint and typecheck pass; `vitest` 26 passed; `next build` passes.
  - Playwright `capture.spec.ts` passed at 1440 and 390 against the real API and PostgreSQL.
  - The migration is applied to the local dev database, and no e2e accounts are left behind.
- **Known issues:**
  1. Real AI analysis and suggestion display come in stage 07; until then items show "Suggestions are not switched on yet".
  2. Search, tag and category filters on the list come in stage 09.
  3. Snooze and resurfacing come in stage 10.
- **Next stage:** 07 — `07_AI_UNDERSTANDING_FEATURE.md` (not started).

### 2026-11-21 — Stage 07
- **Stage:** 07 — AI Understanding
- **Summary:**
  - A validated `IntentionAnalysisOutput` (title, summary, intent, category, tags, resurface condition, confidence) and a versioned prompt (`capture-understanding-v1`) that fences captured content as untrusted data.
  - `OpenAIProvider` uses `responses.parse` with a Pydantic `text_format` and `store=False`, retries only transient failures, and maps errors to codes.
  - SSRF-safe page metadata for links: every hop is checked, with time, size and HTML limits, and the body is never stored.
  - `run_analysis` records the provider, model, prompt version and output, and applies suggestions only to fields whose state is absent or `suggested`.
  - `POST /ai/analyze` (retry or refresh), accept or dismiss per suggestion, and confidence on the detail view.
  - Web: suggestions panel (keep, edit, not this), a self-refreshing pending state, retry on failure, a rough-guesses note for low confidence, and an inbox that refreshes while items are pending.
- **Files changed:**
  - Backend:
    - `app/services/ai/{schemas,prompts,provider}.py`
    - `app/services/{page_metadata,analysis,intentions}.py`
    - `app/schemas/intentions.py`, `app/api/routes/intentions.py`
    - `tests/test_ai.py`; `tests/test_capture.py` (injected analyzer, no network)
  - Frontend:
    - `src/features/intentions/{types,api,suggestions,suggestions.test}.ts`
    - `src/features/ai/ai-suggestion-panel.tsx` and its test
    - `src/app/(app)/app/items/[id]/item-detail.tsx`
  - Shared: `.env.example`, `docs/AI.md`
- **Validation:**
  - Backend `pytest`: 152 passed (28 new).
  - Frontend: lint and typecheck pass; `vitest` 35 passed; `next build` passes.
- **Known issues:**
  1. No `OPENAI_API_KEY` is configured here, so the real OpenAI call is untested live; every behaviour is covered with mocked responses. Set the key and model to try it.
  2. DNS-rebinding hardening (pinning the connection to the checked IP) for metadata fetches is deferred to stage 14.
  3. Items captured while AI was off are not analysed automatically later.
- **Next stage:** 08 — `08_AI_AGENTS_AND_TOOLS.md` (not started).

### 2026-11-21 — Change: AI provider switched from OpenAI to Google Gemini (requested)
- **Summary:** Replaced `OpenAIProvider` with `GeminiProvider` (`google-genai` 2.34.0) behind the same `AIProvider` boundary.
  - It uses structured JSON output with a response schema, then strict validation; a per-attempt deadline; retries for timeouts, connection errors, 429 and 5xx only; and the same error codes as before.
  - Settings `OPENAI_API_KEY`/`OPENAI_MODEL` became `GEMINI_API_KEY`/`GEMINI_MODEL` (default `gemini-3.8-flash`); the startup panel shows "Gemini <model>".
  - Removed the `openai` dependency and added `httpx2` to the dev requirements, since Starlette's TestClient needs it. Added `backend/scripts/check_ai.py` for a live check.
  - This overrides `TECH_STACK_MAYBELATER.md` ("OpenAI API"), at the user's request.
- **Files changed:**
  - `backend/app/services/ai/provider.py`, `backend/app/core/{config,startup}.py`, `backend/app/services/ai/schemas.py`
  - `backend/requirements.txt`, `requirements-dev.txt`, `requirements.lock.txt`
  - `backend/tests/{test_ai,test_capture,test_core_units}.py`, `backend/scripts/check_ai.py`
  - `backend/.env` (placeholder names only), `.env.example`
  - `docs/{AI,ARCHITECTURE}.md`, `README.md`
- **Validation:** backend `pytest` 155 passed (provider tests rewritten against a mocked Gemini client). Live Gemini call not yet run: `GEMINI_API_KEY` is empty.

### 2026-11-21 — Gemini live check and fallback model
- **Live check:** the key authenticates and `gemini-3.8-flash` is listed for it, but it, and every other 3.x Flash model, returned 504 DEADLINE_EXCEEDED or 503 "high demand" during testing. `gemini-2.5-flash` answered in about 2 s.
- **Change (user's choice):** `gemini-3.8-flash` stays the main model, with a 15 s deadline. On overload, deadline or quota (503, 504, timeout, 429), the request goes to `GEMINI_FALLBACK_MODEL` (default `gemini-2.5-flash`), and each run records the model that answered. Configuration errors and malformed answers do not fall back.
- **Validation:**
  - Backend `pytest`: 164 passed (9 new fallback tests).
  - `scripts/check_ai.py` live: validated suggestions for a text note and two links, answered by the fallback while 3.8 was busy.
- **Note:** run scripts with the project's virtual environment (`.venv\Scripts\Activate.ps1`, or `.venv\Scripts\python.exe`). The system Python lacks the packages, which caused the earlier `No module named 'pydantic_settings'` error.

### 2026-11-21 — Stage 08
- **Stage:** 08 — AI Agents and Tools
- **Summary:**
  - The Capture Understanding Agent (`app/agents/capture_understanding.py`) is a deterministic workflow with exactly three typed tools (`app/agents/tools.py`):
    - `read_captured_item` (read, owned items only, minimum data);
    - `read_page_metadata` (read, the item's own link only);
    - `save_suggestions` (write, validated output only, undecided fields only).
  - Every tool derives the user from the server context and writes a content-free audit line. Each run logs its outcome, the model that answered, prompt and schema versions, fields written, confidence and per-step timings.
  - The post-capture analysis now runs through the agent. There are no delete, publish, reminder or SQL tools; a test enforces this.
  - The Organization, Resurfacing and Personal Search assistants are documented interfaces only. No LangGraph.
  - Evaluation: 15 synthetic cases (`evals/capture_cases.json`), a tested scorer (`evals/scoring.py`) and a live runner (`scripts/eval_capture.py`) with rate-limit waits.
  - Fixed `alembic/env.py` (`fileConfig(..., disable_existing_loggers=False)`): migrations run inside a process (tests, tools) were silently disabling the app's loggers.
- **Files changed:**
  - `backend/app/agents/{__init__,tools,capture_understanding}.py`
  - `backend/app/services/analysis.py`
  - `backend/alembic/env.py`
  - `backend/evals/{__init__,capture_cases.json,scoring.py}`
  - `backend/scripts/eval_capture.py`
  - `backend/tests/test_agents.py`
  - `docs/AGENTS.md`
- **Validation:**
  - Backend `pytest`: 176 passed (12 new).
  - Live evaluation against Gemini: 12 of 15 cases answered, all 12 passed (category, title and resurface 100%, 0 hallucinations, direct injection resisted, low confidence on vague input), all via the fallback `gemini-2.5-flash`.
- **Known issues:**
  1. The key is on the **free tier: 20 requests per day per model**. Today's `gemini-2.5-flash` allowance is used up, and resets in about 22 h. Until then, and whenever `gemini-3.8-flash` is overloaded, analyses fail with `provider_rate_limited` and items show "No suggestions" with a retry. Capture is unaffected. Enable billing for real use.
  2. Three evaluation cases (`shoes-race`, `injection-fence`, `bare-domain`) have not been run live yet, because of the quota.
  3. `evals/last_run.json` holds the second, quota-limited run (5 cases); the full results are recorded above and in `docs/AGENTS.md`.
- **Next stage:** 09 — `09_ORGANIZATION_AND_SEARCH.md` (not started).

### 2026-11-21 — Stage 09
- **Stage:** 09 — Organization and Search
- **Summary:**
  - Full-text search via a generated, stored `tsvector` with a GIN index (migration `fe95352b43f6`): prefix matching, every word required, URL text matched, and input reduced to letters and digits so nothing reaches the query syntax.
  - Filters for status, category (or none), tag and created after/before. They combine, keep keyset pagination without gaps, and malformed values return 422.
  - `POST /categories` (private, unique per user) and `GET /tags` with counts.
  - Web: a debounced search box; category, tag and date filters with Clear filters; everything in the URL; the item page's back link returns to the same search; a no-results state; "New category…" on the item page.
  - New `AI_ENABLED` switch (turn suggestions off without removing the key; used for end-to-end runs).
- **Bugs fixed:**
  - Fast filter changes undid each other (stale filters).
  - "Saved." never appeared after saving details (a stage 07 regression).
  - Stale auth end-to-end assertions (since stage 06).
  - Tag filter moved off the deprecated `ARRAY.any()` to `contains` (`@>`, served by the GIN index).
- **Files changed:**
  - Backend:
    - `app/models/intention.py`; migration `fe95352b43f6`
    - `app/services/intentions.py`, `app/api/routes/intentions.py`, `app/core/config.py`
    - `tests/test_search.py`, `tests/test_core_units.py`
  - Frontend:
    - `src/features/intentions/{types,api,inbox-url,inbox-url.test}.ts`
    - `src/app/(app)/app/inbox-home.tsx`, `src/app/(app)/app/items/[id]/item-detail.tsx`
    - `e2e/{search,capture,auth}.spec.ts`
  - Shared: `.env.example`, `docs/SEARCH.md`
- **Validation:**
  - Backend `pytest`: 211 passed (35 new).
  - Frontend: lint and typecheck pass; `vitest` 40 passed; `next build` passes.
  - Playwright: search at 1440 and 390, plus capture and auth at 1440, all pass against the real API and PostgreSQL (API started with `AI_ENABLED=false`).
  - The migration is applied to the local dev database.
- **Known issues:**
  1. Results are ordered newest first, not by relevance, to keep stable keyset pagination. Ranking by relevance can be added as an option later.
  2. Collections and AI-assisted organisation (the Organization Assistant) remain documented interfaces only (`docs/AGENTS.md`).
- **Next stage:** 10 — `10_SMART_RESURFACING_ENGINE.md` (not started).

### 2026-11-21 — Stage 10
- **Stage:** 10 — Smart Resurfacing Engine
- **Summary:**
  - Pure `evaluate()` (no database, clock or AI) with four signals: chosen date, ended snooze, user-confirmed condition, opt-in stale.
  - Exclusions (done or archived, still snoozed), 30-day "not now" suppression, a frequency cooldown, a suggestions switch (dates and snoozes always apply), transparent ranking with plain reasons, all in the user's IANA zone with DST-safe presets.
  - API: `GET /recommendations` (records shown items once per local day) and snooze, unsnooze, dismiss, resurface (bring back on a date, or clear) and viewed. Bookkeeping writes leave `updated_at` alone.
  - Web: a Resurfaced page with a nav count and actions (open, snooze presets, not now, done with undo); a "Bring it back" control on the item page; "Back …" and "Snoozed until …" on inbox rows; resurfacing settings; a minute-stable `useNow` hook.
- **Bugs fixed during the stage:**
  - Reading `updated_at` after recording "shown" caused a lazy load and a 500. Shown and viewed are no longer edits.
  - An ended snooze was explained as "you asked to see this again" (the most recent instruction now wins).
  - Two impure clock reads during render, flagged by the React Compiler lint.
- **Files changed:**
  - Backend:
    - `app/services/{resurfacing,recommendations}.py`
    - `app/api/routes/resurfacing.py`, `app/api/router.py`
    - `tests/test_resurfacing_{engine,api}.py`
  - Frontend:
    - `src/features/resurfacing/{api.ts,when-menu.tsx,bring-back.tsx}`
    - `src/features/intentions/{types.ts,intention-row.tsx}`
    - `src/app/(app)/app/resurfaced/*`, `session-shell.tsx`, `items/[id]/item-detail.tsx`, `settings/account-settings.tsx`
    - `src/components/app-shell/app-shell.tsx`, `src/hooks/use-now.ts`
    - `e2e/resurfacing.spec.ts`
  - `docs/RESURFACING.md`
- **Validation:**
  - Backend `pytest`: 259 passed (48 new).
  - Frontend: lint and typecheck pass; `vitest` 40 passed; `next build` passes.
  - Playwright `e2e/resurfacing.spec.ts` (desktop, Chrome) passed against the live backend. Its title check now ignores case, because AI-generated titles can change capitalisation.
- **Known issues:**
  1. The resurfacing e2e takes about 2.5 minutes because it waits for real time to pass (no fake clock in the browser).
  2. Only a small, explicit condition vocabulary is understood; other conditions are notes. An AI ranking or explanation layer (the Resurfacing Assistant) remains a documented interface (`docs/AGENTS.md`).
- **Next stage:** 11 — `11_REMINDERS_AND_NOTIFICATIONS.md` (not started).

### 2026-11-21 — Stage 11
- **Stage:** 11 — Reminders and Notifications
- **Summary:**
  - **API:** `POST`, `GET`, `PATCH` (confirm, reschedule, snooze, complete) and `DELETE` (cancel) under `/reminders`.
  - **Consent:**
    - `confirm` is required on create; without it the result is a draft, which is never delivered.
    - The web picker states the exact time and zone before **Set reminder**.
    - The database refuses an unapproved scheduled reminder, and no agent tool can create one.
  - **Time:**
    - Each reminder stores a UTC instant plus the zone the user picked it in.
    - The web app sends a wall-clock time and the server converts it, refusing times skipped by daylight saving.
    - Presets are resolved on the server.
  - **Delivery:**
    - A PostgreSQL-backed worker runs inside the API (or as `python -m app.worker`) and claims due rows with SKIP LOCKED.
    - `reminder_deliveries` is unique per (reminder, schedule_version), so a version is never delivered twice.
    - Retryable failures back off for 1, 5, 15 and 60 minutes, up to 5 attempts; a crash after delivery is repaired without resending.
    - Delivery pauses while reminders are turned off and waits out quiet hours on the user's clock.
  - **Channel:** in-app only (email and push deliberately not added).
  - **Web app:**
    - A Reminders page (due and coming up) with a nav count and a toast when one comes due.
    - A Reminder panel on the item page, built on the reworked picker.
    - Reminder settings: on or off, and quiet hours.
    - Resurfaced now has its own icon.
- **Files changed:**
  - Backend:
    - `app/models/{reminder,enums,__init__}.py`
    - Migration `f95d03ffed9f` (`reminder_deliveries`, `schedule_version`, `completed_at`, one open reminder per item)
    - `app/services/{reminders,reminder_delivery}.py`, `app/api/routes/reminders.py`, `app/api/router.py`
    - `app/core/{config,startup}.py`, `app/main.py`, `app/worker.py`
    - `tests/test_reminders_{time,api}.py`, `tests/test_migrations.py`
  - Frontend:
    - `src/features/reminders/{api.ts,wall-clock.ts,reminder-picker.tsx,reminder-controls.tsx,item-reminder.tsx,use-reminder-alerts.ts,reminders.test.tsx}`
    - `src/app/(app)/app/reminders/*`, `session-shell.tsx`, `items/[id]/item-detail.tsx`, `settings/account-settings.tsx`, `resurfaced/resurfaced-list.tsx`
    - `src/components/app-shell/app-shell.tsx`
    - `e2e/reminders.spec.ts`
  - Docs: `docs/REMINDERS.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`
- **Validation:**
  - Backend: `pytest` 311 passed (52 new).
  - Migration applied to the dev database; `alembic check` reports no drift.
  - Frontend: lint and typecheck pass; `vitest` 45 passed (5 new); `next build` passes (`/app/reminders` is a partial prerender).
- **Known issues:**
  1. `e2e/reminders.spec.ts` (desktop, Chrome) passed on 2026-11-21 at the start of stage 12, in 3.9 minutes: the server delivered the reminder with no page open, and done, cancel and quiet hours all worked.
  2. With several reminders due during quiet hours, each pass re-reads them (batch of 100) until the hours end. This is fine at MVP scale; a `deliver_after` column would remove the re-reads.
  3. The scheduler is PostgreSQL, not Redis with ARQ, which the stage allows as long as it is documented. Revisit when email or push arrive (stage 14).
- **Next stage:** 12 — `12_USER_DASHBOARD_AND_SETTINGS.md` (not started).

### 2026-11-21 — Stage 12
- **Stage:** 12 — Dashboard and Settings
- **Summary:**
  - **Dashboard (`/app`):**
    - An always-visible quick-capture bar.
    - "Back for you": up to 3 due reminders and 3 resurfaced items. It shows only in the default view and only when something is really due; otherwise it renders nothing. API failures are handled with a retry.
    - A "Recently saved" heading over the URL-backed search and filters. The existing empty, error and loading states are kept.
  - **Settings:** a new Accessibility section with **Reduce motion**, which updates immediately and reverts on failure. It is applied app-wide through `data-reduce-motion` on `<html>`, honoured by `globals.css` and `lib/motion.ts` (the capture pulse respects it). The remaining MVP settings (account, time zone, reminders, resurfacing, sign out, delete) were already in place.
  - **Navigation:**
    - Inbox, Resurfaced, Reminders and Settings, with counts.
    - Completed stays as the Inbox's Done filter, following the design-stage information architecture (documented).
    - The dev-only Next.js badge was turned off because it covered the phone tab bar.
- **Bugs fixed during the stage:**
  - The reduce-motion checkbox didn't change until the server replied (it now updates immediately).
  - The dev badge intercepted taps on the phone Inbox tab.
- **Files changed:**
  - Frontend:
    - `src/features/dashboard/{for-you-now.tsx,for-you-now.test.tsx}`, `src/lib/motion.ts`
    - `src/app/(app)/app/{inbox-home.tsx,session-shell.tsx,settings/account-settings.tsx}`
    - `src/features/capture/capture-composer.tsx`, `src/app/globals.css`, `next.config.ts`
    - `e2e/dashboard.spec.ts`
  - Docs: `docs/APP_SHELL.md`
  - No backend changes (`preferences.reduce_motion` already existed).
- **Validation:**
  - Frontend: lint and typecheck pass; `vitest` 52 passed (7 new); `next build` passes.
  - Playwright (Chrome):
    - `dashboard.spec.ts` passed at mobile, tablet and desktop widths.
    - Regression: `auth`, `capture` and `search` passed on desktop, and `search` on tablet.
    - The stage 11 `reminders.spec.ts` passed.
  - Backend unchanged (311 tests passing at the end of stage 11).
- **Known issues:**
  1. Running many e2e specs back to back reaches the sign-up limit (5 per 10 minutes, Better Auth) and the API's `DELETE /me` limit. Run specs in small groups with `--workers=1`, or clear the dev `auth."rateLimit"` rows and restart the API between runs. The limits themselves are intended.
- **Next stage:** 13 — `13_TESTING_AND_QUALITY.md` (not started).
