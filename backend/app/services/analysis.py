"""AI analysis as a separate step after capture. Capture never waits for it and never fails because of it.

Flow: capture stores the item with analysis_status `pending` (or `off` when no AI provider is
configured), the route schedules `run_analysis` to run after the response, and `run_analysis`
records the outcome. The analyzer that actually calls the model, and applies suggestions while
respecting field_states, is added in stage 07; until then a configured provider still reports
"not available" and the item is marked `failed` with the original kept intact.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.models import Intention, IntentionAnalysis
from app.models.enums import ActivityType, AnalysisRunStatus, AnalysisStatus
from app.services.activity import record_activity
from app.services.ai.provider import get_ai_provider

logger = logging.getLogger("app.analysis")

Analyzer = Callable[[AsyncSession, Intention, IntentionAnalysis], Awaitable[None]]


def initial_analysis_status(settings: Settings) -> str:
    return AnalysisStatus.PENDING.value if settings.ai_configured else AnalysisStatus.OFF.value


async def default_analyzer(session: AsyncSession, intention: Intention, run: IntentionAnalysis) -> None:
    """Placeholder until stage 07: the provider boundary answers 'not configured'."""
    provider = get_ai_provider()
    from pydantic import BaseModel

    class _Pending(BaseModel):
        title: str

    await provider.structured(system="", user="", output=_Pending)


async def run_analysis(
    session_factory: async_sessionmaker[AsyncSession],
    intention_id: uuid.UUID,
    user_id: uuid.UUID,
    analyzer: Analyzer = default_analyzer,
) -> None:
    """Runs one analysis. Safe to call after the item was deleted (it does nothing then)."""
    async with session_factory() as session:
        intention = (
            await session.execute(select(Intention).where(Intention.id == intention_id, Intention.user_id == user_id))
        ).scalar_one_or_none()
        if intention is None or intention.analysis_status != AnalysisStatus.PENDING.value:
            return  # deleted meanwhile, or analysis turned off: nothing to do

        run = IntentionAnalysis(user_id=user_id, intention_id=intention_id)
        session.add(run)
        await session.flush()
        try:
            await analyzer(session, intention, run)
        except Exception as exc:  # noqa: BLE001 - every failure leaves the capture intact
            await session.rollback()
            code = exc.code if isinstance(exc, AppError) else "analysis_error"
            if not isinstance(exc, AppError):
                logger.exception("analysis failed", extra={"intention_id": str(intention_id)})
            await _mark_failed(session_factory, intention_id, user_id, code)
            return
        run.status = AnalysisRunStatus.SUCCEEDED.value
        run.completed_at = utc_now()
        intention.analysis_status = AnalysisStatus.READY.value
        await record_activity(session, user_id, ActivityType.ANALYSIS_COMPLETED, intention_id)
        await session.commit()


async def _mark_failed(
    session_factory: async_sessionmaker[AsyncSession], intention_id: uuid.UUID, user_id: uuid.UUID, code: str
) -> None:
    async with session_factory() as session:
        intention = (
            await session.execute(select(Intention).where(Intention.id == intention_id, Intention.user_id == user_id))
        ).scalar_one_or_none()
        if intention is None:
            return  # deleted while the analysis ran
        intention.analysis_status = AnalysisStatus.FAILED.value
        session.add(
            IntentionAnalysis(
                user_id=user_id, intention_id=intention_id, status=AnalysisRunStatus.FAILED.value, error_code=code[:60], completed_at=utc_now()
            )
        )
        await record_activity(session, user_id, ActivityType.ANALYSIS_FAILED, intention_id, code=code[:60])
        await session.commit()
