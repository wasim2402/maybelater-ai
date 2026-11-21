# MaybeLater — Design System (Stage 02)

The design language for MaybeLater: warm and personal, and plain enough that the reason you saved something stays the most visible thing on screen.

## 1. Change the theme in one place

| What | File | Notes |
|---|---|---|
| Colours, radius, heading weight and tracking | `frontend/src/theme/tokens.css` | Section 1 is the brand palette. Section 2 holds derived values with their contrast rules. |
| Typefaces (Google Fonts) | `frontend/src/theme/fonts.ts` | Swap the `next/font/google` import and keep the variable names. |

Both apps read from these two files:
- **Product app** (Tailwind + shadcn): `src/app/globals.css` maps the brand tokens to Tailwind utilities (`bg-sage`, `text-sage-deep`, `bg-beige`, `border-line` …) and to shadcn's semantic variables (`--primary`, `--muted` …).
- **Landing page** (Taste Skill kit): `src/app/(marketing)/marketing.css` maps the same tokens to the kit's `--p-*` palette and `--font-*` roles.

No component hard-codes a colour or a font.

## 2. Tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `--brand-sage` | `#8B9A6E` | Primary buttons, selected states, the one accent |
| `--brand-paper` | `#F7F2EB` | Page ground ("White") |
| `--brand-beige` | `#EAE2D6` | Surfaces, bands, hovered rows |
| `--brand-grey` | `#EEEEEE` | Quiet fills: chips, skeletons, code |
| `--brand-ink` | `#2A2B24` | Text (warm near-black) |
| `--brand-sage-deep` | `#556140` | Sage as text, links, icons and focus rings |
| `--brand-sage-soft` | `#E3E8D8` | Wash behind AI suggestions |
| `--brand-on-sage` | `#161712` | Text on sage buttons |
| `--brand-muted` | `#60615D` | Labels, dates, meta |
| `--brand-line` | `#DDD5C8` | Hairlines and borders |
| `--brand-danger` / `--brand-success` | `#A4442F` / `#4F6B3A` | Destructive actions and errors / saved and done |

Measured contrast:

| Pair | Ratio |
|---|---|
| Ink on paper | 12.8:1 |
| Ink on beige | 11.1:1 |
| Sage-deep on paper | 5.9:1 |
| On-sage on sage | 6.0:1 |
| Muted on paper | 5.6:1 |
| Muted on beige | 4.9:1 |
| Danger on paper | 5.5:1 |
| White on danger | 6.1:1 |

Sage on paper is only 2.7:1, so sage never carries text or a focus ring on its own.

### Type

Gabarito for headings, Figtree for text and DM Mono for code and shortcuts. This is the Taste Skill's dealt pairing for a software product. It was dealt a second time, after IBM Plex failed the hero's line-length stress test.

- **Headings:** weight 400 with tracking of -3% (-4% at hero size). Size and tight tracking carry them, never bold.
- **Body text:** 16px with a line height of 1.55, in ink.
- **Labels:** 13px at 500, sentence case.
- **Minimum size:** nothing under 13px.
- **Inputs:** 16px text, so phones never zoom.

### Shape and spacing
- **Radius:** one family, stepped from `--brand-radius` (12px): controls at 0.5×, cards at 1×, dialogs at 1.33×.
- **Control height:** 44px (`h-11`), the minimum tap target. Large buttons are 48px; fields are 48px (`h-12`).
- **Elevation:** almost flat. Hairline borders, and one soft shadow, used only for toasts.

### Icons
Lucide, 16px in controls and 20px in navigation, always next to words. Every status pairs an icon with a word, so status never depends on colour.

## 3. Components

| Component | File | States covered |
|---|---|---|
| App shell (sidebar, phone top bar and bottom tabs, capture dialog) | `src/components/app-shell/app-shell.tsx` | Active route, framed preview |
| Buttons, inputs, textareas, dialogs, menus (shadcn on Base UI, restyled) | `src/components/ui/*` | Hover step, press, focus, disabled, invalid |
| Intention row | `src/features/intentions/intention-row.tsx` | Link or note, reason or "working out why", status, category, reminder, actions menu |
| Status and category labels | `src/features/intentions/labels.tsx` | 6 statuses, each an icon plus words |
| Capture composer | `src/features/capture/capture-composer.tsx` | Detects link vs note, optional "why", Ctrl/⌘+Enter, saving, saved, error with the text kept |
| AI suggestion panel | `src/features/ai/ai-suggestion-panel.tsx` | Suggested (dashed, sage wash, "Suggested"), confirmed (solid, "Confirmed"), edit, dismiss, pending, failed with retry, off |
| Reminder picker | `src/features/reminders/reminder-picker.tsx` | Presets, calendar, time, time zone shown, nothing scheduled until "Set reminder", past times blocked |
| Empty, loading, error and success states | `src/components/feedback/state-views.tsx` | — |
| Confirmation dialog | `src/components/feedback/confirm-dialog.tsx` | Destructive variant; the button names the action |
| Toasts | `src/components/ui/sonner.tsx` | Undo action |

**AI vs user content.** A suggestion is never applied without a click. Suggestions are dashed, sit on a pale sage wash, carry a sparkle icon and say "Suggested". Kept or edited values turn solid and say "Confirmed".

## 4. Screens

| Route | What it is |
|---|---|
| `/` | Public landing page (Taste Skill) |
| `/login`, `/signup` | Auth screens. Forms validate, but **accounts are not connected until stage 05**: submitting says so and sends nothing. |

