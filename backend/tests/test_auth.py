"""Token verification and the account endpoints, against the real test database.

Tokens are signed here with a throwaway Ed25519 key, exactly as Better Auth signs them (EdDSA, kid,
iss = web app URL, aud = maybelater-api), and the verifier is given the matching public key.
"""

from __future__ import annotations

import time
from collections.abc import Iterator

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.auth import TokenVerifier
from app.core.config import Settings
from app.core.deps import db_session
from app.core.rate_limit import limiter
from app.main import create_app
from app.models import Intention, User
from tests.db_utils import migrate, require_test_database_url, run

ISSUER = "http://localhost:3000"
AUDIENCE = "maybelater-api"
PRIVATE_KEY = Ed25519PrivateKey.generate()
OTHER_KEY = Ed25519PrivateKey.generate()


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


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    migrate(url)
    return url


@pytest.fixture
def client(db_url: str) -> Iterator[TestClient]:
    limiter.reset()

    async def wipe(engine):
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users"))

    run(wipe, db_url)

    settings = Settings(app_env="test", cors_origins=["http://localhost:3000"], auth_base_url=ISSUER, _env_file=None)  # type: ignore[call-arg]
    app = create_app(settings)
    app.state.token_verifier = TokenVerifier(StaticResolver(PRIVATE_KEY.public_key()), issuer=ISSUER, audience=AUDIENCE)

    async def test_db():
        engine = create_async_engine(db_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                yield session
        finally:
            await engine.dispose()

    app.dependency_overrides[db_session] = test_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# --- rejected credentials -------------------------------------------------------------------------


def test_missing_token_is_401(client: TestClient) -> None:
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


@pytest.mark.parametrize(
    "authorization",
    ["Bearer", "Basic abc", "Bearer not-a-jwt", "Token " + "x" * 20],
)
def test_malformed_authorization_is_401(client: TestClient, authorization: str) -> None:
    assert client.get("/api/v1/me", headers={"Authorization": authorization}).status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(make_token(exp=int(time.time()) - 120), id="expired"),
        pytest.param(make_token(aud="some-other-api"), id="wrong-audience"),
        pytest.param(make_token(iss="https://evil.example"), id="wrong-issuer"),
        pytest.param(make_token(key=OTHER_KEY), id="wrong-signing-key"),
        pytest.param(make_token(sub=None), id="no-subject"),
        pytest.param(make_token(exp=None), id="no-expiry"),
    ],
)
def test_invalid_tokens_are_401(client: TestClient, token: str) -> None:
    response = client.get("/api/v1/me", headers=bearer(token))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_expired_token_says_session_ended(client: TestClient) -> None:
    response = client.get("/api/v1/me", headers=bearer(make_token(exp=int(time.time()) - 120)))
    assert "session has ended" in response.json()["error"]["message"]


def test_hmac_and_none_algorithms_are_refused(client: TestClient) -> None:
    now = int(time.time())
    claims = {"sub": "attacker", "iss": ISSUER, "aud": AUDIENCE, "iat": now, "exp": now + 900}
    hs = jwt.encode(claims, "guessable-secret-" * 3, algorithm="HS256")
    none = jwt.encode(claims, None, algorithm="none")
    assert client.get("/api/v1/me", headers=bearer(hs)).status_code == 401
    assert client.get("/api/v1/me", headers=bearer(none)).status_code == 401


# --- accepted credentials and the account ----------------------------------------------------------


def test_first_request_creates_the_app_user(client: TestClient) -> None:
    response = client.get("/api/v1/me", headers=bearer(make_token("auth-ana")))
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "auth-ana@example.com"
    assert body["display_name"] == "Ana"
    assert body["timezone"] == "UTC"
    assert body["preferences"]["reminders"]["enabled"] is True
    # second request: same user, not a duplicate
    again = client.get("/api/v1/me", headers=bearer(make_token("auth-ana")))
    assert again.json()["id"] == body["id"]


def test_user_id_in_body_is_ignored(client: TestClient) -> None:
    ana = client.get("/api/v1/me", headers=bearer(make_token("auth-ana"))).json()
    bob = client.get("/api/v1/me", headers=bearer(make_token("auth-bob"))).json()
    response = client.patch("/api/v1/me", headers=bearer(make_token("auth-bob")), json={"id": ana["id"], "display_name": "Mallory"})
    assert response.status_code == 422  # unknown fields are rejected outright
    assert client.get("/api/v1/me", headers=bearer(make_token("auth-ana"))).json()["display_name"] == "Ana"
    assert bob["id"] != ana["id"]


def test_settings_persist(client: TestClient) -> None:
    token = make_token("auth-ana")
    response = client.patch(
        "/api/v1/me",
        headers=bearer(token),
        json={"display_name": "Ana R.", "timezone": "Asia/Kolkata", "preferences": {"resurfacing": {"frequency": "weekly"}, "reduce_motion": True}},
    )
    assert response.status_code == 200
    body = client.get("/api/v1/me", headers=bearer(token)).json()
    assert body["display_name"] == "Ana R."
    assert body["timezone"] == "Asia/Kolkata"
    assert body["preferences"]["resurfacing"]["frequency"] == "weekly"
    assert body["preferences"]["reduce_motion"] is True


@pytest.mark.parametrize(
    "payload",
    [{"timezone": "Mars/Olympus"}, {"preferences": {"resurfacing": {"frequency": "hourly"}}}, {"display_name": "x" * 121}],
)
def test_invalid_settings_are_422(client: TestClient, payload: dict) -> None:
    response = client.patch("/api/v1/me", headers=bearer(make_token()), json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_delete_removes_only_my_data(client: TestClient, db_url: str) -> None:
    ana_id = client.get("/api/v1/me", headers=bearer(make_token("auth-ana"))).json()["id"]
    bob_id = client.get("/api/v1/me", headers=bearer(make_token("auth-bob"))).json()["id"]

    async def add_items(engine):
        async with async_sessionmaker(engine)() as session:
            session.add_all(
                [
                    Intention(user_id=ana_id, source_type="text", original_content="ana's note"),
                    Intention(user_id=bob_id, source_type="text", original_content="bob's note"),
                ]
            )
            await session.commit()

    run(add_items, db_url)

    assert client.delete("/api/v1/me", headers=bearer(make_token("auth-ana"))).status_code == 204

    async def counts(engine):
        async with async_sessionmaker(engine)() as session:
            users = (await session.execute(select(func.count()).select_from(User))).scalar_one()
            items = (await session.execute(select(Intention.original_content))).scalars().all()
            return users, items

    assert run(counts, db_url) == (1, ["bob's note"])


def test_rate_limit_is_keyed_per_user_after_auth(client: TestClient) -> None:
    for _ in range(5):
        assert client.delete("/api/v1/me", headers=bearer(make_token("auth-ana"))).status_code == 204
    assert client.delete("/api/v1/me", headers=bearer(make_token("auth-ana"))).status_code == 429
