# 15 — MVP Acceptance Checklist

## Objective
Verify that MaybeLater is genuinely usable end-to-end before calling the MVP complete.

## Account and security
- [ ] User can sign up and log in.
- [ ] Session persists and logout works.
- [ ] Protected API endpoints reject unauthenticated requests.
- [ ] User A cannot access User B's data.
- [ ] Secrets are not exposed in browser bundles or source control.

## Capture and library
- [ ] User can capture plain text.
- [ ] User can capture a URL.
- [ ] Captures persist in PostgreSQL.
- [ ] Original content is preserved.
- [ ] User can open and edit an intention.
- [ ] User can complete, archive and delete an item.
- [ ] Capture remains successful when AI analysis is unavailable.

## AI understanding
- [ ] AI returns validated structured output.
- [ ] Suggestions are clearly labelled.
- [ ] User can edit suggestions.
- [ ] Re-analysis does not overwrite user edits.
- [ ] Prompt injection in captured content is treated as untrusted input.
- [ ] Provider failures are handled safely.

## Organization and resurfacing
- [ ] User can search their own items.
- [ ] Filters and pagination work.
- [ ] Resurfacing follows documented deterministic rules.
- [ ] Completed and archived items are excluded.
- [ ] Snooze and dismiss behavior works.
- [ ] Timezones are handled correctly.

## Reminders
- [ ] User explicitly approves reminder creation.
- [ ] User can edit, snooze and cancel reminders.
- [ ] Duplicate delivery is prevented if delivery is enabled.
- [ ] Notification preferences are respected.

## UX and quality
- [ ] Landing page uses the Taste Skill design workflow.
- [ ] GSAP motion is purposeful and reduced-motion aware.
- [ ] Lenis is limited to the landing page.
- [ ] Desktop and mobile layouts work.
- [ ] Loading, empty, error and success states exist.
- [ ] Keyboard navigation and visible focus work.
- [ ] Lint, type checks, tests and production build pass.

## Release decision
Do not mark the MVP complete while a critical security, data-loss or authorization issue remains open.

## Final release report
Include:
- Implemented capabilities.
- Known limitations.
- Test/build results.
- Deployment URLs (only after verified deployment).
- Operational risks and follow-up tasks.
