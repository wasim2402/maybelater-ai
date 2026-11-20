# 14 — Deployment and Operations

## Objective
Prepare a secure, observable deployment for the MaybeLater MVP.

## Initial hosting target
- Web: Vercel.
- API: Railway.
- PostgreSQL: managed PostgreSQL on Railway or another managed provider.
- Redis/worker: Railway when background jobs are enabled.

These are initial targets, not hard dependencies. Confirm current pricing, limits and service compatibility before production setup.

## Environments
Maintain separate development, staging and production configuration. Never reuse production secrets in local development.

## Required production setup
- HTTPS.
- Restricted CORS origins.
- Secure authentication cookie/session configuration.
- Production database credentials.
- Secret management through hosting provider settings.
- Database migrations as a controlled deployment step.
- Health/readiness endpoint.
- Structured logs and error reporting.
- Database backup and restore plan.
- Rate limits on authentication, capture and AI endpoints.

## Deployment sequence
1. Provision database.
2. Configure API environment variables.
3. Deploy API and verify health.
4. Run Alembic migrations.
5. Configure web API URL and auth settings.
6. Deploy web app.
7. Verify sign up/login, capture, AI analysis and user isolation.
8. Enable worker/Redis only when reminder jobs are ready.
9. Run smoke tests.

## Operations
- Track API error rate, latency and AI provider failures.
- Track background job failures and retries.
- Avoid logging private saved content.
- Define a backup retention policy.
- Test restore procedures.
- Document rollback steps.

## Deliverable
A repeatable deployment checklist, environment variable reference, health check and post-deployment smoke test.
