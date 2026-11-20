# MaybeLater — Master Build Guide

**Purpose:** This is the entry point for building MaybeLater in small, ordered, verifiable stages.

## Product
MaybeLater is an AI-powered personal intention manager for the general public. It helps people capture things they may want to do later, understand why they saved them, organize them, and bring them back when they become relevant.

**Core loop:** Capture → Understand → Organize → Resurface → Complete.

## How to use this documentation
1. Read `TECH_STACK_MAYBELATER.md` first.
2. Read this master guide.
3. Implement the numbered documents in order. Do not skip ahead unless a dependency is explicitly marked optional.
4. Complete and test one document before starting the next.
5. Update `docs/IMPLEMENTATION_STATUS.md` after every stage.
6. Do not build fake UI or disconnected demo interactions and call them complete.

## Numbered implementation sequence

| Number | Document | Outcome |
|---|---|---|
| 01 | `01_PRODUCT_REQUIREMENTS.md` | Product scope, personas, user stories, MVP boundaries |
| 02 | `02_DESIGN_SYSTEM_AND_UX.md` | Taste Skill workflow, design system, responsive UX |
| 03 | `03_SYSTEM_ARCHITECTURE.md` | Frontend/backend boundaries and app structure |
| 04 | `04_DATABASE_AND_DATA_MODELS.md` | PostgreSQL schema, relationships, migrations |
| 05 | `05_AUTH_AND_USER_ACCOUNTS.md` | Registration, login, sessions, protected resources |
| 06 | `06_CAPTURE_AND_INBOX_FEATURE.md` | Quick capture and saved-item inbox |
| 07 | `07_AI_UNDERSTANDING_FEATURE.md` | Structured AI analysis of saved items |
| 08 | `08_AI_AGENTS_AND_TOOLS.md` | Agent responsibilities, tools, safety and orchestration |
| 09 | `09_ORGANIZATION_AND_SEARCH.md` | Categories, filters, search and item management |
| 10 | `10_SMART_RESURFACING_ENGINE.md` | Rules and logic for bringing items back |
| 11 | `11_REMINDERS_AND_NOTIFICATIONS.md` | User-approved reminders and delivery |
| 12 | `12_USER_DASHBOARD_AND_SETTINGS.md` | Main app shell, dashboard and preferences |
| 13 | `13_TESTING_AND_QUALITY.md` | Unit, API, browser and accessibility testing |
| 14 | `14_DEPLOYMENT_AND_OPERATIONS.md` | Environments, deployment, monitoring and backups |
| 15 | `15_MVP_ACCEPTANCE_CHECKLIST.md` | End-to-end definition of done |

## Rules for the coding agent
- Inspect the repository before editing. Preserve working code and existing conventions.
- Follow `TECH_STACK_MAYBELATER.md`; do not silently replace technologies.
- Use the Taste Skill for the design process. Read its installed `SKILL.md` and follow its instructions before major UI work.
- Use GSAP for purposeful animation. Use Lenis only on the public landing page, not as a global dashboard default.
- Keep the user in control of AI-generated content, suggested dates and reminders.
- Every user-owned database query must be scoped to the authenticated user on the server.
- Never expose API keys or secrets in frontend code.
- Use migrations for schema changes.
- Add loading, empty, error, success and responsive states.
- Do not invent integrations or claim a feature works unless it is implemented and tested.

## Required workflow for every numbered stage
1. Read the entire relevant document.
2. Inspect related files and identify dependencies.
3. Write a short implementation plan.
4. Implement only the scope of that stage.
5. Run relevant lint, type-check, tests and build commands.
6. Fix failures caused by the changes.
7. Update `docs/IMPLEMENTATION_STATUS.md` with completed work, files changed, checks run and known issues.
8. Stop and report the result. Do not start the next stage without being asked.

## Stage completion report
Use this format:

- **Stage:** number and document
- **Implemented:** concise feature list
- **Files changed:** paths
- **Validation:** commands and results
- **Remaining:** known gaps or blockers
- **Next stage:** the next numbered document, not started
