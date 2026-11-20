# MaybeLater AI

### Not now. But not forgotten.

**MaybeLater AI** is an agentic AI-powered personal intention manager that helps you capture, understand, organize, remember, and act on things you don't want to forget.

Save anything that matters — links, ideas, articles, places, products, tasks, goals, or random thoughts. AI helps organize your saved items and brings them back when they become relevant.

> Your mind is for thinking, not remembering everything.

[Features](#-features) · [How It Works](#-how-it-works) · [Architecture](#-system-architecture) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Roadmap](#-roadmap)

---

## 1. The Problem

We constantly discover things we want to explore or do later.

- An interesting article we don't have time to read.
- A product we want to purchase someday.
- A place we want to visit.
- An idea we want to work on.
- A tutorial we want to follow.
- A task we don't want to forget.
- A project we want to start when the time is right.

We save these things across browser bookmarks, messaging apps, screenshots, notes, social media, and random documents.

Eventually, they become forgotten.

### The real problem isn't saving things. It's remembering to return to them.

Traditional tools help us store information, but they don't necessarily understand why we saved it, when it might become useful, or when we should revisit it.

## 2. The Solution

MaybeLater AI creates a personal space for everything you intend to explore, remember, or accomplish in the future.

Instead of maintaining hundreds of disconnected bookmarks and notes, users can capture information in one place.

AI agents help:

- Understand what the user saved.
- Extract useful information.
- Categorize and organize saved items.
- Identify possible future intentions.
- Suggest when something may be worth revisiting.
- Help users find relevant saved information.

The user stays in control. AI suggestions are editable, and reminders or external actions require user approval.

### The Core Experience

**Capture → Understand → Organize → Resurface → Complete**

---

## 3. Features

### 3.1 Smart Capture

Quickly save almost anything without worrying about organizing it immediately.

Supported capture types:

- Text and personal thoughts.
- Website URLs and articles.
- Products and shopping links.
- Places and travel ideas.
- Tasks and future plans.
- Ideas and project concepts.

Each capture preserves its original content so it remains available even if AI processing fails.

### 3.2 AI Understanding

AI analyzes captured content and generates structured information.

It can suggest:

- A meaningful title.
- A short summary.
- A content category.
- Relevant tags.
- The likely intention behind the capture.
- A possible condition or time to revisit it.

AI-generated information should remain editable and should never silently overwrite the user's own changes.

### 3.3 Intelligent Organization

Keep saved information organized without manually maintaining complicated folders.

- Automatic category suggestions.
- AI-generated tags.
- Custom collections.
- Search and filtering.
- Favorites.
- Archive and completed states.

### 3.4 Smart Resurfacing

The defining feature of MaybeLater.

Instead of simply storing information forever, the system helps users return to it when it becomes relevant.

Examples:

- Revisit a saved travel destination when planning a trip.
- Review a product when you're ready to purchase.
- Return to a tutorial when you have time to learn.
- Revisit an idea when you're looking for your next project.

Resurfacing suggestions should be explainable, respectful, and adjustable. They should not become unwanted notifications.

### 3.5 Personal AI Assistant

A conversational interface for interacting with your saved information.

Example requests:

- "Find the React tutorial I saved last week."
- "Show me all the places I want to visit."
- "What ideas have I saved for future projects?"
- "Find the product I wanted to buy."
- "Help me decide what to revisit today."

The assistant should retrieve information from the authenticated user's own data and respect access permissions.

### 3.6 Reminders and Notifications

Users can choose to receive reminders for selected items.

Planned capabilities:

- Custom reminder dates.
- Time-based reminders.
- User-approved suggested reminders.
- Notification preferences.
- Snooze and dismiss.
- Mark as completed.

No reminder should be scheduled without the user's permission.

### 3.7 Personal Dashboard

A calm, distraction-free overview of saved intentions.

Dashboard sections:

- Inbox.
- Recently captured.
- Suggested for you.
- Upcoming reminders.
- Favorites.
- Collections.
- Completed.
- Archived.

---

## 4. How It Works

The product follows five main stages.

```mermaid
flowchart TD
    A["Capture Anything"] --> B["AI Understanding"]
    B --> C["Organize Information"]
    C --> D["Smart Resurfacing"]
    D --> E["User Takes Action"]
    E --> F["Complete or Keep Saved"]
    F --> G["Personal Knowledge Base"]
    G --> D
```

### Example User Journey

Imagine a user discovers an interesting article about learning Python.

**Step 1 — Capture**

The user pastes the article URL into MaybeLater.

**Step 2 — Understand**

The AI identifies it as a learning resource and generates a title, summary, and relevant tags.

**Step 3 — Organize**

The article is added to the user's learning collection.

**Step 4 — Resurface**

Later, MaybeLater suggests revisiting the article based on the user's selected preferences or a relevant condition.

**Step 5 — Complete**

The user opens the article, reads it, and marks it as completed or keeps it saved.

---

## 5. AI Agent Architecture

MaybeLater uses focused AI capabilities rather than relying on one large agent to perform every operation.

The architecture is designed to keep AI responsibilities modular, testable, and controlled.

### Planned Agents

| Agent | Responsibility |
|---|---|
| Capture Understanding Agent | Understands newly captured information |
| Organization Assistant | Suggests categories, tags, and collections |
| Resurfacing Assistant | Identifies items that may be worth revisiting |
| Personal Search Assistant | Finds relevant information from saved items |

### Agent Workflow

```mermaid
flowchart TD
    U["User"] --> API["FastAPI Backend"]
    API --> AUTH["Authentication & Authorization"]
    AUTH --> ROUTER["AI Workflow Router"]

    ROUTER --> CA["Capture Understanding"]
    ROUTER --> OA["Organization Assistant"]
    ROUTER --> RA["Resurfacing Assistant"]
    ROUTER --> SA["Personal Search Assistant"]

    CA --> VALIDATE["Validate Structured Output"]
    OA --> VALIDATE
    RA --> VALIDATE
    SA --> VALIDATE

    VALIDATE --> DB["PostgreSQL"]
    DB --> API
    API --> U
```

### AI Design Principles

- Use structured outputs validated with Pydantic.
- Keep agent responsibilities focused.
- Authenticate and authorize every user-data operation.
- Never expose API keys in the frontend.
- Treat captured content as untrusted input.
- Do not allow arbitrary SQL or shell execution.
- Preserve original user content.
- Require approval for reminders and external actions.
- Provide graceful fallbacks when AI processing fails.

**Implementation approach:** Start with deterministic backend workflows and focused LLM calls. Introduce a framework such as LangGraph only when the workflows genuinely need durable state, branching, retries, or complex orchestration.

---

## 6. System Architecture

MaybeLater follows a frontend/backend architecture with a dedicated AI processing layer.

```mermaid
flowchart TB
    USER["User"]
    subgraph FRONTEND["Frontend Layer"]
        WEB["Next.js Application"]
        UI["Dashboard & UI Components"]
        STATE["Client State & API Integration"]
    end

    subgraph BACKEND["Backend Layer"]
        API["FastAPI"]
        AUTH["Authentication & Permissions"]
        SERVICES["Application Services"]
        AGENTS["AI Agent Workflows"]
    end

    subgraph DATA["Data Layer"]
        DB[("PostgreSQL")]
        REDIS[("Redis - Optional")]
    end

    subgraph EXTERNAL["External Services"]
        LLM["OpenAI API"]
        EMAIL["Notification Provider"]
    end

    USER --> WEB
    WEB --> UI
    UI --> STATE
    STATE --> API
    API --> AUTH
    AUTH --> SERVICES
    SERVICES --> AGENTS
    SERVICES --> DB
    AGENTS --> LLM
    AGENTS --> DB
    SERVICES -.-> REDIS
    SERVICES -.-> EMAIL
```

### Architecture Responsibilities

**Frontend**
- User experience and dashboard.
- Capture interface.
- Search and filtering.
- Collections and saved items.
- AI assistant interface.
- Settings and notification preferences.

**Backend**
- API endpoints.
- Authentication and authorization.
- Business logic.
- Data validation.
- AI workflow orchestration.
- Reminder management.

**AI Layer**
- Content understanding.
- Classification and tagging.
- Contextual retrieval.
- Resurfacing suggestions.
- Structured AI responses.

**Database**
- User accounts.
- Captured items.
- Categories and tags.
- Collections.
- Reminders.
- AI processing metadata.

---

## 7. Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js | React framework |
| React | UI development |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Reusable UI components |
| Radix UI | Accessible primitives |
| Lucide React | Icons |
| GSAP | Advanced animations |
| Lenis | Smooth scrolling for landing page |
| React Hook Form | Form management |
| Zod | Frontend validation |
| TanStack Query | Server state management |

### Backend

| Technology | Purpose |
|---|---|
| Python | Backend language |
| FastAPI | REST API |
| Pydantic | Data validation and structured output |
| SQLAlchemy 2 | ORM |
| Alembic | Database migrations |
| PostgreSQL | Primary database |
| OpenAI API | AI capabilities |
| Redis | Optional caching and background-job infrastructure |
| ARQ | Optional asynchronous job processing |

### Authentication

- Better Auth for the web authentication experience.
- Backend token/session verification.
- Server-side authorization for user-owned resources.

### Testing

| Tool | Purpose |
|---|---|
| Vitest | Frontend unit tests |
| Testing Library | Component tests |
| Playwright | End-to-end tests |
| Pytest | Backend tests |

### Deployment

- Vercel — Frontend.
- Railway — Backend API and initial infrastructure.
- PostgreSQL — Persistent database.
- Redis — Optional background-job infrastructure.

---

## 8. Project Structure

The repository is organized to separate the frontend, backend, AI agents, shared resources, and documentation.

```text
maybelater-ai/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── types/
│   │   └── public/
│   │
│   └── api/
│       ├── app/
│       │   ├── api/
│       │   ├── core/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── agents/
│       │   ├── workflows/
│       │   └── main.py
│       ├── migrations/
│       ├── tests/
│       └── requirements.txt
│
├── packages/
│   └── shared/
│
├── infrastructure/
│
├── docs/
│   ├── 00_MASTER_BUILD_GUIDE.md
│   ├── 01_PRODUCT_REQUIREMENTS.md
│   ├── 02_DESIGN_SYSTEM_AND_UX.md
│   ├── 03_SYSTEM_ARCHITECTURE.md
│   ├── 04_DATABASE_AND_DATA_MODELS.md
│   ├── 05_AUTH_AND_USER_ACCOUNTS.md
│   ├── 06_CAPTURE_AND_INBOX_FEATURE.md
│   ├── 07_AI_UNDERSTANDING_FEATURE.md
│   ├── 08_AI_AGENTS_AND_TOOLS.md
│   ├── 09_ORGANIZATION_AND_SEARCH.md
│   ├── 10_SMART_RESURFACING_ENGINE.md
│   ├── 11_REMINDERS_AND_NOTIFICATIONS.md
│   ├── 12_USER_DASHBOARD_AND_SETTINGS.md
│   ├── 13_TESTING_AND_QUALITY.md
│   ├── 14_DEPLOYMENT_AND_OPERATIONS.md
│   ├── 15_MVP_ACCEPTANCE_CHECKLIST.md
│   └── IMPLEMENTATION_STATUS.md
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── LICENSE
```

*This is the intended target structure. Directories and files should be created as implementation progresses.*

---

## 9. Getting Started

### Prerequisites

Install the following:

- Node.js (LTS).
- npm.
- Python 3.11 or newer.
- PostgreSQL.
- Git.
- An OpenAI API key.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/maybelater-ai.git

cd maybelater-ai
```

### 2. Frontend Setup

```bash
cd apps/web

npm install

npm run dev
```

The frontend development server should be available at:

```text
http://localhost:3000
```

### 3. Backend Setup

Open another terminal:

```bash
cd apps/api

python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API should be available at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 4. Environment Variables

Create the appropriate environment files using `.env.example` as the reference.

Example configuration:

```env
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend
APP_ENV=development
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/maybelater

OPENAI_API_KEY=your_openai_api_key

# Authentication
BETTER_AUTH_SECRET=replace_with_a_secure_secret
BETTER_AUTH_URL=http://localhost:3000

# Optional infrastructure
REDIS_URL=redis://localhost:6379/0
```

Use actual secure values in your local environment. Never commit secrets or production credentials.

*The exact environment variable names and authentication integration must match the implemented application configuration.*

---

## 10. Product Design Principles

MaybeLater should feel like a calm personal space, not another productivity tool that constantly demands attention.

### Visual Direction

- Minimal and clean interface.
- Calm, premium visual language.
- Clear typography and visual hierarchy.
- Subtle interactions and animations.
- Responsive layouts.
- Accessible components.
- Dark and light theme support where appropriate.

### UX Principles

1. Capture should be faster than organizing manually.
2. AI should assist, not take control.
3. Original information should never be lost.
4. Resurfacing should feel helpful, not intrusive.
5. Users should understand why an item is being suggested.
6. Every important AI-generated change should be reviewable.
7. The application should remain useful even when AI services are unavailable.

---

## 11. Security and Privacy

Personal saved information can be sensitive. Privacy must be part of the architecture from the beginning.

- Authenticate API requests.
- Enforce user-level data isolation.
- Validate all incoming data.
- Store API secrets on the backend.
- Use secure session handling.
- Avoid logging sensitive user content unnecessarily.
- Treat URLs and captured content as untrusted data.
- Prevent unauthorized access to collections and reminders.
- Require explicit approval for user-impacting actions.
- Provide a way to delete user data.

---

## 12. Development Roadmap

The project should be developed in small, testable stages.

| Stage | Feature | Priority |
|---|---|---|
| 01 | Project setup and design system | High |
| 02 | Database and backend foundation | High |
| 03 | Authentication and user accounts | High |
| 04 | Capture and inbox | High |
| 05 | AI understanding | High |
| 06 | AI agent foundation | High |
| 07 | Organization and search | High |
| 08 | Smart resurfacing | High |
| 09 | Reminders and notifications | Medium |
| 10 | Personal AI assistant | Medium |
| 11 | Testing and optimization | High |
| 12 | Production deployment | High |

### MVP Goal

The first usable version should allow a user to:

1. Create an account.
2. Save a thought, link, or idea.
3. Let AI understand the captured content.
4. Review and edit AI suggestions.
5. Organize and search saved items.
6. See relevant resurfacing suggestions.
7. Manage their saved information.

Advanced autonomous workflows should come after the core experience is reliable.

---

## 13. Future Possibilities

Potential future capabilities include:

- Browser extension for one-click capture.
- Mobile application.
- Email and messaging integrations.
- Voice-based capture.
- Image and screenshot understanding.
- Context-aware recommendations.
- Advanced semantic search.
- Personalized resurfacing preferences.
- Calendar integrations with user permission.
- Cross-platform capture.

These are future possibilities, not promises of current functionality.

---

## 14. Contributing

Contributions, ideas, and feedback are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes.
4. Add or update tests.
5. Submit a pull request describing the changes.

Keep pull requests small and focused on one feature or improvement.

---

## 15. Project Status

<sub>Early-stage development — features and architecture are being implemented incrementally.</sub>

The repository documentation describes the intended product and architecture. Check `docs/IMPLEMENTATION_STATUS.md` for the actual implementation progress.

---

## 16. License

Choose and add an appropriate open-source license before publishing the project. Until then, do not assume the repository is open-source or that its contents may be reused without restrictions.

---

<p align="center">
  <strong>MaybeLater AI</strong><br/>
  Not now. But not forgotten.
</p>