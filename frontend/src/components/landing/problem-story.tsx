"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * "Your someday list is getting longer": the brief's chaos-to-clarity transition (GSAP ScrollTrigger).
 *
 * Live (768px and wider, motion allowed): the section is two screens; its stage holds still with
 * `position: sticky` inside a track while the scroll scrubs one timeline: the scattered tabs, screenshots
 * and notes travel into the rows of one list. Then the stage lets go and the closing line follows in the
 * page's flow at the section's foot. Scrubbed both ways, finished at both
 * ends, nothing else on the page moves with it. Still (a phone, reduced motion, no script): one screen
 * (two on a phone) showing the finished state: on a phone the scattered things, on wider screens the list.
 */

type Item = {
  kind: "photo" | "video" | "tab" | "note";
  source: string;
  title: string;
  meta?: string;
  img?: { src: string; srcSet: string; alt: string; pos?: string; source: string; subject: string };
  list: string;
  back?: string;
  // the scattered position, in % of the canvas, and a small rotation
  x: number;
  y: number;
  w: number;
  r: number;
};

const ITEMS: Item[] = [
  {
    kind: "photo",
    source: "Screenshot · 3 months ago",
    title: "Tram 28 through Alfama",
    img: {
      src: "/assets/img/landing/photo-f5666280-960.jpg",
      srcSet: "/assets/img/landing/photo-f5666280-500.jpg 500w, /assets/img/landing/photo-f5666280-960.jpg 960w",
      alt: "A red tram on a narrow street in Lisbon",
      pos: "48% 48%",
      source: "stand-in",
      subject: "a place to visit",
    },
    list: "Places",
    back: "Back Sat",
    x: 1, y: 4, w: 23, r: -3,
  },
  { kind: "tab", source: "Open tab · 3 weeks", title: "How sleep works, a long read", meta: "24 min read", list: "Reading", back: "Back Sun", x: 27, y: 0, w: 25, r: 1.5 },
  {
    kind: "photo",
    source: "Saved post",
    title: "Ramen bar near the station",
    img: {
      src: "/assets/img/landing/photo-f100562279-960.jpg",
      srcSet: "/assets/img/landing/photo-f100562279-500.jpg 500w, /assets/img/landing/photo-f100562279-960.jpg 960w",
      alt: "A bowl of ramen with egg and spring onion",
      pos: "50% 55%",
      source: "stand-in",
      subject: "a place to eat",
    },
    list: "Food",
    x: 56, y: 2, w: 21, r: 2.5,
  },
  {
    kind: "photo",
    source: "Wishlist",
    title: "Five books for the winter",
    img: {
      src: "/assets/img/landing/photo-f61756279-960.jpg",
      srcSet: "/assets/img/landing/photo-f61756279-500.jpg 500w, /assets/img/landing/photo-f61756279-960.jpg 960w",
      alt: "A stack of books under a reading lamp",
      pos: "62% 60%",
      source: "stand-in",
      subject: "books to read",
    },
    list: "Reading",
    x: 79, y: 26, w: 20, r: -2,
  },
  { kind: "video", source: "Watch later", title: "Night trains of Europe", meta: "48:12", list: "Watch", back: "Back Fri", x: 10, y: 50, w: 26, r: 2 },
  { kind: "note", source: "Notes", title: "Idea: a newsletter about small museums", list: "Ideas", x: 41, y: 44, w: 24, r: -1.5 },
  { kind: "tab", source: "Bookmark", title: "Learn three guitar chords", meta: "Beginner course", list: "Learning", back: "Back Mon", x: 66, y: 63, w: 22, r: 3 },
  { kind: "tab", source: "Cart", title: "Rain jacket, compare two", meta: "2 tabs", list: "To buy", x: 33, y: 76, w: 22, r: -2.5 },
];

const Play = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.5 4v8l7-4z" fill="currentColor" />
  </svg>
);

