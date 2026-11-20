# MaybeLater AI

### Not now. But not forgotten.

**MaybeLater AI** is an agentic AI-powered personal intention manager that helps you capture, organize, remember, and act on things you want to do later.

Save links, ideas, articles, places, products, tasks, and thoughts. Let AI understand and organize them, then bring them back when the right moment arrives.

---

## The Problem

We constantly save things we want to explore later:

- Articles we don't have time to read.
- Products we might purchase.
- Places we want to visit.
- Ideas and projects for the future.
- Tutorials we want to follow.

These get scattered across bookmarks, notes, screenshots, and messaging apps.

**The problem isn't saving things. It's remembering to return to them.**

## The Solution

MaybeLater provides one intelligent space for everything you don't want to forget.

AI helps understand, categorize, organize, and resurface saved information when it becomes relevant.

**Capture → Understand → Organize → Resurface → Complete**

---

## Core Features

| Feature | Description |
|---|---|
| Smart Capture | Save links, thoughts, ideas, products, places and tasks |
| AI Understanding | Generate titles, summaries, categories and tags |
| Intelligent Organization | Manage collections, favorites and saved items |
| Smart Resurfacing | Rediscover saved information at relevant moments |
| Personal AI Assistant | Search and interact with your saved information |
| Reminders | Set user-approved reminders and notifications |
| Personal Dashboard | Manage your intentions from one place |

---

## How It Works

```mermaid
flowchart TD
    A["Capture Anything"] --> B["AI Understanding"]
    B --> C["Organize Information"]
    C --> D["Smart Resurfacing"]
    D --> E["Take Action"]
    E --> F["Complete or Keep Saved"]
    F --> G["Personal Knowledge Base"]
    G --> D
```

## AI Agent Architecture

MaybeLater uses focused AI agents, each responsible for a specific task.

| Agent | Responsibility |
|---|---|
| Capture Understanding | Understands saved content |
| Organization Assistant | Suggests categories and tags |
| Resurfacing Assistant | Finds items worth revisiting |
| Personal Search Assistant | Retrieves relevant saved information |

```mermaid
flowchart TD
    U["User"] --> API["FastAPI Backend"]
    API --> AUTH["Authentication"]
    AUTH --> R["AI Workflow Router"]

    R --> A["Capture Agent"]
    R --> B["Organization Agent"]
    R --> C["Resurfacing Agent"]
    R --> D["Search Assistant"]

    A --> V["Validate AI Output"]
    B --> V
    C --> V
    D --> V

    V --> DB[("PostgreSQL")]
    DB --> API
```

AI outputs are validated, user data is isolated, original captures are preserved, and user-impacting actions require approval.

---

## System Architecture

```mermaid
flowchart TB
    USER["User"]

    subgraph FRONTEND["Frontend"]
        WEB["Next.js + React"]
        UI["Dashboard & Components"]
    end

    subgraph BACKEND["Backend"]
        API["FastAPI"]
        SERVICES["Application Services"]
        AGENTS["AI Agent Workflows"]
    end

    subgraph DATA["Data Layer"]
        DB[("PostgreSQL")]
        REDIS[("Redis - Optional")]
    end

    LLM["OpenAI API"]

    USER --> WEB
    WEB --> UI
    UI --> API
    API --> SERVICES
    SERVICES --> AGENTS
    SERVICES --> DB
    AGENTS --> LLM
    AGENTS --> DB
    SERVICES -.-> REDIS
```

---

## Tech Stack

**Frontend**
- Next.js, React, TypeScript
- Tailwind CSS, shadcn/ui, Radix UI
- GSAP, Lenis, Lucide React
- React Hook Form, Zod, TanStack Query

**Backend**
- Python, FastAPI
- Pydantic, SQLAlchemy 2, Alembic
- PostgreSQL
- OpenAI API

**Infrastructure & Testing**
- Redis and ARQ (optional background jobs)
- Better Auth with backend session verification
- Vitest, Testing Library, Playwright, Pytest
- Vercel and Railway

---

## Project Structure

```text
maybelater-ai/
│
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── services/
│   │
│   └── api/                  # FastAPI backend
│       ├── app/
│       │   ├── api/
│       │   ├── core/
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── services/
│       │   ├── agents/
│       │   └── workflows/
│       ├── migrations/
│       └── tests/
│
├── packages/
│   └── shared/
│
├── infrastructure/
├── docs/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

*Target repository structure; implementation will happen incrementally.*

---

## Getting Started

### Prerequisites

- Node.js (LTS)
- npm
- Python 3.11+
- PostgreSQL
- OpenAI API key

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/maybelater-ai.git
cd maybelater-ai
```

### 2. Start Frontend

```bash
cd apps/web
npm install
npm run dev
```

### 3. Start Backend

```bash
cd apps/api
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install and run:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Local Development URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Environment Variables

Create `.env` files using `.env.example` as a reference.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000

APP_ENV=development
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/maybelater

OPENAI_API_KEY=your_openai_api_key

BETTER_AUTH_SECRET=your_secure_secret
BETTER_AUTH_URL=http://localhost:3000

REDIS_URL=redis://localhost:6379/0
```

Never commit real secrets or API keys.

---

## Development Roadmap

```mermaid
flowchart TD
    A["Project Setup & Design"] --> B["Backend & Database"]
    B --> C["Authentication"]
    C --> D["Smart Capture"]
    D --> E["AI Understanding"]
    E --> F["AI Agents"]
    F --> G["Organization & Search"]
    G --> H["Smart Resurfacing"]
    H --> I["Reminders & Assistant"]
    I --> J["Testing & Deployment"]
```

**MVP priorities:**
1. User authentication and personal inbox.
2. Capture links, ideas and thoughts.
3. AI-powered understanding and organization.
4. Search and collections.
5. Relevant resurfacing suggestions.

---

## Privacy & Security

- User-level data isolation.
- Secure authentication and authorization.
- Backend-only API keys.
- Validated AI outputs.
- Original content preservation.
- User approval for reminders and external actions.

## Project Status

<sub>Early-stage development — features are being implemented incrementally.</sub>

See `docs/IMPLEMENTATION_STATUS.md` for implementation progress.

## License

License to be determined.

---

<p align="center">
  <strong>MaybeLater AI</strong><br/>
  Not now. But not forgotten.
</p>