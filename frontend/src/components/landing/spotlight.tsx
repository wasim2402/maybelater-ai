/**
 * Spotlight, adapted from Aceternity UI (https://ui.aceternity.com/components/spotlight).
 *
 * The same SVG light as the original (one blurred ellipse, its fill and opacity unchanged), drawn as the
 * CSS background of a pseudo-element (`.lp-spotlight::before` in marketing.css) instead of an inline
 * <svg>: the landing page doesn't load Tailwind, and as a background it stays out of the page's layout
 * checks (it is light, not a panel). Timing shortened so it settles inside the hero's entrance (about
 * 1.4 s instead of 2.75 s); it plays once on load and rests at full light under reduced motion.
 */
export function Spotlight({ className = "" }: { className?: string }) {
  return <div className={`lp-spotlight ${className}`} aria-hidden="true" />;
}
