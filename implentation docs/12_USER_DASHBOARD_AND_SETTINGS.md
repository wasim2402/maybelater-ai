# 12 — Dashboard and Settings

## Objective
Build the authenticated application shell and the primary place where users interact with MaybeLater.

## Dashboard priorities
The dashboard should answer:
1. What have I saved?
2. What should I look at again?
3. How can I quickly save something new?

Do not fill the dashboard with vanity statistics.

## Main navigation
Keep navigation minimal. Suggested areas:
- Inbox / All saved.
- Resurfaced.
- Completed.
- Settings.

Use the final information architecture established in the design stage.

## Dashboard modules
- Quick capture entry point.
- Recently saved items.
- Resurfaced items, when available.
- Search and filters.
- Helpful empty state for new users.

## Settings
MVP settings:
- Display name/account details where supported.
- Timezone.
- Reminder preferences.
- Resurfacing preferences.
- Reduced-motion/accessibility behavior where applicable.
- Logout.
- Account/data deletion entry point or clearly documented limitation.

## UX requirements
- Do not show fabricated activity or metrics.
- Use real API data.
- Include loading, error, empty and success states.
- Ensure navigation and capture work on small screens.
- Preserve user context when moving between list and detail.

## Tests
- Protected dashboard behavior.
- Settings persist correctly.
- Navigation works at mobile and desktop widths.
- Empty states and API failures render correctly.

## Deliverable
A complete, responsive authenticated app shell connected to the real backend.
