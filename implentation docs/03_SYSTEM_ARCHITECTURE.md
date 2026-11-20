# 03 — System Architecture

## Objective
Implement a clean separation between the Next.js web application and FastAPI backend.

## Required stack
Follow `TECH_STACK_MAYBELATER.md`:
- Next.js App Router, React and TypeScript.
- Tailwind CSS, shadcn/ui and Radix UI.
- FastAPI and Pydantic.
- PostgreSQL, SQLAlchemy 2 and Alembic.
- OpenAI API behind a backend service layer.
- Redis/ARQ only when background jobs are introduced.

## Applications
### Web (`apps/web`)
Owns:
- Public landing page.
- Authentication UI.
- Product screens and interactions.
- Form validation and client-side UX.
- API communication.

Does not own:
- AI provider secrets.
- Authorization decisions.
- Direct database access.
- Reminder scheduling authority.

### API (`apps/api`)
Owns:
- Authentication token/session verification.
- Authorization and user data isolation.
- Business rules.
- Database reads and writes.
- AI provider communication.
- Reminder and resurfacing logic.

## API conventions
- Prefix endpoints with `/api/v1`.
- Use resource-oriented routes and consistent response schemas.
- Validate inputs with Pydantic.
- Return appropriate HTTP status codes.
- Use pagination for growing lists.
- Use UTC timestamps in storage and explicit timezone handling for user-facing schedules.
- Add request IDs and structured logs without logging secrets or unnecessary private content.

## Suggested backend layers
- `api/routes`: HTTP routing only.
- `schemas`: request/response contracts.
- `models`: SQLAlchemy models.
- `db`: engine, session and database helpers.
- `services`: business logic.
- `services/ai`: model provider, prompts and structured outputs.
- `core`: settings, security and shared configuration.

## Error handling
Define consistent errors for validation, unauthenticated access, forbidden resources, missing records, rate limits and provider failures. Do not expose stack traces or secrets to clients.

## Security boundaries
- Enforce ownership in backend queries.
- Never trust user IDs from request bodies for authorization.
- Validate URL schemes and reject unsafe local/private network targets before any server-side URL fetch.
- Apply request size limits and rate limits to capture and AI endpoints.
- Keep API keys server-side.
- Configure CORS for known web origins only.

## Deliverable
Document the request flow, environment configuration, error format and service boundaries. Ensure both applications run independently in development.
