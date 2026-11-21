/*
  MaybeLater landing page, built with the Taste Skill kit (public/assets).
  type: software
  deal: hero split, nav nav-centre (nav-cards dealt; no photographs, so dealt again to nav-centre),
        close close-word, footer footer-dark, rhythm space, buttons arrow, mark wordmark, no grounds
  moments: iris-opens on #suggestions (the one section on the beige surface ground)
  palette: the client's own colours (sage, white, beige, grey) through start.mjs brand
  screens (1440): hero 1 · app 1 · how 1 · suggestions 1 · faq 1 · closing 1; phone: how takes 2
  Plain markup only: the kit scripts are loaded after hydration by ./taste-kit.tsx.
*/

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

const MAIN_ACTION = "Start your list";
const SIGNUP = "/signup";

const ROWS: [string, string, string, string, string, string?][] = [
  ["Ck", "2", "Cooking", "Sourdough starter guide", "Sat", "work"],
  ["Pl", "3", "Places", "Ramen place near the station", "1d"],
  ["Bu", "4", "To buy", "Rain jacket comparison", "Dec 1", "work"],
  ["Rd", "1", "Reading", "A long read on how sleep works", "2d"],
  ["Id", "5", "Ideas", "Birthday trip for Mum, spring", "3d"],
  ["Wt", "2", "Watch", "Documentary on night trains", "4d", "done"],
  ["Rd", "1", "Reading", "Notes on keeping a garden diary", "5d"],
  ["Pl", "3", "Places", "Bookshop with the reading room", "6d"],
  ["Ck", "2", "Cooking", "Weeknight dal, three ways", "1w", "done"],
  ["Bu", "4", "To buy", "Desk lamp for the spare room", "1w"],
];

