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
| 07 | `07_AI_UNDERSTANDING_FEATURE.md` | Not started | |
| 08 | `08_AI_AGENTS_AND_TOOLS.md` | Not started | |
| 09 | `09_ORGANIZATION_AND_SEARCH.md` | Not started | |
| 10 | `10_SMART_RESURFACING_ENGINE.md` | Not started | |
| 11 | `11_REMINDERS_AND_NOTIFICATIONS.md` | Not started | |
| 12 | `12_USER_DASHBOARD_AND_SETTINGS.md` | Not started | |
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
