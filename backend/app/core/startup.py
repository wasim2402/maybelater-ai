"""The start-up status panel: what the API can reach, checked once when the server starts.

    MaybeLater API  0.1.0  development
    ──────────────────────────────────────────────────────────────
    ●  Database     connected · PostgreSQL 18.4 · migration 08f4688f0da9
    ●  Sign-in      keys reachable · http://localhost:3000/api/auth/jwks
    ○  AI           not configured · set GEMINI_API_KEY
    ●  CORS         http://localhost:3000
       API          http://127.0.0.1:8000/api/v1
       Docs         http://127.0.0.1:8000/docs

Checks are short (2-3 s timeouts) and never stop the server: a red dot is a hint, not a crash.
In JSON mode the same facts are logged as one `startup` event.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from dataclasses import dataclass

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import Settings
from app.core.logging import Style, colour_supported

logger = logging.getLogger("app.startup")


@dataclass
class Check:
    name: str
    state: str  # "ok" | "warn" | "off" | "info"
    detail: str


async def check_database(engine: AsyncEngine) -> Check:
    try:
        async with asyncio.timeout(3):
            async with engine.connect() as conn:
                version = (await conn.execute(text("SHOW server_version"))).scalar_one()
                try:
                    revision = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()
                except Exception:  # noqa: BLE001 - table missing means "not migrated"
                    revision = None
        major = str(version).split(" ")[0]
        if not revision:
            return Check("Database", "warn", f"connected · PostgreSQL {major} · not migrated: run `alembic upgrade head`")
        return Check("Database", "ok", f"connected · PostgreSQL {major} · migration {revision}")
    except Exception as exc:  # noqa: BLE001
        return Check("Database", "warn", f"unreachable ({type(exc).__name__}) · check DATABASE_URL and that PostgreSQL is running")


async def check_auth_keys(settings: Settings) -> Check:
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            response = await client.get(settings.auth_jwks_url)
        keys = response.json().get("keys", []) if response.status_code == 200 else []
        if keys:
            return Check("Sign-in", "ok", f"keys reachable · {settings.auth_jwks_url}")
        return Check("Sign-in", "warn", f"no keys at {settings.auth_jwks_url} (HTTP {response.status_code})")
    except Exception:  # noqa: BLE001
        return Check("Sign-in", "warn", f"web app not reachable yet · start the frontend ({settings.auth_base_url})")


def ai_check(settings: Settings) -> Check:
    if settings.ai_configured:
        fallback = f" · fallback {settings.gemini_fallback_model}" if settings.gemini_fallback_model else ""
        return Check("AI", "ok", f"configured · Gemini {settings.gemini_model}{fallback}")
    return Check("AI", "off", "not configured · set GEMINI_API_KEY")


def public_base(settings: Settings) -> str:
    """The address the server listens on, from uvicorn's --host/--port when given."""
    host, port = settings.api_host, str(settings.api_port)
    argv = sys.argv
    for flag in ("--host", "--port"):
        if flag in argv and argv.index(flag) + 1 < len(argv):
            value = argv[argv.index(flag) + 1]
            host, port = (value, port) if flag == "--host" else (host, value)
    if host in ("0.0.0.0", "::"):
        host = "localhost"
    return f"http://{host}:{port}"


async def run_checks(settings: Settings, engine: AsyncEngine) -> list[Check]:
    database, auth = await asyncio.gather(check_database(engine), check_auth_keys(settings))
    base = public_base(settings)
    checks = [database, auth, ai_check(settings), Check("CORS", "ok", ", ".join(settings.cors_origins)), Check("API", "info", f"{base}/api/v1")]
    if settings.is_development:
        checks.append(Check("Docs", "info", f"{base}/docs"))
    return checks


def unicode_ok(stream: object) -> bool:
    encoding = getattr(stream, "encoding", None) or "ascii"
    try:
        "●○─·".encode(encoding)
        return True
    except (UnicodeEncodeError, LookupError):
        return False


def render(checks: list[Check], settings: Settings, version: str, colour: bool, unicode: bool = True) -> str:
    s = Style(colour)
    dot, ring, line = ("●", "○", "─") if unicode else ("*", "o", "-")
    marks = {"ok": s(dot, "32"), "warn": s(dot, "33"), "off": s(ring, "2"), "info": " "}
    title = f"  {s.bold('MaybeLater API')}  {s.dim(version)}  {s(settings.app_env, '36')}"
    rule = s.dim("  " + line * 62)
    lines = ["", title, rule]
    for check in checks:
        detail = check.detail if unicode else check.detail.replace("·", "-")
        detail = s.dim(detail) if check.state in ("off", "info") else detail
        lines.append(f"  {marks[check.state]}  {check.name:<11}  {detail}")
    lines.append("")
    return "\n".join(lines)


async def report_startup(settings: Settings, engine: AsyncEngine, version: str, log_format: str) -> None:
    checks = await run_checks(settings, engine)
    if log_format == "pretty":
        print(render(checks, settings, version, colour_supported(sys.stdout), unicode_ok(sys.stdout)), flush=True)
    else:
        logger.info("startup", extra={"version": version, "checks": {c.name: {"state": c.state, "detail": c.detail} for c in checks}})
