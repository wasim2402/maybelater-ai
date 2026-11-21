/*
  MaybeLater AI landing page, built with the Taste Skill kit (public/assets) plus GSAP and Lenis.

  1  kind: software (an AI app; page type software, site-kind software)
  2  deal: hero collage · nav nav-cards · footer footer-columns · close close-type · buttons tonal ·
     mark dots · type host (Host Grotesk + JetBrains Mono) · radius soft · lit ground sage ·
     rhythm dark-band (dealt space; the brief asks for charcoal cinematic sections) ·
     palette: the client's own colours (sage, paper, beige, warm ink; dealt cool-grey-cobalt not used):
     the brand board the app already wears, so the page and the product read as one ·
     scene product-assembles-into-its-action in #demo (the page's one effect) ·
     moments: word-highlight in #promise; line-carries-colour was dealt and is replaced by the brief's
     chaos-to-clarity transition in #problem (GSAP ScrollTrigger, the brief's required tool), kept to
     the moment rules: its own section, sticky inside it, scrubbed, finished at both ends, still on a
     phone and under reduced motion · Aceternity Spotlight as the hero frame's one soft light.
  Voice: sensory facts, second person, present tense (copy-registers.md 7). Pairs: specific, not cute;
     warm, not sentimental. Person: "you"; MaybeLater is the subject of feature lines; "we" only in the
     privacy rows. Sentences 8 to 16 words. Humour: none. House words: save, list, reason, bring back,
     snooze, done. Never: virtue words, puns on the name, invented numbers.
  Screens at 1440 (beats: problem, promise, demo; a calm section between each; the back third calm):
     hero 1 · problem 2 live (1 at rest) · intro (app-frame) 1 · promise (statement) 1 ·
     journey (tabs-tour) 1 · demo (scene) 2 live (1 at rest) · rediscover (dark band, three cards) 1 ·
     search (split-text-left) 1 · privacy (rows) 1 · footer.closing 1
  Why it moves: hero entrance: the claim arrives, then what to do · spotlight: the frame lights once ·
     hero card loop: an item saved, understood, back on Saturday · problem: scattered saved things
     become one list · promise: the promise lights word by word · demo: one article goes from tab to
     done · tabs: click only · hover: every link and button answers.
  Plain server markup: the kit scripts load after hydration (./taste-kit.tsx); the one client island is
  the problem story (src/components/landing/problem-story.tsx).
*/

import { ProblemStory } from "@/components/landing/problem-story";
import { Spotlight } from "@/components/landing/spotlight";

import { SmoothScroll } from "./smooth-scroll";
import { TasteKit } from "./taste-kit";

const MAIN_ACTION = "Start remembering";
const SIGNUP = "/signup";

const Arrow = () => (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true">
    <path className="m-arrow__stem" d="M1 6h8" />
    <path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" />
  </svg>
);

