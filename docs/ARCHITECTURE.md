# MaybeLater — System Architecture (Stage 03)

Two applications in one repository, each with its own runtime, dependencies and environment file.

| App | Folder | Stack | Runs on |
|---|---|---|---|
| Web | `frontend/` (the docs' `apps/web`) | Next.js App Router, React, TypeScript, Tailwind, shadcn/ui | http://localhost:3000 |
| API | `backend/` (the docs' `apps/api`) | FastAPI, Pydantic, SQLAlchemy 2 (async), Alembic | http://localhost:8000 |
| Database | — | PostgreSQL | localhost:5432 |

## 1. Who owns what

| Concern | Web | API |
|---|---|---|
| Landing page, auth UI, product screens, client-side validation | ✅ | |
| Calling the API (`src/lib/api/client.ts`) | ✅ | |
| Session / token verification | | ✅ |
| Authorization and per-user data isolation | | ✅ |
| Business rules, database reads and writes | | ✅ |
| AI provider calls and secrets | | ✅ |
| Reminder scheduling and resurfacing logic | | ✅ |

**The web app never:**
- touches the database;
- holds an AI key;
- makes an authorization decision;
- schedules a reminder.

The browser only sees `NEXT_PUBLIC_*` values.

## 2. Request flow

```mermaid
sequenceDiagram
    participant B as Browser (Next.js UI)
    participant C as lib/api/client.ts
    participant M as API middleware
    participant R as Route (api/routes)
    participant S as Service (services/)
    participant D as PostgreSQL
    participant A as AI provider (services/ai)

    B->>C: api.post("/captures", body)
    C->>M: fetch /api/v1/captures (cookies, JSON, 15 s timeout)
    M->>M: CORS check, request id, body size cap
    M->>R: request
    R->>R: Pydantic validates input; auth dependency resolves the user (stage 05)
    R->>S: call with user_id from the verified session
    S->>D: queries always filtered by user_id
    S-->>A: optional structured call (validated output)
    S-->>R: domain result
    R-->>C: response model (or the shared error body)
    C-->>B: Zod-validated data, or an ApiError
```

The API's middleware runs in this order, outside in:

1. **CORS.** Only the origins listed in `CORS_ORIGINS`, with credentials. This layer is outermost, so a 500 or a 413 still carries CORS headers.
2. **Request context.** It reuses the caller's `X-Request-ID` if well formed, otherwise generates one, and returns it as a response header. It writes one JSON access log line per request (method, path without the query string, status, duration), and catches crashes, which become the shared 500 body.
3. **Body size cap.** Bodies over `MAX_REQUEST_BYTES` get a 413. It checks `Content-Length` first and also counts streamed bodies that send none.
4. **Routes.** Pydantic validation, then the exception handlers turn every error into the shared body.

## 3. Backend layers

```text
backend/app/
├── main.py              create_app(settings): middleware, error handlers, routers
├── api/
│   ├── router.py        /api/v1 prefix
│   └── routes/          HTTP only: parse, call a service, return a response model
├── schemas/             request/response contracts (Pydantic); common.py = errors + Page[T]
├── models/              SQLAlchemy models (stage 04)
├── db/                  engine, session (get_db), Base
├── services/            business logic; owns ownership checks and transactions
│   └── ai/provider.py   AIProvider protocol; the OpenAI implementation arrives in stage 07
└── core/
    ├── config.py        Settings (env), validation of CORS and production secrets
    ├── errors.py        AppError family + handlers (the shared error body)
    ├── middleware.py    request context and body size cap
    ├── logging.py       JSON logs with request_id
    ├── rate_limit.py    RateLimit dependency (sliding window)
    ├── url_safety.py    SSRF guards for user links
    ├── time.py          UTC helpers, IANA zones
    └── deps.py          shared dependencies (settings; current user in stage 05)
```

Rules:
- Routes stay thin and contain no SQL.
- Services never import FastAPI request objects.
- Every user-owned query takes `user_id` from the verified session, never from the request body.

## 4. API conventions

- **Prefix:** `/api/v1`, with resource-oriented paths (`/captures`, `/intentions/{id}`, `/reminders` …).
- **Input:** Pydantic models with explicit limits (lengths, ranges).
- **Output:** explicit `response_model`s. ORM objects are never returned directly.
- **Status codes:**

  | Situation | Code |
  |---|---|
  | Read or update | 200 |
  | Create | 201 |
  | Delete | 204 |
  | Validation | 422 |
  | Not signed in | 401 |
  | Missing, or another user's resource | 404 (a 404 keeps that resource's existence hidden) |
  | Conflict | 409 |
  | Too large | 413 |
  | Too many requests | 429 |
  | Upstream failure | 502 |
  | Feature not configured | 503 |

- **Pagination:** cursor based, as `{"items": [...], "next_cursor": "..." | null}`, with query params `limit` (1–100, default 20) and `cursor`.
- **Time:** stored and exchanged in UTC (ISO 8601 with offset), and naive datetimes are rejected. A user's IANA time zone is applied only when scheduling or displaying (`core/time.py`). `tzdata` ships with the API so zones also work on Windows.
- **Health:** `GET /api/v1/health` checks the process is up. `GET /api/v1/health/ready` also checks that PostgreSQL is reachable: it returns 200 or 503, and reports whether AI is configured.
- **Docs:** `/docs` and `/openapi.json` exist only when `APP_ENV=development`.

## 5. Error format

Every non-2xx response from the API has this shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Some fields need attention.",
    "request_id": "69fa7663d0604295b4db520141c32037",
    "details": [{ "field": "content", "issue": "Field required" }]
  }
}
```

| `code` | Status | When |
|---|---|---|
| `validation_error` | 422 | Input failed validation. `details` lists the fields; submitted values are never echoed back. |
| `unauthenticated` | 401 | No valid session |
| `forbidden` | 403 | Signed in but not allowed |
| `not_found` | 404 | Missing route or record, or a record owned by another user |
| `method_not_allowed` | 405 | Wrong HTTP method |
| `conflict` | 409 | Duplicate or state conflict |
| `payload_too_large` | 413 | Body over the cap |
| `unsafe_url` | 422 | Link is not public http(s) |
| `rate_limited` | 429 | Too many requests, with a `Retry-After` header |
| `provider_error` | 502 | AI provider failed or timed out; user data unaffected |
| `provider_not_configured` | 503 | AI keys not set |
| `internal_error` | 500 | Unexpected crash. There is no stack trace in the body; it is logged with the request id. |

On the web side, `ApiError` (`src/lib/api/errors.ts`) exposes `code`, `message`, `status`, `requestId`, `details`, `retryAfter` and `isRetryable`. The client adds three codes of its own: `network_error`, `timeout` and `invalid_response` (a success body failed its Zod schema). React Query retries only errors marked `isRetryable`, never a 4xx.

## 6. Security boundaries

- **Ownership:** enforced in service queries (`WHERE user_id = :current_user`). The current-user dependency arrives in stage 05.
- **CORS:** known origins only. `*` is rejected at startup, and outside development the origins must use https.
- **Secrets:** `OPENAI_API_KEY`, `AUTH_SECRET` and `DATABASE_URL` live only in `backend/.env`. With `APP_ENV` set to staging or production, the API refuses to start without a 32+ character `AUTH_SECRET`.
- **User links (SSRF):**
  - `validate_capture_url` runs when a link is saved. It allows http(s) only, and rejects credentials in the URL, localhost and `.local`/`.internal` hosts, private, loopback, link-local and metadata IPs, and IPv4-mapped IPv6 tricks.
  - `resolve_public_url` runs right before any server-side fetch (stage 07). It resolves DNS and requires every address to be public.
- **Size and rate limits:**
  - A global body cap (`MAX_REQUEST_BYTES`, 1 MB by default).
  - A `RateLimit(name, limit, window_seconds)` dependency for capture, AI and auth routes. It keys on the user if known, otherwise on the client IP.
  - The store is in memory, so limits are per process. Move it to Redis when the API scales out (stage 14).
- **Logging:** JSON lines with `request_id`. The query string, request bodies, saved content and tokens are never logged.

## 7. Environment configuration

Template: `.env.example` at the repository root. Copy browser-safe values into `frontend/.env.local` and everything else into `backend/.env`. Never commit either file.

| Variable | App | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` | Web | Public URLs. These are the only values the browser sees. |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Web (server only) | Better Auth, stage 05. The secret must equal the API's `AUTH_SECRET`. |
| `APP_ENV` | API | `development`, `test`, `staging` or `production` |
| `LOG_LEVEL` | API | Default `INFO` |
| `DATABASE_URL`, `TEST_DATABASE_URL` | API | `postgresql+asyncpg://…` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | API | AI features. When unset, those features return 503 and capture still works. |
| `AUTH_SECRET`, `AUTH_BASE_URL` | API | Session verification (stage 05) |
| `CORS_ORIGINS` | API | JSON list or comma-separated |
| `MAX_REQUEST_BYTES` | API | Request body cap |
| `REDIS_URL` | API | Only when background jobs are added |

## 8. Running each app on its own

```bash
# API (from backend/, venv active)
uvicorn app.main:app --reload --port 8000
# check: http://localhost:8000/api/v1/health/ready  ·  docs: http://localhost:8000/docs

# Web (from frontend/)
npm run dev
# http://localhost:3000
```

Neither app needs the other to start. The web app's product calls fail with a readable `network_error` while the API is down. The API answers without the web app.

## 9. Checks

| App | Commands |
|---|---|
| API | `pytest` (from `backend/`) |
| Web | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (from `frontend/`) |
