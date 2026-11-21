from collections.abc import Iterator

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.config import Settings
from app.core.errors import NotFoundError
from app.core.rate_limit import RateLimit, limiter
from app.main import create_app

WEB_ORIGIN = "http://localhost:3000"


class EchoIn(BaseModel):
    text: str = Field(min_length=1, max_length=50)


def _probe_router() -> APIRouter:
    """Routes that exist only in tests, to exercise the error paths."""
    router = APIRouter(prefix="/api/v1/_probe")

    @router.get("/crash")
    async def crash() -> None:
        raise RuntimeError("secret internals: password=hunter2")

    @router.get("/missing")
    async def missing() -> None:
        raise NotFoundError()

    @router.post("/echo")
    async def echo(body: EchoIn) -> dict[str, int]:
        return {"length": len(body.text)}

    @router.get("/limited", dependencies=[Depends(RateLimit("probe", limit=2, window_seconds=60))])
    async def limited() -> dict[str, bool]:
        return {"ok": True}

    return router


@pytest.fixture
def settings() -> Settings:
    return Settings(app_env="test", cors_origins=[WEB_ORIGIN], max_request_bytes=2048, _env_file=None)  # type: ignore[call-arg]


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    limiter.reset()
    app = create_app(settings)
    app.include_router(_probe_router())
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    limiter.reset()
