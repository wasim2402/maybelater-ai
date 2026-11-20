# MaybeLater — Technical Stack & Setup Guide

> **Product:** MaybeLater  
> **Purpose:** An AI-powered personal intention manager for the general public.  
> **Core loop:** Capture → Understand → Organize → Resurface → Complete  
> **Document role:** Source of truth for the coding agent when setting up and implementing the project.

---

## 1. Product overview

MaybeLater helps people save things they intend to do later and then brings them back at a useful moment.

Examples:
- Save an article and remember why it matters.
- Save a product to compare before buying.
- Save a place to visit when travelling to that city.
- Save a task or idea with a condition such as “this weekend” or “when I have time”.
- Capture a thought using text, a URL, a screenshot, or voice.

The AI should extract the user's intent, summarize why the item was saved, suggest useful metadata, and help decide when it should resurface. The user remains in control: AI suggestions and reminders must be editable and user-approved.

### MVP capabilities

1. **Quick capture:** URL and text first; design the capture layer so screenshot and voice inputs can be added cleanly.
2. **AI understanding:** Extract title, summary, intent, category, entities, and possible resurfacing conditions.
3. **Organized library:** Searchable list, categories, filters, status, and editable details.
4. **Smart resurfacing:** Recommend saved items when their conditions or relevant dates arrive.
5. **Reminders:** User-approved reminders with clear controls to snooze, dismiss, or complete.
6. **Completion:** Mark an intention done, archived, or no longer relevant.

Do not build every possible integration in the first release. Prioritize a reliable capture-to-resurface loop.

---

## 2. Technology decisions

Use **TypeScript and npm** for the frontend. Keep the backend in Python with FastAPI.

| Layer | Technology | Responsibility |
|---|---|---|
| Web app | Next.js App Router + React + TypeScript | Landing page and authenticated product experience |
| Styling | Tailwind CSS + shadcn/ui + Radix UI | Responsive design system and accessible components |
| Icons | Lucide React | Consistent interface icons |
| Motion | GSAP + `@gsap/react` | Deliberate entrance, section, and interaction animations |
| Landing-page scrolling | Lenis | Smooth scrolling on the marketing landing page only |
| Frontend forms | React Hook Form + Zod | Form state and validation |
| Frontend data fetching | TanStack Query | Server state, caching, and mutations |
| Backend API | FastAPI + Python | REST API and business logic |
| Validation/config | Pydantic + pydantic-settings | Request schemas and environment configuration |
| ORM/migrations | SQLAlchemy 2 + Alembic | Database access and schema migrations |
| Database | PostgreSQL | Users, saved intentions, metadata, reminders, and activity |
| AI | OpenAI API with structured outputs | Intent extraction, summaries, and classification |
| Background work | Redis + ARQ (add when needed) | Scheduled reminders and asynchronous jobs |
| Authentication | Better Auth | User sessions and authentication |
| Testing | Vitest, Testing Library, Playwright, pytest | Unit, component, end-to-end, and API tests |
| Deployment | Vercel (web) + Railway (API/worker/PostgreSQL/Redis) | Initial deployment target |

### Architecture principles

- Keep the frontend and backend as separate applications in one repository.
- The browser must call the FastAPI backend for product data and AI operations. Never expose AI provider secrets in client code.
- Use PostgreSQL as the source of truth.
- Store AI output in validated, typed schemas. Do not trust arbitrary model-generated JSON.
- Keep AI provider calls behind a small service layer so providers can be changed later.
- Start with direct, structured LLM calls. **LangGraph is optional and should not be added until workflows genuinely need multi-step agent orchestration.**
- Add Redis/ARQ when scheduled or retryable background work is implemented; do not make the MVP depend on it unnecessarily.
- Make all AI-generated fields editable by the user.

---

## 3. Repository structure

Use a simple monorepo:

