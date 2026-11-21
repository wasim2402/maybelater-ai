import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging, resolve_format
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware
from app.core.startup import report_startup
from app.db.session import SessionLocal, engine
from app.schemas.common import ERROR_RESPONSES
from app.services.push import WebPushSender
from app.services.reminder_delivery import run_worker

VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    log_format = resolve_format(settings.log_format, settings.is_development)
    configure_logging(settings.log_level, log_format)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # The status panel (database, sign-in keys, AI, URLs). Skipped in tests, which build many apps.
        if settings.app_env != "test":
            await report_startup(settings, engine, VERSION, log_format)
        # Reminder delivery runs on the server (never in a browser tab). Off in tests, which call it directly.
        stop, worker = asyncio.Event(), None
        if settings.reminder_worker_enabled and settings.app_env != "test":
            sender = WebPushSender(settings) if settings.push_configured else None
            worker = asyncio.create_task(run_worker(SessionLocal, stop, settings.reminder_worker_interval_seconds, push_sender=sender))
        yield
        if worker is not None:
            stop.set()
            await worker

    app = FastAPI(
        title="MaybeLater API",
        version=VERSION,
        lifespan=lifespan,
        responses=ERROR_RESPONSES,
        # Interactive docs in development only.
        docs_url="/docs" if settings.is_development else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.is_development else None,
    )
    app.state.settings = settings

    # The last added runs outermost. Order, outside in:
    #   CORS -> request id + access log + crash guard -> body size cap -> routes.
    # CORS is outermost so every response the browser gets, a 500 or a 413 included, carries its headers.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )

    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
