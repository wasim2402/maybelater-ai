# 13 — Testing and Quality

## Objective
Create a repeatable quality process so each feature can be trusted before release.

## Frontend
Use:
- Vitest.
- React Testing Library.
- Playwright.

Test:
- Form validation.
- Capture flow and error states.
- List filtering and search.
- Edit, complete, archive and snooze actions.
- Authentication redirects.
- Responsive navigation.
- Keyboard interaction and accessible names.

## Backend
Use pytest and FastAPI test clients. Use isolated test database fixtures or a dedicated test database.

Test:
- Request and response validation.
- Authentication and authorization.
- User data isolation.
- Database constraints.
- AI provider failures with mocked responses.
- Reminder lifecycle.
- Resurfacing rules and timezone boundaries.

## Quality gates
Before merging a feature:
- Lint passes.
- Type checking passes.
- Relevant unit and integration tests pass.
- Production frontend build passes.
- API tests pass.
- No secrets are committed.
- No console errors in the relevant browser flow.
- Mobile and keyboard behavior are checked.

## Accessibility
Check:
- Keyboard-only navigation.
- Focus visibility and focus order.
- Semantic headings and labels.
- Dialog focus management.
- Contrast.
- Reduced-motion behavior.

## Test data
Use synthetic data. Never copy real user content or secrets into fixtures.

## Deliverable
Document test commands and add a concise test plan for every feature. Fix regressions caused by the current stage before proceeding.