```text
maybelater/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── public/
│   └── api/                    # FastAPI backend
│       ├── app/
│       │   ├── api/
│       │   │   └── routes/
│       │   ├── core/
│       │   ├── db/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── services/
│       │   │   └── ai/
│       │   └── main.py
│       ├── tests/
│       ├── alembic/
│       └── requirements.txt
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

Keep feature-specific frontend code together. Avoid putting all application logic into a single page or a giant component.

---

## 4. Frontend setup and dependencies

### Requirements

- Node.js **22 or newer**
- npm
- Chrome, Edge, or Chromium for the Taste Skill browser checks

### Create the Next.js app

From the repository root:

```bash
mkdir -p apps
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd apps/web
```

If the app already exists, do not recreate it. Inspect its current configuration and install only missing dependencies.

### Install runtime dependencies

```bash
npm install gsap @gsap/react lenis lucide-react \
  @tanstack/react-query \
  react-hook-form zod @hookform/resolvers \
  date-fns sonner clsx tailwind-merge class-variance-authority
```

Use shadcn/ui for accessible primitives and composed components:

```bash
npx shadcn@latest init
```

Add components as they are needed, rather than generating the entire component catalogue:

```bash
npx shadcn@latest add button input textarea dialog dropdown-menu \
  popover select checkbox badge card tabs tooltip sheet \
  command calendar skeleton separator
```

### Install frontend development dependencies

```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event \
  @playwright/test
