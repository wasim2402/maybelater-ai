/**
 * Reduced motion: the system setting, or the user's own choice in Settings (stored on the account,
 * applied as `data-reduce-motion="true"` on <html>, which globals.css honours like the media query).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.dataset.reduceMotion === "true") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyMotionPreference(reduce: boolean): void {
  if (reduce) document.documentElement.dataset.reduceMotion = "true";
  else delete document.documentElement.dataset.reduceMotion;
}
