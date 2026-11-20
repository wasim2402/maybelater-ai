# MaybeLater

AI-powered personal intention manager. Core loop: **Capture → Understand → Organize → Resurface → Complete**.

Technical source of truth: [`implentation docs/TECH_STACK_MAYBELATER.md`](implentation%20docs/TECH_STACK_MAYBELATER.md).

| Folder | App | Stack | Docs name |
|---|---|---|---|
| `frontend/` | Web app | Next.js (App Router) · React · TypeScript · Tailwind · shadcn/ui · GSAP · Lenis · TanStack Query | `apps/web` |
| `backend/` | API | FastAPI · Pydantic · SQLAlchemy 2 (async) · Alembic · PostgreSQL · OpenAI | `apps/api` |

## Requirements
- Node.js 22+, npm
- Python 3.11+ (developed on 3.13)
- PostgreSQL
- Redis (only once background jobs are added)

## Setup

```bash
# Frontend
cd frontend
npm install
# create frontend/.env.local from the Web section of ../.env.example

# Backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # Windows PowerShell
# source .venv/bin/activate         # macOS/Linux
pip install -r requirements-dev.txt
# create backend/.env from the API section of ../.env.example
```

`backend/requirements.lock.txt` pins the exact resolved versions (`pip install -r requirements.lock.txt` for a reproducible install).

### Taste Skill (UI design workflow)

The installed skill files are not committed (`.agents/`, `.claude/skills/` are ignored); its version is pinned in `skills-lock.json`. Reinstall after cloning, from the repo root:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

## Run

```bash
cd frontend && npm run dev                                         # http://localhost:3000
cd backend  && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # http://localhost:8000/docs
```

Health check: `GET http://localhost:8000/api/v1/health`

## Database / migrations

Local setup uses PostgreSQL 18 with a dedicated, non-superuser role:

- Role `maybelater` owns databases `maybelater` (app) and `maybelater_test` (tests).
- Create them as the `postgres` superuser (`"C:/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -h localhost`):

```sql
CREATE ROLE maybelater LOGIN PASSWORD '<password>';
CREATE DATABASE maybelater OWNER maybelater ENCODING 'UTF8';
CREATE DATABASE maybelater_test OWNER maybelater ENCODING 'UTF8';
```

- Put the same password in `DATABASE_URL` / `TEST_DATABASE_URL` in `backend/.env` (driver must be `postgresql+asyncpg`).

Then register models in `backend/app/models/__init__.py`, then:

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Alembic reads `DATABASE_URL` from app settings (`alembic/env.py`), not from `alembic.ini`.

## Checks

```bash
# Frontend
npm run lint
npm run typecheck
npm run test          # Vitest
npm run build
npm run test:e2e      # Playwright (run `npx playwright install` first)

# Backend
pytest
```
