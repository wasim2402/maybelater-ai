/**
 * MaybeLater fonts: the ONE place to change typefaces (Google Fonts via next/font).
 *
 * To swap a font:
 *   1. Import a different family from "next/font/google" (e.g. `IBM_Plex_Sans`, `Fraunces`).
 *   2. Keep each `variable` name as it is (`--font-brand-display`, `--font-brand-text`, `--font-brand-mono`).
 *   3. If the new display face wants another weight or tracking, change `--brand-display-*` in tokens.css.
 * src/theme/tokens.css maps these variables to roles, so no component or page needs editing.
 * To use one family for everything, point `display` and `text` at the same loader call.
 *
 * Current pairing, dealt by the Taste Skill for a software product: Gabarito (headings),
 * Figtree (text) and DM Mono (code and shortcuts).
 */
import { DM_Mono, Figtree, Gabarito } from "next/font/google";

const display = Gabarito({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-brand-display",
  display: "swap",
});

const text = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-brand-text",
  display: "swap",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-brand-mono",
  display: "swap",
});

/** Class names that define the font CSS variables. Put them on <html>. */
export const fontVariables = [display.variable, text.variable, mono.variable].join(" ");
