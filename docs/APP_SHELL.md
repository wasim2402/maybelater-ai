# MaybeLater — App Shell, Dashboard and Settings (Stage 12)

The signed-in app (`/app/*`) is protected by `src/proxy.ts`: without a session, any app page redirects to `/login?next=<page>`, and you return there after signing in. All data comes from the API. Nothing on screen is invented: no sample items, no activity counts, no streaks.

## Navigation

| Area | Path | What it is |
|---|---|---|
| Inbox (the dashboard) | `/app` | Everything saved, with search and filters. Done, Archived and All are status filters here. |
| Resurfaced | `/app/resurfaced` | Items worth another look now, each with its reason (`docs/RESURFACING.md`) |
| Reminders | `/app/reminders` | Due reminders and upcoming ones (`docs/REMINDERS.md`) |
| Settings | `/app/settings` | Account, time zone, reminders, resurfacing, accessibility, sign out, delete account |

- **On wide screens** this is a sidebar with a **Save something** button. **On phones** it is a top bar with **+** and a bottom tab bar. Resurfaced and Reminders show their counts in the navigation.
- **Completed items** stay under the Inbox's **Done** filter instead of having their own area. This follows the design stage's information architecture (`docs/DESIGN_SYSTEM.md`) and keeps the phone tab bar to four tabs. The filter is in the URL (`/app?status=completed`), so it can be linked and bookmarked.

## The dashboard (`/app`)

It answers three questions, in order:

| Question | Module | Behaviour |
|---|---|---|
| How do I quickly save something? | **Quick capture** bar ("Save a link or a thought…") | Opens the capture dialog. Always visible, at every width. |
| What should I look at again? | **Back for you** (`features/dashboard/for-you-now.tsx`) | Up to 3 due reminders and 3 resurfaced items, each linking to its item, plus "All due reminders (n)" and "All resurfaced (n)". It appears only in the default view (Open, no search or filters) and only when something is actually due. It renders nothing while loading or when empty. On an API failure it says so and offers a retry for the part that failed. |
| What have I saved? | **Recently saved**, plus search and filters | Newest first. Search and filters by status, category, tag and date live in the URL (`docs/SEARCH.md`). |

- **Empty states:**
  - A new user sees "Your inbox is empty" with **Save your first link or thought**.
  - The Done and Archived filters explain what belongs there.
  - When nothing matches, the page offers **Clear filters**.
- **Context is kept:** opening an item and choosing **Inbox** returns to the same search and filters.

## Settings (`/app/settings`)

| Section | Contents | Saved to |
|---|---|---|
| Account | Display name, email (read-only), time zone (with "Use <browser zone>") | `PATCH /me` |
| Reminders | Show my reminders; quiet hours (from and until) | `preferences.reminders` |
| Resurfacing | Suggestions switch, how often, bring back items I haven't looked at | `preferences.resurfacing` |
| Accessibility | **Reduce motion**: shown at once, reverted if saving fails | `preferences.reduce_motion` |
| Session | Sign out on this device | Better Auth |
| Delete account | Password-confirmed. Removes every item, reminder and setting. | Better Auth and `DELETE /me` |

**Reduce motion** applies across the app. The app sets `data-reduce-motion="true"` on `<html>`, and `globals.css` treats that like the system `prefers-reduced-motion` setting (animations and transitions off). Scripted motion also checks it through `lib/motion.ts`: for example, the capture confirmation pulse is skipped. The device's own setting always applies as well.

## States

Every data view has loading, error, empty and success states:
- **Loading:** skeletons shaped like the list they replace.
- **Errors:** plain words that say the data is safe, plus **Try again**.
- **Success:** "Saved." notes and toasts with **Undo** where an action can be reversed.

## Development note

`devIndicators: false` in `next.config.ts`: in development, the Next.js dev-tools badge covered the first tab of the phone tab bar. Error overlays still appear.

## Tests

| Layer | File | Covers |
|---|---|---|
| Unit | `src/features/dashboard/for-you-now.test.tsx` (7) | Back for you renders nothing when empty or loading; lists real reminders and resurfaced items with links and "All …" counts; an API failure shows a message and retries only the failed part; quick capture opens; reduce motion follows the Settings choice and the system setting |
| End to end | `e2e/dashboard.spec.ts`, run at **mobile (390 px), tablet (768 px) and desktop (1440 px)** | Protected pages redirect to sign in with `next`; the new-user empty state with no invented content; quick capture; the URL-backed Done filter; search kept after visiting an item; every area reachable from the visible navigation; display name, time zone and reduce motion persist across a reload (and `data-reduce-motion` is applied); a 500 from the API shows "Your inbox did not load" and **Try again** recovers; the account is deleted afterwards |