```

Initialize Playwright when end-to-end tests are ready:

```bash
npx playwright install
```

### Frontend implementation notes

- Use Next.js App Router and TypeScript throughout.
- Use Server Components by default. Add Client Components only where browser interaction, state, or animation requires them.
- Use Zod schemas for form and API response validation where appropriate.
- Use TanStack Query for API server state. Avoid duplicating server state in global client stores.
- Use the native `fetch` API for HTTP requests unless a concrete need justifies another client.
- Keep environment variables prefixed with `NEXT_PUBLIC_` limited to values that are safe to expose in the browser.
- Use reusable design tokens and components; do not scatter arbitrary colors, spacing, and radii throughout the app.

---

## 5. Taste Skill — mandatory UI design workflow

Install the `design-taste-frontend` skill from the requested repository:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

Reference: https://github.com/Leonxlnx/taste-skill

**The coding agent must actively use this skill before designing or implementing the landing page and major product screens.** Installing the skill alone is not enough.

Agent instructions:

1. Read and follow the installed skill's `SKILL.md` and its project-specific workflow.
2. Use it to establish a coherent art direction, typography, palette, layout system, and component language before writing the UI.
3. Avoid generic AI-generated SaaS layouts, repetitive card grids, decorative gradients, and meaningless dashboard metrics.
4. Design for the actual MaybeLater product: capturing intentions, understanding context, and resurfacing saved items at the right time.
5. Make the product UI feel like a real, usable application, not just a marketing mockup.
6. Use real, relevant imagery only when it adds meaning. Respect the asset source and attribution requirements of the skill.
7. Run the skill's browser inspection/checking workflow at desktop, tablet, and mobile sizes. Fix reported issues instead of ignoring them.

The skill requires Node 22+ and an installed Chrome, Edge, or Chromium browser. It does not replace the app's runtime dependencies.

---

## 6. GSAP and Lenis animation requirements

### GSAP

Use GSAP for purposeful, polished motion:

- Landing hero entrance and staggered content reveals.
- Section reveals triggered as the user scrolls.
- Small interaction feedback where CSS transitions are insufficient.
- Carefully selected product storytelling moments.

Installations are included in the frontend dependency list:

```bash
npm install gsap @gsap/react
```

Implementation rules:

- In React, prefer `useGSAP` from `@gsap/react`.
- Register GSAP plugins such as `ScrollTrigger` in the client-side module where they are used.
- Scope animations to component refs and clean them up on unmount.
- Respect `prefers-reduced-motion`.
- Avoid animating every element. Motion should explain hierarchy and guide attention.
- Do not use scroll-jacking or animations that delay access to the actual product.

### Lenis

Use Lenis for smooth scrolling on the **public marketing landing page**:

```bash
npm install lenis
```

Implementation rules:

- Integrate Lenis only in the landing-page experience initially.
- Do not globally apply smooth scrolling to every authenticated dashboard or form screen.
- If Lenis and GSAP ScrollTrigger are both used, connect them through the documented ticker/update integration and avoid duplicate animation loops.
- Keep native scrolling usable and respect reduced-motion preferences.
- Test touch scrolling and mobile performance. Disable or simplify smooth scrolling if it harms usability.

Official references:
- GSAP installation: https://gsap.com/docs/v3/Installation/
- Lenis: https://github.com/darkroomengineering/lenis

---

## 7. Backend setup and dependencies

### Requirements

- Python 3.11 or newer
- `venv`
- PostgreSQL
- Optional for background jobs: Redis

From the repository root:

```bash
mkdir -p apps/api
cd apps/api
python -m venv .venv
```

Activate the environment:

**Windows PowerShell**
```powershell
.venv\Scripts\Activate.ps1
```

**macOS/Linux**
```bash
source .venv/bin/activate
```

Create `requirements.txt` with:

```text
fastapi
uvicorn[standard]
pydantic
pydantic-settings
sqlalchemy[asyncio]
asyncpg
alembic
httpx
openai
tenacity
python-multipart
PyJWT[crypto]
```

Install:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Optional background-job dependencies

Only add these when reminder scheduling or asynchronous processing is implemented:

```bash
pip install redis arq
```

Then add `redis` and `arq` to `requirements.txt`.

### Backend implementation notes

- Use async FastAPI routes and SQLAlchemy sessions for database operations.
- Use Pydantic request and response schemas. Do not return ORM objects directly without explicit response models.
- Keep route handlers thin; put business logic in services.
- Put all AI prompts, schemas, and provider calls under `services/ai/`.
- Validate structured AI responses before persisting them.
- Add database migrations with Alembic. Do not rely on automatic table creation in production.
- Add timeouts, retries for transient provider failures, and clear error handling.
- Verify Better Auth session/JWT tokens on the API side using a documented shared-secret or public-key strategy. Do not assume the frontend session automatically authenticates FastAPI.
- Never log API keys, access tokens, or private user content unnecessarily.

---

## 8. Initial API design

Keep endpoints resource-oriented. The following is an initial contract, not a requirement to implement every endpoint in the first commit.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/captures` | Capture a URL or text item |
| GET | `/api/v1/intentions` | List the user's intentions |
| GET | `/api/v1/intentions/{id}` | Get one intention |
| PATCH | `/api/v1/intentions/{id}` | Edit an intention |
| DELETE | `/api/v1/intentions/{id}` | Delete an intention |
| POST | `/api/v1/intentions/{id}/complete` | Mark an intention complete |
| POST | `/api/v1/ai/analyze` | Analyze captured content |
| GET | `/api/v1/recommendations` | Retrieve items ready to resurface |
| POST | `/api/v1/reminders` | Create a user-approved reminder |
| PATCH | `/api/v1/reminders/{id}` | Update or snooze a reminder |

Every user-owned resource must be scoped to the authenticated user on the server. Never trust a `user_id` supplied by the browser as authorization.

---

## 9. Initial data model

Start with these entities and evolve them through migrations:

- **User:** Authentication identity and account-level preferences.
- **Intention:** Original content, source type, title, summary, extracted intent, category, status, and timestamps.
- **Reminder:** Intention reference, scheduled time, status, and user approval metadata.
- **Category:** User-owned or system-provided grouping.
- **Activity:** Optional history of capture, edit, resurface, snooze, and completion events.

Store the original captured content separately from AI-generated interpretations. Preserve user edits and do not silently overwrite them with later AI analysis.

---

## 10. Environment variables

Create `.env.example` at the repository root. Use placeholders only:

