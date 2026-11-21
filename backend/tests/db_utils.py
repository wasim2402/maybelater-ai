"""Helpers for tests that need the real PostgreSQL test database (TEST_DATABASE_URL)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TypeVar

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import get_settings

T = TypeVar("T")
BACKEND = Path(__file__).resolve().parents[1]


def require_test_database_url() -> str:
    url = get_settings().test_database_url
    if not url:
        pytest.skip("TEST_DATABASE_URL is not set")
    if url == get_settings().database_url:
        pytest.fail("TEST_DATABASE_URL must point at a separate database: these tests drop every table")
    return url


def alembic_config(url: str) -> Config:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def run(coro_factory: Callable[[AsyncEngine], Awaitable[T]], url: str) -> T:
    """Runs an async block against a fresh engine (each test owns its event loop)."""

    async def main() -> T:
        engine = create_async_engine(url)
        try:
            return await coro_factory(engine)
        finally:
            await engine.dispose()

    return asyncio.run(main())


def migrate(url: str, target: str = "head") -> None:
    command.upgrade(alembic_config(url), target)


def downgrade(url: str, target: str = "base") -> None:
    command.downgrade(alembic_config(url), target)