export function ProblemStory() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        section.classList.add("is-live");
        const items = gsap.utils.toArray<HTMLElement>(".ps__item", section);
        const rows = gsap.utils.toArray<HTMLElement>(".ps__row", section);
        const panel = section.querySelector<HTMLElement>(".ps__list")!;
        const track = section.querySelector<HTMLElement>(".ps__track")!;
        const stage = section.querySelector<HTMLElement>(".ps__stage")!;

        // Where each scattered item lands: the centre of its row (layout offsets, so transforms never skew it).
        const target = (i: number) => {
          const item = items[i], row = rows[i];
          const fromX = item.offsetLeft + item.offsetWidth / 2, fromY = item.offsetTop + item.offsetHeight / 2;
          const toX = panel.offsetLeft + row.offsetLeft + row.offsetWidth / 2;
          const toY = panel.offsetTop + row.offsetTop + row.offsetHeight / 2;
          return { x: toX - fromX, y: toY - fromY, scale: Math.min(1, row.offsetHeight / item.offsetHeight) };
        };

        gsap.set(panel, { autoAlpha: 0, y: 24 });
        gsap.set(rows, { autoAlpha: 0, y: 8 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + Math.max(1, track.offsetHeight - stage.offsetHeight), scrub: 0.6, invalidateOnRefresh: true },
        });
        tl.to({}, { duration: 0.12 }) // hold the scatter for a moment
          .to(panel, { autoAlpha: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.1);
        items.forEach((item, i) => {
          const at = 0.16 + i * 0.05;
          tl.to(item, { x: () => target(i).x, y: () => target(i).y, scale: () => target(i).scale, rotation: 0, duration: 0.2 }, at)
            .to(item, { autoAlpha: 0, duration: 0.06, ease: "none" }, at + 0.15)
            .to(rows[i], { autoAlpha: 1, y: 0, duration: 0.07, ease: "power2.out" }, at + 0.14);
        });
        tl.to({}, { duration: 0.2 }); // hold the finished list before the stage lets go

        return () => section.classList.remove("is-live");
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="section ps" id="problem" data-moment="chaos-to-clarity" aria-labelledby="problem-h">
      <div className="wrap">
        <div className="ps__track">
        <div className="ps__stage">
          <div className="ps__head">
            <h2 id="problem-h">Your someday list is getting longer.</h2>
            <p className="t-lead ps__lead">A tab open for three weeks. A recipe in your screenshots. A trip in a note you never opened again.</p>
          </div>
          <div className="ps__canvas">
            <div className="ps__scatter" role="img" aria-label="Saved things scattered across open tabs, screenshots, notes and a watch-later list">
              {ITEMS.map((it, i) => (
                <div
                  key={i}
                  className={`ps__item ps__item--${it.kind}`}
                  style={{ "--x": `${it.x}%`, "--y": `${it.y}%`, "--w": `${it.w}%`, "--r": `${it.r}deg` } as React.CSSProperties}
                  aria-hidden="true"
                >
                  <span className="ps__src">{it.source}</span>
                  {it.img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- plain kit markup: the Taste Skill checks read these attributes
                    <img
                      src={it.img.src}
                      srcSet={it.img.srcSet}
                      sizes="(max-width: 767px) 45vw, 22vw"
                      width={960}
                      height={640}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: it.img.pos }}
                      data-source={it.img.source}
                      data-subject={it.img.subject}
                    />
                  ) : it.kind === "video" ? (
                    <span className="ps__video">
                      <span className="ps__play">
                        <Play />
                      </span>
                      <span className="ps__dur">{it.meta}</span>
                    </span>
                  ) : null}
                  <span className="ps__title">{it.title}</span>
                  {it.meta && it.kind !== "video" ? <span className="ps__meta">{it.meta}</span> : null}
                </div>
              ))}
            </div>
            <div className="ps__list ui" role="img" aria-label="The same eight things in one MaybeLater list, each filed under a list, some set to come back on a chosen day">
              <div className="ps__listhead">
                <b>Inbox</b>
                <span>8 saved</span>
              </div>
              <ul>
                {ITEMS.map((it, i) => (
                  <li key={i} className="ps__row">
                    <span className="ps__dot" data-kind={it.kind} aria-hidden="true" />
                    <span className="ps__rowtitle">{it.title}</span>
                    <span className="ps__chip">{it.list}</span>
                    {it.back ? <span className="ps__chip ps__chip--back">{it.back}</span> : <span />}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        </div>
        <div className="ps__turn">
          <p className="ps__turnline">What if later didn&rsquo;t mean forgotten?</p>
          <p>MaybeLater keeps them in one list, each with the reason you saved it.</p>
        </div>
      </div>
    </section>
  );
}