export default function LandingPage() {
  return (
    <>
      <header className="nav nav--centre">
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">
            Skip to content
          </a>
          <a className="nav__logo" href="#top">
            MaybeLater
          </a>
          <nav className="nav__links" aria-label="Main">
            <div className="nav__item">
              <a className="nav__link" href="#app">
                Inbox
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#how">
                Steps
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#suggestions">
                Suggestions
              </a>
            </div>
            <div className="nav__item">
              <a className="nav__link" href="#faq">
                Questions
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
        {/* HERO: split. Words on span-5, the capture moment on span-6 start-7. */}
        <section className="hero hero--split" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text grid hero__grid">
              <div className="hero__text span-5">
                <h1 id="hero-h">The save-for-later app that remembers why</h1>
                <p className="hero__lead">
                  Paste a link or type a thought. MaybeLater keeps the original, suggests why you saved it, and brings it
                  back on the day you choose.
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href={SIGNUP}>
                    {MAIN_ACTION}
                    <Arrow />
                  </a>
                  <a className="btn btn--secondary" href="#how">
                    See the 3 steps
                  </a>
                </div>
                <dl className="hero-facts">
                  <div>
                    <dt>Saves</dt>
                    <dd>Links and notes</dd>
                  </div>
                  <div>
                    <dt>Suggests</dt>
                    <dd>4 details per item</dd>
                  </div>
                  <div>
                    <dt>Reminds</dt>
                    <dd>Only when you ask</dd>
                  </div>
                </dl>
              </div>
              <div
                className="hero__media span-6 start-7"
                role="img"
                aria-label="A pasted link saved in MaybeLater, with suggested title, reason and reminder waiting to be kept"
              >
                <div className="ui hv">
                  <div className="hv__card">
                    <p className="hv__label">Link or thought</p>
                    <p className="hv__paste">https://bread.example/sourdough-starter-guide</p>
                    <div className="hv__row">
                      <span className="hv__saved">
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                          <path d="m3.5 8.4 2.8 2.8 6.2-6.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        Saved to your inbox
                      </span>
                      <span className="hv__btn">Save for later</span>
                    </div>
                  </div>
                  <div className="hv__group">
                    <p className="hv__label">Suggestions for this link</p>
                    <div className="hv__sugs">
                      <div className="hv__sug hv__sug--kept">
                        <div className="hv__sughead">
                          <span>Title</span>
                          <span className="hv__tag">Kept</span>
                        </div>
                        <p className="hv__val">Sourdough starter guide</p>
                      </div>
                      <div className="hv__sug">
                        <div className="hv__sughead">
                          <span>Why you saved it</span>
                          <span className="hv__tag">Suggested</span>
                        </div>
                        <p className="hv__val">To try a weekend bake once the starter is ready</p>
                      </div>
                      <div className="hv__sug">
                        <div className="hv__sughead">
                          <span>Bring it back</span>
                          <span className="hv__tag">Suggested</span>
                        </div>
                        <p className="hv__val">Saturday at 10:00</p>
                      </div>
                    </div>
                    <div className="hv__row">
                      <span className="hv__btn hv__btn--quiet">Edit</span>
                      <span className="hv__btn">Keep all</span>
                    </div>
                  </div>
                </div>
                <div className="ly-float">
                  <div className="ly-float__row">
                    <span className="ly-live">Saturday</span>
                    <span>10:00</span>
                  </div>
                  <div className="ly-float__title">Back for you: Sourdough starter guide</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* APP FRAME: the inbox list beside the open item, in one window. */}
        <section className="section" id="app" aria-labelledby="app-h">
          <div className="wrap">
            <div className="grid grid--top">
              <h2 id="app-h" className="span-5">
                Saved items with their reasons and reminders
              </h2>
              <div className="span-6 start-7 stack-4">
                <p>
                  Every item shows what you saved, why you saved it and when it comes back. Open one to see the original
                  untouched.
                </p>
                <a className="link" href="#faq">
                  Read the common questions
                </a>
              </div>
            </div>
            <div
              className="ui app fill"
              role="img"
              aria-label="The MaybeLater inbox: saved links and notes on the left, the open item with its reason and reminder on the right"
              data-ui-pause-host
            >
              <div className="app__pane app__pane--list">
                <div className="ui ui-panel ui-win" data-ui="window" data-open="Saved" data-work="Due" data-done="Done">
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
                        <Icon d="M2.5 9h3l1 1.5h3l1-1.5h3M2.5 9 4 3.5h8L13.5 9v3.5h-11z" />
                        Inbox<em>24</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d="M8 2.5a4 4 0 0 0-4 4v3l-1 2h10l-1-2v-3a4 4 0 0 0-4-4zM6.5 13.5h3" />
                        Resurfaced<em>3</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3l2 1.5" />
                        Snoozed<em>2</em>
                      </span>
                      <span className="ui-win__nav">
                        <Icon d="m3.5 8.4 2.8 2.8 6.2-6.4" />
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
                        {ROWS.map(([initials, tone, list, title, when, st], i) => (
                          <li className="ui-win__row" data-row key={i}>
                            <span className="ui-avatar" data-tone={tone}>
                              {initials}
                            </span>
                            <span className="ui-win__who">{list}</span>
                            <span className="ui-win__sub">{title}</span>
                            <span
                              className={`ui-win__st${st === "work" ? " is-you" : st === "done" ? " is-done" : ""}`}
                              data-st
                            >
                              {st === "work" ? "Due" : st === "done" ? "Done" : "Saved"}
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
                    <div className="ui-doc__label">Saved Tuesday from a link</div>
                    <div className="ui-doc__title">Sourdough starter guide</div>
                    <div className="ui-doc__text">
                      Why you saved it:{" "}
                      <mark className="ui-doc__mark is-on">to try a weekend bake</mark> once the starter is ready.
                    </div>
                    <div className="ui-doc__text">
                      Summary: how to feed a starter for seven days, how to tell it is ready, and a first loaf for a
                      Saturday morning.
                    </div>
                    <div className="ui-doc__text">
                      List: Cooking.{" "}
                      <mark
                        className="ui-doc__mark"
                        data-kind="Reminder"
                        data-msg="You set it for Saturday at 10:00."
                        data-where="Snooze or change it any time"
                      >
                        Back on Saturday at 10:00
                      </mark>
                      , set by you.
                    </div>
                    <div className="ui-doc__text">
                      Original link kept exactly as you pasted it, with the date you saved it and every change you
                      made since.
                    </div>
                  </article>
                  <aside className="ui-doc__note ui-panel is-on" aria-live="polite">
                    <div className="ui-doc__kind">
                      <span className="ui-doc__dot" />
                      <span data-doc-kind>Suggested</span>
                    </div>
                    <div className="ui-doc__msg" data-doc-msg>
                      You saved this for a weekend bake. Keep this reason?
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

        {/* STEPS: three real steps, each with its result shown. */}
        <section className="section" id="how" aria-labelledby="how-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="how-h">From saved to done in 3 steps</h2>
            </div>
            <div className="grid">
              <article className="card card--row card--open span-4">
                <div className="step__words stack-3">
                  <span className="step-num">1</span>
                  <h3 className="t-card">Paste a link or a thought</h3>
                  <p>One field, no form to fill. The original is stored before anything else runs.</p>
                </div>
                <div className="panel" role="img" aria-label="A pasted note being saved">
                  <div className="ui sp">
                    <div className="hv__card">
                      <p className="hv__label">Link or thought</p>
                      <p className="hv__paste">Ramen place Ana mentioned, near the station</p>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <div className="step__words stack-3">
                  <span className="step-num">2</span>
                  <h3 className="t-card">Check the suggestions</h3>
                  <p>A title, a summary, the reason and a list. Keep, edit or drop each one.</p>
                </div>
                <div className="panel" role="img" aria-label="Two suggestions, one kept and one waiting">
                  <div className="ui sp">
                    <div className="hv__sug hv__sug--kept">
                      <div className="hv__sughead">
                        <span>List</span>
                        <span className="hv__tag">Kept</span>
                      </div>
                      <p className="hv__val">Places</p>
                    </div>
                    <div className="hv__sug">
                      <div className="hv__sughead">
                        <span>Why you saved it</span>
                        <span className="hv__tag">Suggested</span>
                      </div>
                      <p className="hv__val">Next time you are near the station with an hour free</p>
                    </div>
                  </div>
                </div>
              </article>
              <article className="card card--row card--open span-4">
                <div className="step__words stack-3">
                  <span className="step-num">3</span>
                  <h3 className="t-card">Set a reminder for later</h3>
                  <p>A reminder you set, then snooze it, change it or mark the item done.</p>
                </div>
                <div className="panel" role="img" aria-label="A reminder for Friday evening with snooze and done actions">
                  <div className="ui sp">
                    <div className="hv__card">
                      <p className="hv__label">Back for you, Friday 18:30</p>
                      <p className="hv__val">Ramen place Ana mentioned</p>
                      <div className="hv__row">
                        <span className="hv__btn hv__btn--quiet">Snooze a week</span>
                        <span className="hv__btn">Mark done</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* SPLIT on the beige ground, with the dealt iris-opens moment. */}
        <section
          className="section ground-surface"
          id="suggestions"
          aria-labelledby="sug-h"
          data-moment="iris-opens"
          data-moment-opts='{"from": "base"}'
        >
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="sug-h">AI suggestions you approve first</h2>
                <p className="t-lead">
                  Suggested details sit on a dashed outline marked Suggested. Nothing joins your item until you keep it.
                </p>
                <ul className="stack-3">
                  <li>Your original link or text is never overwritten.</li>
                  <li>Your own edits are never replaced by a later suggestion.</li>
                  <li>No reminder exists until you set one.</li>
                </ul>
                <a className="link" href="#faq">
                  Read how suggestions work
                </a>
              </div>
              <div className="frame frame--split span-6 start-7" role="img" aria-label="Suggested details for a saved article, one kept and two waiting for a decision">
                <div className="ui sg">
                  <p className="sg__title">A long read on how sleep works</p>
                  <div className="hv__sug hv__sug--kept">
                    <div className="hv__sughead">
                      <span>List</span>
                      <span className="hv__tag">Kept</span>
                    </div>
                    <p className="hv__val">Reading</p>
                  </div>
                  <div className="hv__sug">
                    <div className="hv__sughead">
                      <span>Why you saved it</span>
                      <span className="hv__tag">Suggested</span>
                    </div>
                    <p className="hv__val">To read on a slow evening; you were looking into better sleep</p>
                  </div>
                  <div className="hv__sug">
                    <div className="hv__sughead">
                      <span>Bring it back</span>
                      <span className="hv__tag">Suggested</span>
                    </div>
                    <p className="hv__val">Sunday evening</p>
                  </div>
                  <div className="hv__row">
                    <span className="hv__btn hv__btn--quiet">Not this</span>
                    <span className="hv__btn">Keep</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ: every answer open. */}
        <section className="section" id="faq" aria-labelledby="faq-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="faq-h">Questions</h2>
                <p>What people ask before they save their first link.</p>
                <div className="frame faq-visual" role="img" aria-label="A delete confirmation for a saved item, naming the item and its reminder">
                  <div className="ui fv">
                    <p className="sg__title">Delete this item?</p>
                    <p className="hv__val">Rain jacket comparison and its reminder on 1 December will be removed.</p>
                    <div className="hv__row">
                      <span className="hv__btn hv__btn--quiet">Cancel</span>
                      <span className="hv__btn hv__btn--danger">Delete item</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="faq span-6 start-7">
                <div className="faq__item">
                  <h3>What can I save?</h3>
                  <p>Links and short text notes, for now.</p>
                </div>
                <div className="faq__item">
                  <h3>Does the AI change what I saved?</h3>
                  <p>No. It is stored as you wrote it, and suggestions wait beside it.</p>
                </div>
                <div className="faq__item">
                  <h3>Will it remind me without asking?</h3>
                  <p>No. A reminder exists only once you set it.</p>
                </div>
                <div className="faq__item">
                  <h3>Can I delete what I saved?</h3>
                  <p>Yes. Any item, along with its reminders.</p>
                </div>
                <div className="faq__item">
                  <h3>Does the app work on phones?</h3>
                  <p>Yes. It runs in the browser on any device.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer closing footer--dark ground-inverse" id="contact" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--word">
            <div className="section-head--split">
              <div>
                <h2 id="close-h">Start your MaybeLater list</h2>
                <p className="t-lead">Sign up with an email address, then paste your first link.</p>
              </div>
              <a className="btn btn--primary" href={SIGNUP}>
                {MAIN_ACTION}
                <Arrow />
              </a>
            </div>
            <p className="close__word" aria-hidden="true">
              MaybeLater
            </p>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-4 stack-4">
                <a className="nav__logo" href="#top">
                  MaybeLater
                </a>
                <p className="footer__lede">A save-for-later app that keeps why you saved things.</p>
              </div>
              <div className="span-2 footer__col">
                <h3>Product</h3>
                <ul>
                  <li>
                    <a href="#app">Inbox</a>
                  </li>
                  <li>
                    <a href="#how">Steps</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col footer__col--extra">
                <h3>Your data</h3>
                <ul>
                  <li>
                    <a href="#suggestions">Suggestions</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Account</h3>
                <ul>
                  <li>
                    <a href="/login">Sign in</a>
                  </li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Help</h3>
                <ul>
                  <li>
                    <a href="#faq">Questions</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="footer__legal">
              <span>&copy; 2026 MaybeLater</span>
              <div className="socials" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