```dotenv
# Web
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000

# API
APP_ENV=development
API_HOST=0.0.0.0
API_PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/maybelater
OPENAI_API_KEY=
OPENAI_MODEL=
AUTH_SECRET=
AUTH_BASE_URL=http://localhost:3000

# Optional background jobs
REDIS_URL=redis://localhost:6379/0
```

Do not commit real `.env` files or secrets. Keep frontend and backend environment files separate if that makes local tooling safer. Only `NEXT_PUBLIC_*` values may be exposed to the browser.

---

## 11. Local development commands

Run the frontend:

```bash
cd apps/web
npm run dev
```

Run the backend in a separate terminal:

```bash
cd apps/api
# Activate .venv first
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Create and apply migrations after configuring the database:

```bash
cd apps/api
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Before declaring setup complete:

```bash
# Frontend
cd apps/web
npm run lint
npm run build

# Backend
cd apps/api
pytest
```

Add and document any missing scripts (such as `test`, `typecheck`, or `format`) in the relevant project configuration.

---

## 12. UI and UX direction

The experience should feel calm, personal, intelligent, and trustworthy. It is a tool for things people do not want to forget, not another noisy task manager.

### Landing page

- A distinctive hero that communicates the “save it now, come back when it matters” idea.
- Show a believable product interface or interaction, not only abstract marketing graphics.
- Use GSAP for restrained storytelling and section transitions.
- Use Lenis for landing-page scrolling only, subject to accessibility and performance checks.
- Clear calls to action and a responsive layout.

### Application

- Make capture extremely fast and easy to find.
- Make the reason an item was saved visible and editable.
- Clearly distinguish AI suggestions from user-confirmed information.
- Make resurfaced items feel helpful, not intrusive.
- Provide obvious snooze, dismiss, edit, and complete actions.
- Include useful loading, empty, error, and success states.
- Design mobile-first interactions as well as desktop layouts.

### Accessibility and performance

- Keyboard-accessible controls and visible focus states.
- Semantic HTML and accessible labels.
- Sufficient contrast and reduced-motion support.
- Avoid layout shifts and oversized animation bundles.
- Test at approximately 390px, 768px, 1024px, and 1440px viewport widths.

---

## 13. Implementation order

1. Inspect the repository and existing tooling before changing anything.
2. Install and read the Taste Skill; establish the design direction.
3. Scaffold the Next.js and FastAPI applications.
4. Install and verify frontend and backend dependencies.
5. Configure environment examples, linting, formatting, and tests.
6. Set up PostgreSQL, SQLAlchemy, and the first Alembic migration.
7. Implement authentication and server-side ownership checks.
8. Build the core capture, intention list, detail/edit, and completion flows.
9. Add structured AI analysis.
10. Add resurfacing logic and user-approved reminders.
11. Add Redis/ARQ only when background scheduling is required.
12. Run browser checks and automated tests; fix issues before calling the MVP ready.

Do not build placeholder features merely to make the dashboard look populated. Use clearly labelled demo data only in a demo environment.

---

## 14. Instructions to the coding agent

Treat this document as the project's technical source of truth.

- **Use the Taste Skill** for UI design. Read its instructions and follow its workflow; do not merely install it and ignore it.
- **Use GSAP** for meaningful interface animation.
- **Use Lenis** for the public landing page's smooth scrolling, not as a global dashboard default.
- Use npm for JavaScript package management.
- Install dependencies in the correct app directory and commit the lockfile.
- Inspect existing files before overwriting configuration or recreating an app.
- Do not silently swap the selected stack or add large libraries without a concrete need.
- Keep secrets out of source control.
- Implement real, connected flows rather than static mock screens.
- Run lint, type checks, tests, production build, and the Taste Skill browser inspection. Report what passed and what remains.
- If a required credential or external service is unavailable, implement a safe configuration boundary and document the missing setup. Never fabricate successful integration.

**Definition of done for initial setup:** both apps start locally, dependencies are installed and locked, environment templates exist, the database connection/migration path is documented, the Taste Skill is installed and read, and lint/build/test commands have been run with their results recorded.
