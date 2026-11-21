import asyncio
from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.core.config import Settings
from app.core.errors import ProviderNotConfiguredError, UnsafeUrlError
from app.core.rate_limit import SlidingWindowLimiter
from app.core.time import ensure_utc, zone
from app.core.url_safety import resolve_public_url, validate_capture_url
from app.services.ai.provider import get_ai_provider


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/article",
        "http://example.org/a?b=c#d",
        "https://sub.example.co.uk:8443/path",
        "https://93.184.216.34/page",
    ],
)
def test_public_urls_pass_shape_check(url: str) -> None:
    assert validate_capture_url(f"  {url} ") == url


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/file",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "http://localhost:8000/admin",
        "http://app.localhost/",
        "http://printer.local/",
        "http://127.0.0.1/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://0.0.0.0/",
        "https://user:pass@example.com/",
        "https://example.com:22/",
        "http:///no-host",
        "https://example.com/" + "a" * 2100,
    ],
)
def test_unsafe_urls_are_rejected(url: str) -> None:
    with pytest.raises(UnsafeUrlError):
        validate_capture_url(url)


def test_resolve_rejects_host_resolving_to_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_getaddrinfo(*_args, **_kwargs):
        return [(None, None, None, "", ("127.0.0.1", 80))]

    loop_cls = type(asyncio.new_event_loop())
    monkeypatch.setattr(loop_cls, "getaddrinfo", lambda self, *a, **k: fake_getaddrinfo(*a, **k))
    with pytest.raises(UnsafeUrlError):
        asyncio.run(resolve_public_url("https://rebind.example.com/"))


def test_resolve_accepts_public_address(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_getaddrinfo(*_args, **_kwargs):
        return [(None, None, None, "", ("93.184.216.34", 443))]

    loop_cls = type(asyncio.new_event_loop())
    monkeypatch.setattr(loop_cls, "getaddrinfo", lambda self, *a, **k: fake_getaddrinfo(*a, **k))
    assert asyncio.run(resolve_public_url("https://example.com/")) == "https://example.com/"


def test_sliding_window_limiter() -> None:
    limiter = SlidingWindowLimiter()
    assert limiter.hit("k", limit=2, window_seconds=10, now=0) is None
    assert limiter.hit("k", limit=2, window_seconds=10, now=1) is None
    assert limiter.hit("k", limit=2, window_seconds=10, now=2) == 8
    assert limiter.hit("other", limit=2, window_seconds=10, now=2) is None
    assert limiter.hit("k", limit=2, window_seconds=10, now=10.5) is None


def test_ensure_utc() -> None:
    plus_five = datetime(2026, 11, 21, 15, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    assert ensure_utc(plus_five) == datetime(2026, 11, 21, 9, 30, tzinfo=UTC)
    with pytest.raises(ValueError):
        ensure_utc(datetime(2026, 11, 21, 15, 0))
    assert zone("Asia/Kolkata").key == "Asia/Kolkata"
    with pytest.raises(ValueError):
        zone("Mars/Olympus")


def test_cors_origins_parsing_and_wildcard_rejected() -> None:
    assert Settings(cors_origins="https://a.example, https://b.example/", _env_file=None).cors_origins == [  # type: ignore[call-arg]
        "https://a.example",
        "https://b.example",
    ]
    assert Settings(cors_origins='["https://a.example"]', _env_file=None).cors_origins == ["https://a.example"]  # type: ignore[call-arg]
    with pytest.raises(ValueError):
        Settings(cors_origins="*", _env_file=None)  # type: ignore[call-arg]


def test_production_requires_auth_secret() -> None:
    with pytest.raises(ValueError):
        Settings(app_env="production", auth_secret="", cors_origins="https://app.example", _env_file=None)  # type: ignore[call-arg]
    ok = Settings(app_env="production", auth_secret="s" * 40, cors_origins="https://app.example", _env_file=None)  # type: ignore[call-arg]
    assert ok.app_env == "production"


def test_unconfigured_ai_provider_raises_clear_error() -> None:
    provider = get_ai_provider(Settings(openai_api_key="", openai_model="", _env_file=None))  # type: ignore[call-arg]
    with pytest.raises(ProviderNotConfiguredError):
        asyncio.run(provider.structured(system="s", user="u", output=Settings))