The inbox, item detail, resurfaced, completed and settings views use these components and are built in stages 06 to 12.

## 5. Landing page (Taste Skill)

Built with the `design-taste-frontend` kit, copied to `frontend/public/assets`. Never edit the kit files there by hand. Redesigned on 2026-11-21 as a story: from recognising the problem, to seeing the product work, to signing up.

- **What was dealt** (picked at random from the skill's lists for a software page, not by hand):

  | Part | Choice |
  |---|---|
  | Page kind | Software |
  | Hero | Collage: the words on the left, the inbox window on a lit sage frame (cut by its right and bottom edges), and a small card showing a saved trip coming back on Saturday |
  | Type | Host Grotesk and JetBrains Mono, for the landing page only (`fonts.ts`, `--landing-font-*` in `tokens.css`). The app keeps Gabarito, Figtree and DM Mono. |
  | Nav | Cards: a "Product" panel with three small screens (Inbox, Resurfaced, Search) |
  | Close | The h2, a line, and one wide button |
  | Footer | Columns |
  | Section rhythm | One dark band (rediscover). "space" was dealt; the brief asked for charcoal sections. |
  | Buttons | Tonal |
  | Logo | The "dots" mark with "MaybeLater AI" |
  | Big scene | `product-assembles-into-its-action`: one article goes from tab to done as you scroll |
  | Moments | `word-highlight` on the promise statement, and the page's own `chaos-to-clarity` (below) in place of the dealt `line-carries-colour` |
  | Palette | The client's own colours (sage, paper, beige, warm ink), not the dealt cobalt |

- **Sections, in order:**
  1. Hero
  2. The problem ("Your someday list is getting longer."), the scroll moment
  3. The app frame ("Meet your personal intention manager.")
  4. The promise statement
  5. Five steps (click tabs)
  6. The demo scene
  7. Rediscover (the dark band, three resurfaced items with their reasons)
  8. Search
  9. Privacy (what really happens to your data)
  10. The close and the footer
- **Isolation:**
  - The landing page has its own root layout, `app/(marketing)/layout.tsx`, so the kit's global CSS and the landing type never reach the app.
  - The kit scripts and Lenis are mounted by the page itself, after its own markup hydrates (`taste-kit.tsx`, `smooth-scroll.tsx`). The layout hydrates first, and loading them there made the kit change the nav mid-hydration.
- **Motion** (each one has a reason; nothing else moves on scroll):
  - **Hero:** the kit's entrance, plus the Aceternity **Spotlight** (adapted, `components/landing/spotlight.tsx`) lighting the frame once.
  - **Problem section, `chaos-to-clarity`:** a GSAP ScrollTrigger timeline (`components/landing/problem-story.tsx`). Scattered tabs, screenshots and notes travel into one list while the stage is held by `position: sticky` inside its own two-screen section, scrubbed both ways. The closing line then follows in the flow. It is registered with the kit's moment loader through `public/assets/moments/chaos-to-clarity` (a module that moves nothing itself), so the checks read it as the moment it is. On a phone, under reduced motion and without script, the finished state shows instead.
  - **Statement:** the kit's `word-highlight`.
  - **Demo:** the kit's scene.
  - **Everywhere:** the kit's hover and press layer.
  - **Lenis** runs on the landing page only. It is driven by GSAP's ticker and feeds ScrollTrigger; it is off under reduced motion, and touch keeps native scrolling.
- **Photographs:** five licensed stand-ins from Wikimedia Commons, the things people save: a Lisbon tram, ramen, books, a lake campsite and a guitar. They are credited in the footer's credits list, and the guitar is cropped past a maker's label (marked "adapted"). Product screens are drawn as HTML from the app's real features.
- **What the page does not claim:**
  - The brief's "Ask your memories anything" assistant isn't built, so that section shows the real search.
  - Privacy states only real practice: what is sent to Google Gemini, logs without content, notifications encrypted to the browser, and deleting an account.
- **Note:** the skill bans smooth-scroll libraries and scroll-driven animation outside its moments. Lenis and the GSAP transition are kept because the brief requires them; the GSAP work is confined to one moment section.

### Browser checks (stage 02 run)

| Check | Result |
|---|---|
| `copy-lint` | 0 FAIL, 0 WARN |
| `check.mjs` (1440, 1024, 820, 768, 390) | No findings at 1024 and below. 1440: `hero-lines` stress test, waived (the real h1 sits on 3 lines). |
| `consistency.mjs` | 0 FAIL at 1440, 1024 and 390. At 820 and 768: 1 FAIL `flush` on the iris-opens moment's own cover (the kit's element). |
| `gate.mjs` | **GATE: PASS** (1 waiver: `hero-lines`) |
| `perf.mjs` | 2 FAIL rows, details below. All other rows pass: transfer 387 KiB, layout shift at load 0.000, LCP 360ms. |

The two perf FAIL rows:
- **Layout shift while scrolling at 1440 (0.305):** comes from the kit's iris-opens ring, which grows its box instead of transforming it. It is 0 at 390, where the moment rests.
- **Font families:** next/font's metric-matched "Fallback" faces are local Arial aliases, not downloads, but the check counts them as families.

## 6. Accessibility rules in use
- Visible 2px focus ring in deep sage everywhere.
- Every field has a label you can see. Errors sit under their field and are linked with `aria-describedby`.
- Icon-only buttons have `aria-label`.
- Headings step down one level at a time.
- Status is never shown by colour alone.
- Under reduced motion everything rests.
- Tap targets are 44px in the landing page and in the app's main controls.
