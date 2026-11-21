# MaybeLater — Implementation Status

Update this file after each numbered implementation stage. Stage documents live in `implentation docs/`.

| Stage | Document | Status | Notes |
|---|---|---|---|
| 01 | `01_PRODUCT_REQUIREMENTS.md` | Done | `docs/PRODUCT_REQUIREMENTS.md`: scope, user stories, requirement → screen → API → test matrix |
| 02 | `02_DESIGN_SYSTEM_AND_UX.md` | Done | `docs/DESIGN_SYSTEM.md`; theme in `src/theme/`; landing `/`, `/login`, `/signup`; Taste Skill gate PASS. Auth not wired (stage 05). |
| 03 | `03_SYSTEM_ARCHITECTURE.md` | Not started | |
| 04 | `04_DATABASE_AND_DATA_MODELS.md` | Not started | |
| 05 | `05_AUTH_AND_USER_ACCOUNTS.md` | Not started | |
| 06 | `06_CAPTURE_AND_INBOX_FEATURE.md` | Not started | |
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
