"use client";

import { useEffect } from "react";

const KIT_SCRIPTS = ["/assets/system.js", "/assets/motion/motion.js", "/assets/layout/layout.js", "/assets/scenes/scenes.js"];

/**
 * Loads the Taste Skill runtime (nav sheet, hover/press layer, hero entrance, UI fragments, moments, the scene)
 * after React has hydrated, so the kit's DOM changes never race hydration. The landing page is
 * static server markup, so React does not re-render the nodes the kit touches.
 */
export function TasteKit() {
  useEffect(() => {
    const added = KIT_SCRIPTS.filter((src) => !document.querySelector(`script[src="${src}"]`)).map((src) => {
      const el = document.createElement("script");
      el.type = "module";
      el.src = src;
      document.body.appendChild(el);
      return el;
    });
    return () => added.forEach((el) => el.remove());
  }, []);
  return null;
}
