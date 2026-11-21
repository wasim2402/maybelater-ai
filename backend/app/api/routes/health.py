import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import Settings
from app.core.deps import app_settings
from app.db.session import engine
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger("app.health")


@router.get("", response_model=HealthResponse)
async def health(settings: Settings = Depends(app_settings)) -> HealthResponse:
    """Liveness: the process is up. Does not touch the database."""
    return HealthResponse(status="ok", environment=settings.app_env)


@router.get("/ready", response_model=ReadinessResponse, responses={503: {"model": ReadinessResponse}})
async def ready(settings: Settings = Depends(app_settings)) -> JSONResponse:
    """Readiness: the API can reach PostgreSQL. 503 when it cannot."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        database = "ok"
    except Exception as exc:  # noqa: BLE001 - any failure means "not ready"
        logger.warning("database not reachable", extra={"error_type": type(exc).__name__})
        database = "unavailable"
    body = ReadinessResponse(
        status="ok" if database == "ok" else "degraded",
        database=database,
        ai="configured" if settings.ai_configured else "not_configured",
    )
    return JSONResponse(status_code=200 if database == "ok" else 503, content=body.model_dump())