const Icon = ({ d }: { d: string }) => (
  <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICON = {
  inbox: "M2.5 9h3l1 1.5h3l1-1.5h3M2.5 9 4 3.5h8L13.5 9v3.5h-11z",
  back: "M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5",
  clock: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3l2 1.5",
  done: "m3.5 8.4 2.8 2.8 6.2-6.4",
  bell: "M8 2.5a4 4 0 0 0-4 4v3l-1 2h10l-1-2v-3a4 4 0 0 0-4-4zM6.5 13.5h3",
  link: "M6.5 9.5l3-3M5 7.5 3.8 8.7a2.3 2.3 0 0 0 3.3 3.3L8.3 10.8M11 8.5l1.2-1.2a2.3 2.3 0 0 0-3.3-3.3L7.7 5.2",
  note: "M4 2.5h6l2 2v9H4zM6 7h4M6 9.5h4",
};

/* The hero window's rows: [list, avatar tone, title, note, status] */
const HERO_ROWS: [string, string, string, string, "back" | "saved" | "done"][] = [
  ["Places", "3", "Camping at Lake Gjende", "A weekend away in the summer", "back"],
  ["Reading", "1", "How sleep works, a long read", "For a slow Sunday evening", "back"],
  ["Food", "2", "Ramen bar near the station", "Next time you are in town", "saved"],
  ["Learning", "5", "Learn three guitar chords", "The guitar by the wall", "saved"],
  ["To buy", "4", "Rain jacket, compare two", "Before the trip", "saved"],
  ["Watch", "2", "Night trains of Europe", "Watch with the family", "done"],
  ["Ideas", "5", "A newsletter about small museums", "Draft the first issue", "saved"],
];

/* The app frame's list: [initials, tone, list, title, when, status] */
const APP_ROWS: [string, string, string, string, string, string?][] = [
  ["Rd", "1", "Reading", "How sleep works, a long read", "Sun", "work"],
  ["Pl", "3", "Places", "Camping at Lake Gjende", "Sat", "work"],
  ["Fd", "2", "Food", "Ramen bar near the station", "2d"],
  ["Lr", "5", "Learning", "Learn three guitar chords", "Mon", "work"],
  ["Bu", "4", "To buy", "Rain jacket, compare two", "3d"],
  ["Wt", "2", "Watch", "Night trains of Europe", "4d", "done"],
  ["Id", "5", "Ideas", "A newsletter about small museums", "5d"],
  ["Pl", "3", "Places", "Tram 28 through Alfama", "1w"],
  ["Rd", "1", "Reading", "Five books for the winter", "1w"],
  ["Ck", "2", "Food", "Weeknight dal, three ways", "2w", "done"],
];

export default function LandingPage() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">
            Skip to content
          </a>
          <a className="nav__logo" href="#top" aria-label="MaybeLater AI">
            <span className="mark" data-mark="dots" aria-hidden="true" />
            <span className="logo__name">
              MaybeLater<span className="logo__ai"> AI</span>
            </span>
          </a>
          <nav className="nav__links" aria-label="Main">
            <div className="nav__item">
              <a className="nav__link" href="#intro">
                Product{" "}
                <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <div className="nav__menu">
                <div className="wrap grid">
                  <a className="menu-card span-4" href="#intro">
                    <div className="panel">
                      <div className="ui mc" aria-hidden="true">
                        <span className="mc__label">Inbox · 24 saved</span>
                        <span className="mc__row">
                          <i data-kind="link" />
                          How sleep works, a long read<b>Reading</b>
                        </span>
                        <span className="mc__row">
                          <i data-kind="note" />
                          Learn three guitar chords<b>Learning</b>
                        </span>
                      </div>
                    </div>
                    <span className="t-card">The inbox</span>
                    <span className="t-small muted">Everything you saved, with its reason</span>
                  </a>
                  <a className="menu-card span-4" href="#rediscover">
                    <div className="panel">
                      <div className="ui mc" aria-hidden="true">
                        <span className="mc__label">Resurfaced · 3 today</span>
                        <span className="mc__row mc__row--back">
                          <i data-kind="back" />
                          Camping at Lake Gjende<b>Sat 10:00</b>
                        </span>
                      </div>
                    </div>
                    <span className="t-card">Resurfaced</span>
                    <span className="t-small muted">Items back on the day you chose</span>
                  </a>
                  <a className="menu-card span-4" href="#search">
                    <div className="panel">
                      <div className="ui mc" aria-hidden="true">
                        <span className="mc__search">
                          ital<em>|</em>
                        </span>
                        <span className="mc__row">
                          <i data-kind="link" />
                          Italian phrases for Rome<b>Learning</b>
                        </span>
                      </div>
                    </div>
                    <span className="t-card">Search</span>
                    <span className="t-small muted">Any link or note, by a word in it</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#journey">
                Steps
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#search">
                Search
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#privacy">
                Privacy
              </a>
            </div>
          </nav>
          <div className="nav__actions">
            <a className="nav__link" href="/login">
              Sign in
            </a>
            <a className="btn btn--primary" href={SIGNUP}>
              {MAIN_ACTION}
            </a>
          </div>
          <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <main id="top">
        {/* HERO: collage. The words on span-5; the inbox window on the lit frame, cut by its right and bottom edges. */}
        <section className="hero hero--collage" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <p className="hero__pill">Not now. But not forgotten.</p>
                <h1 id="hero-h">The save-for-later app that remembers why</h1>
                <p className="hero__lead">
                  Save a link or a thought in one field. MaybeLater keeps your original, suggests why you saved it, and brings it
                  back on the day you pick.
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href={SIGNUP}>
                    {MAIN_ACTION}
                    <Arrow />
                  </a>
                  <a className="btn btn--secondary" href="#demo">
                    See how it works
                  </a>
                </div>
                <p className="hero__proof">Snooze to tomorrow 9:00, Saturday 10:00 or next Monday.</p>
              </div>
              <div
                className="hero__art span-6 start-7"
                role="img"
                aria-label="The MaybeLater inbox with saved links and notes, each filed under a list, and a card showing a trip saved on Tuesday coming back on Saturday at 10:00"
              >
                <Spotlight />
                <div className="ly-piece ly-piece--main ui ui-panel ui-win" aria-hidden="true" data-ui="window" data-open="Saved" data-work="Back" data-done="Done">
                  <div className="ui-win__bar">
                    <span className="ui-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="ui-win__crumb">
                      MaybeLater <i>/</i> <b>Inbox</b>
                    </span>
                  </div>
                  <div className="ui-win__body">
                    <nav className="ui-win__side" aria-hidden="true">
                      <span className="ui-win__nav is-on">
                        <Icon d={ICON.inbox} />
                        Inbox<em>24</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.back} />
                        Resurfaced<em>3</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.bell} />
                        Reminders<em>1</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.done} />
                        Done
                      </span>
                    </nav>
                    <div className="ui-win__main hw">
                      <ul className="hw__rows">
                        {HERO_ROWS.map(([list, tone, title, note, st], i) => (
                          <li className="hw__row" key={i}>
                            <span className="ui-avatar" data-tone={tone}>
                              {list.slice(0, 2)}
                            </span>
                            <span className="hw__text">
                              <b>{title}</b>
                              <small>{note}</small>
                            </span>
                            <span className={`hw__chip${st === "back" ? " is-back" : st === "done" ? " is-done" : ""}`}>
                              {st === "back" ? (i === 0 ? "Back Sat" : "Back Sun") : st === "done" ? "Done" : list}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="ly-piece ly-piece--note hc" aria-hidden="true" data-ly-steps="700">
                  <div className="hc__head">
                    <b>Camping at Lake Gjende</b>
                    <span className="hc__chip" data-step data-step-at="3">
                      Back Sat
                    </span>
                  </div>
                  <div className="hc__line" data-step>
                    <i>
                      <Icon d={ICON.link} />
                    </i>
                    <span>
                      Saved <b>Tuesday 21:14</b> from a link
                    </span>
                  </div>
                  <div className="hc__line" data-step>
                    <i>
                      <Icon d={ICON.done} />
                    </i>
                    <span>
                      Reason kept: <b>a weekend away</b>
                    </span>
                  </div>
                  <div className="hc__line" data-step>
                    <i>
                      <Icon d={ICON.clock} />
                    </i>
                    <span>
                      Back on <b>Saturday at 10:00</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM: scattered saved things become one list (GSAP, sticky inside its own section). */}
        <ProblemStory />

        {/* APP FRAME: the inbox list beside the open item, in one window. */}
        <section className="section" id="intro" aria-labelledby="intro-h">
          <div className="wrap">
            <div className="grid grid--top">
              <h2 id="intro-h" className="span-5">
                Meet your personal intention manager.
              </h2>
              <div className="span-6 start-7 stack-4">
                <p>
                  MaybeLater keeps what you save, notes why it mattered, files it under a list and brings it back on the day you
                  choose. Open any item to see your original, untouched.
                </p>
                <a className="link" href="#journey">
                  See the five steps
                </a>
              </div>
            </div>
            <div
              className="ui app fill"
              role="img"
              aria-label="The MaybeLater inbox: saved links and notes on the left; on the right the open item with its suggested reason, summary, list and the day it comes back"
              data-ui-pause-host
            >
              <div className="app__pane app__pane--list">
                <div className="ui ui-panel ui-win" data-ui="window" data-open="Saved" data-work="Back" data-done="Done">
                  <div className="ui-win__bar">
                    <span className="ui-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="ui-win__crumb">
                      MaybeLater <i>/</i> <b>Inbox</b>
                    </span>
                    <span className="ui-spacer" />
                    <span className="ui-win__search" aria-hidden="true">
                      <svg className="ui-icon" viewBox="0 0 16 16">
                        <circle cx="7" cy="7" r="4.5" />
                        <path d="m10.5 10.5 3 3" />
                      </svg>
                      <span className="ui-win__ph">Search</span>
                      <span className="ui-kbd">/</span>
                    </span>
                  </div>
                  <div className="ui-win__body">
                    <nav className="ui-win__side" aria-hidden="true">
                      <span className="ui-win__nav is-on">
                        <Icon d={ICON.inbox} />
                        Inbox<em>24</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.back} />
                        Resurfaced<em>3</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.bell} />
                        Reminders<em>1</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d={ICON.done} />
                        Done
                      </span>
                      <span className="ui-win__label">Lists</span>
                      <span className="ui-win__nav">
                        <span className="ui-win__hash">#</span>Reading
                      </span>
                      <span className="ui-win__nav">
                        <span className="ui-win__hash">#</span>Places
                      </span>
                    </nav>
                    <div className="ui-win__main">
                      <div className="ui-win__cols" aria-hidden="true">
                        <span>List</span>
                        <span>Saved item</span>
                        <span>Status</span>
                        <span>When</span>
                      </div>
                      <ul className="ui-win__rows">
                        {APP_ROWS.map(([initials, tone, list, title, when, st], i) => (
                          <li className="ui-win__row" data-row key={i}>
                            <span className="ui-avatar" data-tone={tone}>
                              {initials}
                            </span>
                            <span className="ui-win__who">{list}</span>
                            <span className="ui-win__sub">{title}</span>
                            <span className={`ui-win__st${st === "work" ? " is-you" : st === "done" ? " is-done" : ""}`} data-st>
                              {st === "work" ? "Back" : st === "done" ? "Done" : "Saved"}
                            </span>
                            <span className="ui-win__age">{when}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="app__pane app__pane--open" data-ui-loop>
                <div className="ui ui-doc" data-ui="doc">
                  <article className="ui-doc__page">
                    <div className="ui-doc__label">Saved Tuesday from a link · sleepfoundation.example</div>
                    <div className="ui-doc__title">How sleep works, a long read</div>
                    <div className="ui-doc__text">
                      Why you saved it: <mark className="ui-doc__mark is-on">to read on a slow Sunday evening</mark>, while you sort out
                      your own sleep.
                    </div>
                    <div className="ui-doc__text">
                      Summary: the stages of a night&rsquo;s sleep, why the first hours matter most, and what light and coffee do to
                      both.
                    </div>
                    <div className="ui-doc__text">
                      List: Reading. Tags: sleep, health.{" "}
                      <mark className="ui-doc__mark" data-kind="Bring it back" data-msg="Back on Sunday at 19:00, set by you." data-where="Snooze or change it any time">
                        Back on Sunday at 19:00
                      </mark>
                      .
                    </div>
                    <div className="ui-doc__text">Your original link is kept exactly as you pasted it, with the day you saved it.</div>
                  </article>
                  <aside className="ui-doc__note ui-panel is-on" aria-live="polite">
                    <div className="ui-doc__kind">
                      <span className="ui-doc__dot" />
                      <span data-doc-kind>Suggested</span>
                    </div>
                    <div className="ui-doc__msg" data-doc-msg>
                      You saved this for a slow evening. Keep this reason?
                    </div>
                    <div className="ui-doc__where" data-doc-where>
                      Keep, edit or drop it
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATEMENT: the dealt word-highlight moment, one statement in its own section. */}
        <section className="section statement" id="promise" data-moment="word-highlight" aria-label="The promise">
          <div className="wrap">
            <p className="mo-wh__text promise__text">
              You don&rsquo;t have to do everything now. You just shouldn&rsquo;t have to <strong>remember</strong> everything yourself.
            </p>
          </div>
        </section>

        {/* TABS TOUR: five steps, one screen each, click only. */}
        <section className="section" id="journey" aria-labelledby="journey-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <div className="section-head">
                  <h2 id="journey-h">From saved to done in five steps</h2>
                </div>
                <div className="tabs" role="tablist" aria-label="Steps">
                  <button className="tab" role="tab" type="button" id="t-capture" aria-selected="true" aria-controls="p-capture s-capture">
                    Save a link
                  </button>
                  <button className="tab" role="tab" type="button" id="t-understand" aria-selected="false" aria-controls="p-understand s-understand">
                    Check the reason
                  </button>
                  <button className="tab" role="tab" type="button" id="t-organize" aria-selected="false" aria-controls="p-organize s-organize">
                    Sort into lists
                  </button>
                  <button className="tab" role="tab" type="button" id="t-rediscover" aria-selected="false" aria-controls="p-rediscover s-rediscover">
                    Get it back
                  </button>
                  <button className="tab" role="tab" type="button" id="t-complete" aria-selected="false" aria-controls="p-complete s-complete">
                    Mark it done
                  </button>
                </div>
                <div className="tour__panels">
                  <div className="tour__panel" role="tabpanel" id="p-capture" aria-labelledby="t-capture">
                    <p className="t-card">Save anything without leaving the moment.</p>
                    <p>Paste a link or type a thought into one field. MaybeLater stores your original before anything else runs.</p>
                  </div>
                  <div className="tour__panel" role="tabpanel" id="p-understand" aria-labelledby="t-understand" hidden>
                    <p className="t-card">MaybeLater suggests why you saved it.</p>
                    <p>A title, a summary, a list, tags and the reason. Each one waits for you to keep, edit or drop it.</p>
                  </div>
                  <div className="tour__panel" role="tabpanel" id="p-organize" aria-labelledby="t-organize" hidden>
                    <p className="t-card">Everything finds its list.</p>
                    <p>Reading, Places, To buy and the lists you make, plus your own tags. Filter by any of them in one click.</p>
                  </div>
                  <div className="tour__panel" role="tabpanel" id="p-rediscover" aria-labelledby="t-rediscover" hidden>
                    <p className="t-card">Good ideas get another chance.</p>
                    <p>Pick a day and the item comes back under Resurfaced, with the reason it came back.</p>
                  </div>
                  <div className="tour__panel" role="tabpanel" id="p-complete" aria-labelledby="t-complete" hidden>
                    <p className="t-card">Someday becomes something you did.</p>
                    <p>Mark it done and it moves to Done, where everything you finished stays to look back on.</p>
                  </div>
                </div>
              </div>
              <div className="frame frame--split span-6 start-7 tour__frame">
                <div className="stage">
                <div className="tour__screen" id="s-capture" role="img" aria-label="The save field holding a pasted link, with Save for later">
                  <div className="ui ts">
                    <p className="ts__label">Link or thought</p>
                    <p className="ts__paste">https://maps.example/lake-gjende-campsite</p>
                    <p className="ts__note">Note · for a weekend away in the summer</p>
                    <div className="ts__row">
                      <span className="ts__saved">
                        <Icon d={ICON.done} /> Saved to your inbox
                      </span>
                      <span className="ts__btn">Save for later</span>
                    </div>
                  </div>
                </div>
                <div className="tour__screen" id="s-understand" role="img" aria-label="Suggested title, reason and tags for the saved link, one kept and two waiting" hidden>
                  <div className="ui ts">
                    <p className="ts__title">Camping at Lake Gjende</p>
                    <div className="ts__sug is-kept">
                      <span>Title</span>
                      <b>Kept</b>
                      <p>Camping at Lake Gjende</p>
                    </div>
                    <div className="ts__sug">
                      <span>Why you saved it</span>
                      <b>Suggested</b>
                      <p>A weekend away when the summer comes</p>
                    </div>
                    <div className="ts__sug">
                      <span>Tags</span>
                      <b>Suggested</b>
                      <p>norway, camping, summer</p>
                    </div>
                    <div className="ts__row">
                      <span className="ts__btn ts__btn--quiet">Edit</span>
                      <span className="ts__btn">Keep all</span>
                    </div>
                  </div>
                </div>
                <div className="tour__screen" id="s-organize" role="img" aria-label="Saved items grouped under the lists Places, Reading and To buy" hidden>
                  <div className="ui ts">
                    <div className="ts__lists">
                      <span className="is-on">All 24</span>
                      <span>Places 6</span>
                      <span>Reading 9</span>
                      <span>To buy 3</span>
                    </div>
                    <p className="ts__group">Places</p>
                    <p className="ts__item">
                      Camping at Lake Gjende <em>#norway</em>
                    </p>
                    <p className="ts__item">
                      Tram 28 through Alfama <em>#lisbon</em>
                    </p>
                    <p className="ts__group">Reading</p>
                    <p className="ts__item">
                      How sleep works, a long read <em>#sleep</em>
                    </p>
                    <p className="ts__item">
                      Five books for the winter <em>#books</em>
                    </p>
                  </div>
                </div>
                <div className="tour__screen" id="s-rediscover" role="img" aria-label="A resurfaced item with the reason it came back and actions to snooze or mark it done" hidden>
                  <div className="ui ts">
                    <p className="ts__reason">
                      <Icon d={ICON.back} /> You asked to see this again today.
                    </p>
                    <p className="ts__title">Camping at Lake Gjende</p>
                    <p className="ts__note">Places · a weekend away in the summer</p>
                    <div className="ts__row">
                      <span className="ts__btn ts__btn--quiet">Snooze</span>
                      <span className="ts__btn ts__btn--quiet">Not now</span>
                      <span className="ts__btn">Done</span>
                    </div>
                  </div>
                </div>
                <div className="tour__screen" id="s-complete" role="img" aria-label="The Done list with finished items and the day each was finished" hidden>
                  <div className="ui ts">
                    <div className="ts__lists">
                      <span>Open 21</span>
                      <span className="is-on">Done 12</span>
                      <span>Archived 4</span>
                    </div>
                    <p className="ts__item is-done">
                      Camping at Lake Gjende <em>Done 9 Jun</em>
                    </p>
                    <p className="ts__item is-done">
                      Night trains of Europe <em>Done 2 Jun</em>
                    </p>
                    <p className="ts__item is-done">
                      Weeknight dal, three ways <em>Done 28 May</em>
                    </p>
                    <p className="ts__item is-done">
                      Learn three guitar chords <em>Done 14 May</em>
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SCENE: product-assembles-into-its-action. One article from tab to done, then the one action. */}
        <section className="sc" id="demo" data-big-scene="product-assembles-into-its-action" data-big-scene-opts='{"hold":1}' style={{ "--h": 1 } as React.CSSProperties} aria-labelledby="pa-h">
          <div className="sc__stage">
            <div className="pa__copy">
              <h2 id="pa-h">One article, saved to read later, then done</h2>
              <ol className="pa__steps">
                <li>A long read you found at lunch</li>
                <li>Saved with one paste</li>
                <li>A title, reason and tags suggested</li>
                <li>Filed under Reading, back on Sunday</li>
                <li>Back on Sunday. You read it.</li>
              </ol>
              <p className="pa__close">From someday to done.</p>
              <a className="sc__skip" href="#rediscover">
                Skip
              </a>
            </div>
            <div className="pa__screen ds" data-ui="" role="img" aria-label="A saved article in MaybeLater gaining its suggestions, its list and its day to come back, then marked as done">
              <div className="pa__row">
                <div className="ds__head">
                  <span>
                    <Icon d={ICON.link} /> sleepfoundation.example/how-sleep-works
                  </span>
                  <small>24 min read</small>
                </div>
              </div>
              <div className="pa__row" data-at="2">
                <div className="ds__saved">
                  <Icon d={ICON.done} /> Saved to your inbox <small>Tue 12:40</small>
                </div>
              </div>
              <div className="pa__row" data-at="3">
                <div className="ds__field">
                  <span>Title</span>How sleep works, a long read
                </div>
              </div>
              <div className="pa__row" data-at="3">
                <div className="ds__field">
                  <span>Why you saved it</span>To read on a slow Sunday evening
                </div>
              </div>
              <div className="pa__row" data-at="3">
                <div className="ds__field">
                  <span>Tags</span>sleep, health
                </div>
              </div>
              <div className="pa__row" data-at="4">
                <div className="ds__field">
                  <span>List</span>Reading
                </div>
              </div>
              <div className="pa__row" data-at="4">
                <div className="ds__field ds__field--back">
                  <span>Back on</span>Sunday at 19:00
                </div>
              </div>
              <div className="pa__row pa__row--action">
                <button type="button" data-at="5" data-action>
                  Mark as done
                </button>
                <span className="ds__done" data-at="5">
                  <i />
                  Done Sunday 21:05
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* DARK BAND: three items coming back, each with its reason and the user's choices. */}
        <section className="section ground-inverse" id="rediscover" aria-labelledby="re-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="re-h">
                Not everything needs your attention today.{" "}
                <span className="muted">Saved for later, each one comes back on the day you picked, with the reason.</span>
              </h2>
            </div>
            <div className="grid">
              <article className="card card--open span-4 rc">
                <div className="panel rc__photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- plain kit markup: the Taste Skill checks read these attributes */}
                  <img
                    className="frame__img"
                    src="/assets/img/landing/photo-f593800-960.jpg"
                    srcSet="/assets/img/landing/photo-f593800-500.jpg 500w, /assets/img/landing/photo-f593800-960.jpg 960w"
                    sizes="(max-width: 639px) 92vw, (max-width: 1023px) 92vw, 30vw"
                    width={960}
                    height={720}
                    alt="A tent on the shore of a mountain lake in Norway"
                    loading="lazy"
                    decoding="async"
                    data-source="stand-in"
                    data-subject="a trip someone saved"
                  />
                </div>
                <p className="rc__reason">You saved this for &ldquo;this weekend&rdquo;, and it&rsquo;s the weekend.</p>
                <p className="t-card">Camping at Lake Gjende</p>
                <p className="rc__actions" aria-hidden="true">
                  <span>Snooze</span>
                  <span>Not now</span>
                  <span className="is-main">Done</span>
                </p>
              </article>
              <article className="card card--open span-4 rc">
                <div className="panel rc__photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- plain kit markup: the Taste Skill checks read these attributes */}
                  <img
                    className="frame__img rc__crop"
                    src="/assets/img/landing/photo-f31612287-960.jpg"
                    srcSet="/assets/img/landing/photo-f31612287-500.jpg 500w, /assets/img/landing/photo-f31612287-960.jpg 960w"
                    sizes="(max-width: 1023px) 130vw, 45vw"
                    width={960}
                    height={711}
                    alt="An acoustic guitar leaning against a white wall"
                    loading="lazy"
                    decoding="async"
                    data-source="stand-in"
                    data-subject="a skill someone wants to learn"
                  />
                </div>
                <p className="rc__reason">You asked to see this again today.</p>
                <p className="t-card">Learn three guitar chords</p>
                <p className="rc__actions" aria-hidden="true">
                  <span>Snooze</span>
                  <span>Not now</span>
                  <span className="is-main">Done</span>
                </p>
              </article>
              <article className="card card--open span-4 rc">
                <div className="panel rc__note" role="img" aria-label="A saved idea: a newsletter about small museums, with a short note">
                  <div className="ui rn">
                    <p className="rn__label">
                      <Icon d={ICON.note} /> Idea · saved in March
                    </p>
                    <p className="rn__text">A newsletter about small museums. One museum a month, three things worth the trip, and how to get there by train.</p>
                  </div>
                </div>
                <p className="rc__reason">Your snooze ended yesterday.</p>
                <p className="t-card">A newsletter about small museums</p>
                <p className="rc__actions" aria-hidden="true">
                  <span>Snooze</span>
                  <span>Not now</span>
                  <span className="is-main">Done</span>
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* SPLIT: search, the words left and the search screen right. */}
        <section className="section" id="search" aria-labelledby="search-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="search-h">Find anything you saved in MaybeLater</h2>
                <p className="t-lead">
                  Search titles, notes and links. Type the start of a word and matches appear as you type; narrow them by list,
                  tag, status or date.
                </p>
                <ul className="rows">
                  <li>
                    <span className="rows__name">Searches</span>
                    <span className="rows__value">Titles, notes, summaries, links</span>
                  </li>
                  <li>
                    <span className="rows__name">Filters</span>
                    <span className="rows__value">List, tag, status, date saved</span>
                  </li>
                  <li>
                    <span className="rows__name">Keeps</span>
                    <span className="rows__value">Your search in the link you share</span>
                  </li>
                </ul>
              </div>
              <div className="frame frame--split span-6 start-7 search__frame" role="img" aria-label="A search for the word ai, showing four saved items that match, with list and tag filters above">
                <div className="stage">
                <div className="ui ss">
                  <div className="ss__field">
                    <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="7" cy="7" r="4.5" />
                      <path d="m10.5 10.5 3 3" />
                    </svg>
                    <span>
                      ai<em>|</em>
                    </span>
                    <small>4 found</small>
                  </div>
                  <div className="ss__filters">
                    <span className="is-on">Open</span>
                    <span>All lists</span>
                    <span>#ai</span>
                    <span>Last 30 days</span>
                  </div>
                  <ul className="ss__rows">
                    <li>
                      <b>
                        How <mark>AI</mark> models read a page
                      </b>
                      <small>Reading · saved 3 days ago</small>
                    </li>
                    <li>
                      <b>
                        <mark>AI</mark> for small museums, a talk
                      </b>
                      <small>Watch · saved last week</small>
                    </li>
                    <li>
                      <b>
                        Build a recipe finder with <mark>AI</mark>
                      </b>
                      <small>Ideas · saved in October</small>
                    </li>
                    <li>
                      <b>
                        Prompting notes <mark>ai</mark>-course
                      </b>
                      <small>Learning · saved in September</small>
                    </li>
                  </ul>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROWS: privacy, as plain facts. */}
        <section className="section" id="privacy" aria-labelledby="privacy-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="privacy-h">
                  Your memories belong to you. <span className="muted">Privacy, in plain words.</span>
                </h2>
                <p className="t-lead">What happens to what you save, from the moment you save it.</p>
                <div className="frame pv" role="img" aria-label="A saved link kept exactly as pasted, and a suggested reason waiting beside it with Drop and Keep buttons; nothing is added until one is pressed">
                  <div className="ui pv__card pv__card--kept">
                    <p className="pv__head">
                      <span>Your original</span>
                      <b>Kept as pasted</b>
                    </p>
                    <p className="pv__val pv__val--mono">https://sleepfoundation.example/how-sleep-works</p>
                  </div>
                  <div className="ui pv__card">
                    <p className="pv__head">
                      <span>Why you saved it</span>
                      <b>Suggested</b>
                    </p>
                    <p className="pv__val">To read on a slow Sunday evening</p>
                    <p className="pv__row">
                      <span className="ts__btn ts__btn--quiet">Drop</span>
                      <span className="ts__btn">Keep</span>
                    </p>
                  </div>
                </div>
              </div>
              <ul className="rows rows--privacy span-6 start-7">
                <li>
                  <span className="rows__name">Your original</span>
                  <span className="rows__value">Kept exactly as you saved it. The AI never edits it.</span>
                </li>
                <li>
                  <span className="rows__name">Suggestions</span>
                  <span className="rows__value">Nothing joins an item until you keep it.</span>
                </li>
                <li>
                  <span className="rows__name">The AI</span>
                  <span className="rows__value">To suggest details, what you save and a link&rsquo;s title go to Google Gemini.</span>
                </li>
                <li>
                  <span className="rows__name">Our logs</span>
                  <span className="rows__value">Item ids and error codes, never what you saved.</span>
                </li>
                <li>
                  <span className="rows__name">Notifications</span>
                  <span className="rows__value">Only on devices you turn on, encrypted to your browser.</span>
                </li>
                <li>
                  <span className="rows__name">Leaving</span>
                  <span className="rows__value">Delete your account and everything goes with it.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer closing footer--columns" id="contact" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--type">
            <h2 id="close-h">Whenever you&rsquo;re ready, it&rsquo;ll be here.</h2>
            <p className="t-small muted">Capture the things that matter. Come back when the time is right.</p>
            <a className="btn btn--primary btn--xl btn--wide" href={SIGNUP}>
              {MAIN_ACTION}
              <Arrow />
            </a>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-4 stack-4">
                <a className="nav__logo" href="#top">
                  <span className="mark" data-mark="dots" aria-hidden="true" />
                  MaybeLater AI
                </a>
                <p className="footer__lede">The save-for-later app that remembers why.</p>
              </div>
              <div className="span-2 footer__col">
                <h3>Product</h3>
                <ul>
                  <li>
                    <a href="#intro">The inbox</a>
                  </li>
                  <li>
                    <a href="#demo">The demo</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Steps</h3>
                <ul>
                  <li>
                    <a href="#journey">Five steps</a>
                  </li>
                  <li>
                    <a href="#rediscover">Resurfaced</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Search</h3>
                <ul>
                  <li>
                    <a href="#search">Find anything</a>
                  </li>
                  <li>
                    <a href="/login">Sign in</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Privacy</h3>
                <ul>
                  <li>
                    <a href="#privacy">Your data</a>
                  </li>
                  <li>
                    <a href="mailto:hello@maybelater.example">Email us</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="footer__legal">
              <span>&copy; 2026 MaybeLater AI</span>
              <div className="socials" />
              <details className="credits">
                <summary>Photographs via Wikimedia Commons</summary>
                <ul>
                  <li>
                    <a href="https://commons.wikimedia.org/wiki/File:Tram_on_Rua_Paiva_de_Andrade,_Lisbon_Portugal_-_2008.jpg">Tram on Rua Paiva de Andrade, Lisbon Portugal - 2008</a> by wampile, <a href="https://creativecommons.org/publicdomain/mark/1.0/">Public domain</a>
                  </li>
                  <li>
                    <a href="https://commons.wikimedia.org/wiki/File:Ramen_Bowl_2.jpg">Ramen Bowl 2</a> by Shisma, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>
                  </li>
                  <li>
                    <a href="https://commons.wikimedia.org/wiki/File:Books_in_stack_with_lamps_(Unsplash).jpg">Books in stack with lamps (Unsplash)</a> by chuttersnap chuttersnap, <a href="http://creativecommons.org/publicdomain/zero/1.0/deed.en">CC0</a>
                  </li>
                  <li>
                    <a href="https://commons.wikimedia.org/wiki/File:Camping_at_Gjende.jpg">Camping at Gjende</a> by Unknown author, <a href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>
                  </li>
                  <li>
                    <a href="https://commons.wikimedia.org/wiki/File:Acoustic_Guitar_2.jpg">Acoustic Guitar 2</a> by Johnnydeezwax, <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a> (adapted)
                  </li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      </footer>
      {/* Mounted last, inside the page: their effects run only after this markup has hydrated. */}
      <TasteKit />
      <SmoothScroll />
    </>
  );
}
