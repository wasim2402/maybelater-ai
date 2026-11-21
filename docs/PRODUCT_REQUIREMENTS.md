# MaybeLater — Product Requirements Summary (MVP)

> Stage 01 deliverable. Source: `implentation docs/01_PRODUCT_REQUIREMENTS.md`, aligned with
> `TECH_STACK_MAYBELATER.md` and the API/screen plans in documents 03–15.
> This summary is the scope contract for the MVP. Later stages should update it, not contradict it silently.

## 1. Product in one line

**"Save it now. MaybeLater will help you remember it when it matters."**

MaybeLater is a personal intention manager for the general public. It is not a project-management tool and does not turn every saved item into a task.

**Core loop:** Capture → Understand → Organize → Resurface → Complete

## 2. Problem

People save links, ideas, places, products and future tasks across scattered apps and browser tabs. Later they forget *why* they saved them, or never return at the right moment.

## 3. Who it is for

| Group | What they need |
|---|---|
| Frequent savers (links, ideas, places, products) | One place to put things, plus a record of why each was saved |
| Busy people | A lightweight external memory that takes seconds to use |
| Curious collectors | Things to explore later, brought back when it is a good time |
| Reminder-averse users | Gentle resurfacing, not another demanding task list |

We make no assumptions about profession, age group or productivity method.

## 4. Core user journey

1. The user captures a URL or a text thought.
2. The original content is stored **immediately**, before any AI processing.
3. AI optionally suggests a title, summary, intent, category and resurfacing context.
4. The user reviews, accepts or edits the suggestions.
5. The item appears in the user's inbox/library.
6. The system may *suggest* a resurfacing condition or reminder. Nothing is scheduled without consent.
7. The user can open, snooze, edit, complete, archive or delete the item.

## 5. MVP scope

### Must have
| ID | Requirement |
|---|---|
| R1 | Account creation and login |
| R2 | Capture text and URLs |
| R3 | Personal inbox/library |
| R4 | Item detail and editing |
| R5 | AI title, summary, intent and category suggestions |
| R6 | Search and basic filters |
| R7 | User-controlled reminder creation |
| R8 | Resurface list based on explicit dates and simple rules |
| R9 | Complete, archive, snooze and delete actions |
| R10 | Responsive design and accessible controls |

### Later (not MVP blockers)
Voice capture, screenshot/image understanding, browser extension, email forwarding, calendar integrations, social sharing/collaboration, complex autonomous agents, multi-channel notification delivery.

The capture layer must still be designed so voice and image inputs can be added without a rewrite (see stage 06).

### Non-goals
- Turning every saved item into a task.
- Scheduling reminders without user consent.
- Autonomous purchases, bookings, messages or any external change.
- Scraping restricted content or bypassing website access controls.
- Presenting AI guesses as verified facts.

## 6. User stories

| ID | Story | Covered by |
|---|---|---|
| US1 | As a user, I can quickly save a thought without filling out a long form. | R2 |
| US2 | As a user, I can save a URL and return to its original destination. | R2, R4 |
| US3 | As a user, I can see why I saved an item. | R4, R5 |
| US4 | As a user, I can correct AI-generated details. | R4, R5 |
| US5 | As a user, I can search and filter my saved items. | R6 |
| US6 | As a user, I can choose when an item should remind me. | R7 |
| US7 | As a user, I can snooze or dismiss a resurfaced item. | R8, R9 |
| US8 | As a user, I can delete my data. | R9, R1 (account deletion) |

## 7. Product principles (acceptance lens for every stage)

1. Capture takes seconds.
2. The original item is never lost when AI fails.
3. AI is an assistant, not the owner of the user's data. All AI fields are editable, and AI suggestions are visibly distinct from user-confirmed data.
4. Resurfacing is relevant and respectful.
5. The interface stays calm and uncluttered: no vanity metrics or fabricated activity.
6. Users can inspect, edit and delete everything stored about them.

## 8. Traceability: requirement → screen → API → test

Planned items are not built yet. Screen routes are proposals for the `frontend/` Next.js app and will be finalized in stage 02 (design/IA) and stage 12 (app shell). API endpoints follow the `/api/v1` contract in `TECH_STACK_MAYBELATER.md` §8 and documents 06–11. Test names show the intended test location and type, and the stage that owns them.

