# 04 — Database and Data Models

## Objective
Design the initial PostgreSQL schema and implement it with SQLAlchemy 2 and Alembic migrations.

## Core entities
### User
- `id`
- authentication subject/provider reference
- email and display name where available
- timezone and preferences
- created/updated timestamps

### Intention
- `id`, `user_id`
- source type (`text`, `url`, later `image`, `voice`)
- original content and original URL
- title and summary
- extracted intent and category
- status (`inbox`, `active`, `completed`, `archived`)
- optional user-defined context
- created/updated timestamps

### Reminder
- `id`, `user_id`, `intention_id`
- scheduled timestamp
- timezone
- status (`scheduled`, `sent`, `snoozed`, `cancelled`)
- approval timestamp and delivery metadata
- created/updated timestamps

### Category
- `id`, optional `user_id`
- name, description and optional icon key
- distinguish system categories from user-defined categories

### Activity
- `id`, `user_id`, `intention_id`
- event type
- minimal structured metadata
- created timestamp

## Data rules
- Use UUID primary keys unless the existing project has a consistent alternative.
- Add foreign keys and indexes for user ownership, status, created time and reminder due time.
- Use database constraints for valid statuses and required fields.
- Store timestamps in UTC; preserve the user's timezone for scheduling and display.
- Keep original captured content separate from AI-generated fields.
- Add a way to distinguish AI-generated values from user-edited values, or otherwise ensure later AI analysis never overwrites user edits.
- Define deletion behavior explicitly. Deleting an intention should not leave active reminders orphaned.
- Add uniqueness constraints only where product rules require them.

## Migrations
- Create migrations with Alembic.
- Never rely on `create_all()` as the production schema management strategy.
- Test both fresh database migration and upgrade from the previous migration.
- Do not rewrite old migrations after they have been applied in shared environments.

## Privacy
- Do not store unnecessary scraped page content.
- Consider content retention and account deletion behavior.
- Never put secrets in database seed data.

## Deliverable
Add SQLAlchemy models, relationships, indexes, constraints and an initial Alembic migration. Include a concise schema diagram in the project documentation.
