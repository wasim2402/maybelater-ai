"""Migrations against the real PostgreSQL test database: fresh install, downgrade/upgrade, and no drift
between the SQLAlchemy models and what the migrations build."""

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text

from app.models import Base
from tests.db_utils import downgrade, migrate, run, require_test_database_url

EXPECTED_TABLES = {"activities", "alembic_version", "categories", "intention_analyses", "intentions", "reminder_deliveries", "reminders", "users"}


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    downgrade(url)
    migrate(url)
    return url


async def _tables(engine) -> set[str]:
    async with engine.connect() as conn:
        rows = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        return {r[0] for r in rows}


def test_fresh_migration_creates_schema_and_seed(db_url: str) -> None:
    assert run(_tables, db_url) == EXPECTED_TABLES

    async def system_categories(engine):
        async with engine.connect() as conn:
            return (await conn.execute(text("SELECT count(*) FROM categories WHERE user_id IS NULL"))).scalar_one()

    assert run(system_categories, db_url) == 9


def test_models_match_migrations(db_url: str) -> None:
    """Fails when a model changes without a migration (run `alembic revision --autogenerate`)."""

    async def diff(engine):
        async with engine.connect() as conn:
            return await conn.run_sync(lambda sync: compare_metadata(MigrationContext.configure(sync, opts={"compare_type": True}), Base.metadata))

    assert run(diff, db_url) == []


def test_downgrade_then_upgrade(db_url: str) -> None:
    downgrade(db_url)
    assert run(_tables, db_url) == {"alembic_version"}
    migrate(db_url)
    assert run(_tables, db_url) == EXPECTED_TABLES