| Req | Screen(s) | API operation(s) | Test(s) | Owning stage |
|---|---|---|---|---|
| **R1** Accounts | `/signup`, `/login`, `/settings` (logout, account deletion) | Better Auth handlers in Next.js (`/api/auth/*`); FastAPI verifies the session/JWT on every `/api/v1/*` request | pytest: `tests/test_auth.py` (unauthenticated → 401, invalid/expired token rejected, user A cannot access user B's data); Playwright: `e2e/auth.spec.ts` (signup → login → refresh keeps session → logout → redirect) | 05 |
| **R2** Capture text & URL | Global quick-capture (app shell + dashboard) | `POST /api/v1/captures` | pytest: `tests/test_captures.py` (text and URL saved, original stored when AI fails, validation errors); Vitest: capture form validation; Playwright: `e2e/capture.spec.ts` | 06 |
| **R3** Inbox/library | `/app` (dashboard), `/app/inbox` | `GET /api/v1/intentions` | pytest: `tests/test_intentions.py` (list scoped to owner, pagination); Vitest: empty/loading/error states | 06, 12 |
| **R4** Detail & edit | `/app/items/[id]` (page or sheet) | `GET /api/v1/intentions/{id}`, `PATCH /api/v1/intentions/{id}` | pytest: user edits saved and not overwritten by later AI runs; 404 for another user's item; Playwright: open → edit → persisted after reload; original URL opens | 06, 09 |
| **R5** AI suggestions | Detail view (AI fields marked as suggestions, with accept/edit) | `POST /api/v1/ai/analyze` (also triggered after capture) | pytest: `tests/test_ai_analysis.py` with a mocked provider (valid structured output persisted, invalid output rejected, timeout/failure leaves item intact and status pending/failed, prompt-injection text ignored) | 07, 08 |
| **R6** Search & filters | Inbox search bar and filter controls | `GET /api/v1/intentions?q=&status=&category=&tag=&created_after=&created_before=&limit=&cursor=` | pytest: `tests/test_search.py` (query/filters, owner scoping); Playwright: search and filter narrow the list | 09 |
| **R7** User-controlled reminders | Detail view: "Remind me" control; `/app/resurfaced` | `POST /api/v1/reminders`, `GET /api/v1/reminders`, `PATCH /api/v1/reminders/{id}`, `DELETE /api/v1/reminders/{id}` | pytest: `tests/test_reminders.py` (created only by explicit request, lifecycle, timezone handling, owner scoping); Playwright: create → snooze → cancel | 11 |
| **R8** Resurface list | `/app/resurfaced` and a dashboard "worth another look" module | `GET /api/v1/recommendations` | pytest: `tests/test_resurfacing.py` (explicit dates due, simple rules, snoozed and dismissed items excluded, timezone boundaries) | 10 |
| **R9** Complete / archive / snooze / delete | Item actions in list and detail; `/app/completed` | `POST /api/v1/intentions/{id}/complete`, `PATCH /api/v1/intentions/{id}` (status → archived), `POST /api/v1/intentions/{id}/snooze`, `POST /api/v1/intentions/{id}/dismiss`, `DELETE /api/v1/intentions/{id}`; account data deletion (endpoint defined in stage 05/12) | pytest: status transitions, delete removes data, owner scoping; Playwright: complete/archive/snooze/delete from the UI | 06, 09, 10, 12 |
| **R10** Responsive & accessible | All screens | n/a | Playwright at 390 / 768 / 1024 / 1440 px; keyboard-only navigation, focus visibility, dialog focus, accessible names, reduced motion; Taste Skill browser check | 02, 12, 13 |

### Coverage check
- Every MVP requirement (R1–R10) maps to at least one screen, one API operation (or "n/a" for R10, which is cross-cutting), and at least one test.
- Every user story (US1–US8) maps to at least one requirement.
- **Open item:** the account data-deletion endpoint is not in the initial API contract. Stage 05 or 12 must define it, or document the limitation as the spec allows ("account deletion/data export policy placeholder").

## 9. Success indicators (product events)

Track these events: `capture_completed`, `analysis_completed`, `item_edited`, `reminder_created`, `item_resurfaced`, `item_snoozed`, `item_completed`.

Rules:
- Events record IDs, types and timestamps, never the saved content, URLs or AI summaries.
- Store them in the optional `Activity` entity (stage 04) first. Any third-party analytics is out of MVP scope.

## 10. Repository note

The tech-stack doc proposes `apps/web` and `apps/api`. This repository already uses `frontend/` (Next.js) and `backend/` (FastAPI), and that working layout is kept. Read `apps/web` as `frontend/` and `apps/api` as `backend/` throughout the implementation docs.
