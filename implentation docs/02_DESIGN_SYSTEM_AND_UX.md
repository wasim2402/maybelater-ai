# 02 — Design System and UX

## Objective
Create a distinctive, coherent and accessible design language for MaybeLater before building major screens.

## Required design workflow
1. Confirm the Taste Skill is installed from `https://github.com/Leonxlnx/taste-skill`.
2. Read its `SKILL.md` and follow its exact workflow.
3. Explore multiple visual directions, then select one coherent direction appropriate for a calm personal intention manager.
4. Define typography, color tokens, spacing, radii, elevation, icon style and interaction patterns.
5. Build reusable components before duplicating patterns across screens.
6. Inspect desktop, tablet and mobile in a real browser and fix issues.

Do not merely mention the Taste Skill. Use it.

## Experience qualities
- Calm, warm, thoughtful and trustworthy.
- Modern without looking like a generic AI dashboard.
- Clear hierarchy and readable typography.
- Fast capture and low-friction item management.
- AI suggestions should be visually distinguishable from user-confirmed content.

## Required screens
- Public landing page.
- Sign up and login.
- First-time empty state/onboarding.
- Main inbox/dashboard.
- Capture composer.
- Intention detail/edit view.
- Search and filtered results.
- Resurfaced items view.
- Reminder controls.
- Account/settings.

## Component requirements
Create reusable components for:
- App shell and navigation.
- Buttons, inputs, textareas and dialogs.
- Intention item/list row.
- Category/status labels.
- Capture composer.
- AI suggestion panel.
- Reminder/date controls.
- Empty, loading, error and success states.
- Confirmation dialogs and toast feedback.

Use shadcn/ui and Radix primitives where useful. Customize them to the chosen art direction; do not leave the default appearance untouched.

## Motion
- Use GSAP and `@gsap/react` for deliberate hero, section and selected interaction animations.
- Use Lenis only for the public landing page smooth-scroll experience.
- Respect `prefers-reduced-motion`.
- Keep dashboard transitions lightweight and never delay core actions.
- Avoid scroll-jacking, excessive parallax and animation on every card.

## Responsive and accessibility requirements
- Test around 390px, 768px, 1024px and 1440px widths.
- Ensure keyboard navigation and visible focus.
- Use semantic HTML and accessible names.
- Maintain adequate contrast.
- Ensure dialogs, menus and forms work with keyboard and screen readers.
- Do not rely on color alone to communicate status.

## Deliverable
Commit the design tokens, reusable component foundations and browser-checked page layouts. Include screenshots or a short review note in the implementation report where possible.
