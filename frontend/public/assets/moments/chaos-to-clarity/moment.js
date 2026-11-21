/*
  chaos-to-clarity - the page's own scroll moment (MaybeLater landing, #problem): scattered saved things
  (tabs, screenshots, notes) travel into the rows of one list, then the closing line arrives.

  Driven by GSAP ScrollTrigger in src/components/landing/problem-story.tsx (the brief asks for GSAP),
  scrubbed to the scrollbar inside its own two-screen section, its stage held with position: sticky,
  finished at both ends. This module only registers the moment with the kit's loader so the page's
  checks read the section as the moment it is; it moves nothing itself.

  Still (a phone, reduced motion, no script): the island shows the finished state; nothing runs here.
*/
export const phone = false;
export default function (root, opts, lib) {
  root.classList.add('mo-ctc');
  return {};
}
