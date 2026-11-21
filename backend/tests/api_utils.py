"""Shared pieces for API tests that need a signed-in user and the real test database."""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.auth import TokenVerifier
from app.core.config import Settings
from app.core.deps import db_session
from app.core.rate_limit import limiter
from app.main import create_app
from tests.db_utils import run

ISSUER = "http://localhost:3000"
AUDIENCE = "maybelater-api"
PRIVATE_KEY = Ed25519PrivateKey.generate()


class StaticResolver:
    def __init__(self, key) -> None:
        self.key = key

    def key_for(self, token: str):
        return self.key


def make_token(sub: str = "auth-user-1", *, key=PRIVATE_KEY, alg: str = "EdDSA", **overrides) -> str:
    now = int(time.time())
    claims = {"sub": sub, "iss": ISSUER, "aud": AUDIENCE, "iat": now, "exp": now + 900, "email": f"{sub}@example.com", "name": "Ana"}
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg, headers={"kid": "test-key"})


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def as_user(sub: str) -> dict[str, str]:
    return bearer(make_token(sub))


def wipe_users(db_url: str) -> None:
    async def wipe(engine):
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users"))

    run(wipe, db_url)


@contextmanager
def api_client(db_url: str, **settings_overrides) -> Iterator[TestClient]:
    """An app wired to the test database, accepting tokens signed with PRIVATE_KEY."""
    limiter.reset()
    wipe_users(db_url)
    settings = Settings(app_env="test", cors_origins=["http://localhost:3000"], auth_base_url=ISSUER, _env_file=None, **settings_overrides)  # type: ignore[call-arg]
    app = create_app(settings)
    app.state.token_verifier = TokenVerifier(StaticResolver(PRIVATE_KEY.public_key()), issuer=ISSUER, audience=AUDIENCE)

    def factory():
        # A fresh engine per use: each TestClient request runs on its own event loop.
        engine = create_async_engine(db_url, poolclass=NullPool)
        return async_sessionmaker(engine, expire_on_commit=False)

    async def test_db():
        maker = factory()
        try:
            async with maker() as session:
                yield session
        finally:
            await maker.kw["bind"].dispose()

    app.dependency_overrides[db_session] = test_db
    app.state.session_factory = async_sessionmaker(create_async_engine(db_url, poolclass=NullPool), expire_on_commit=False)
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
