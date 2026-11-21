"""AI analysis as a separate step after capture. Capture never waits for it and never fails because of it.

Flow: capture stores the item with analysis_status `pending` (or `off` when no AI provider is
configured), the route schedules `run_analysis` after the response, and `run_analysis`:
  1. reloads the item (doing nothing if it was deleted meanwhile);
  2. fetches safe page metadata for links (title/description only);
  3. asks the provider for a validated IntentionAnalysisOutput;
  4. stores the run (provider, model, prompt version, output) and applies suggestions only to fields
     whose state is absent or `suggested`. Fields the user accepted, edited or dismissed never change;
  5. on any failure marks the item `failed` with an error code. The capture itself is untouched.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import utc_now
from app.models import Category, Intention, IntentionAnalysis
from app.models.enums import ActivityType, AnalysisRunStatus, AnalysisStatus, FieldState
from app.services.activity import record_activity
from app.services.ai.prompts import PROMPT_VERSION, PageMetadata, build_system_prompt, build_user_input
from app.services.ai.provider import AIProvider, get_ai_provider
from app.services.ai.schemas import IntentionAnalysisOutput
from app.services.page_metadata import fetch_page_metadata

logger = logging.getLogger("app.analysis")

Analyzer = Callable[[AsyncSession, Intention, IntentionAnalysis], Awaitable[None]]
MetadataFetcher = Callable[[str], Awaitable[PageMetadata | None]]

# AI output field -> intention field (key in field_states)
SUGGESTIBLE = ("title", "summary", "intent", "category", "tags", "resurface_condition")


def initial_analysis_status(settings: Settings) -> str:
    return AnalysisStatus.PENDING.value if settings.ai_configured else AnalysisStatus.OFF.value


def may_suggest(states: dict[str, str], field: str) -> bool:
    """AI may write a field only while nobody has decided about it."""
    return states.get(field) in (None, FieldState.SUGGESTED.value)


async def apply_suggestions(session: AsyncSession, intention: Intention, output: IntentionAnalysisOutput) -> list[str]:
    """Writes suggestions into the intention where allowed. Empty answers never clear a value."""
    states = dict(intention.field_states or {})
    applied: list[str] = []

    def suggest(field: str, value: object) -> None:
        if value and may_suggest(states, field):
            setattr(intention, field, value)
            states[field] = FieldState.SUGGESTED.value
            applied.append(field)

    suggest("title", output.title)
    suggest("summary", output.summary)
    suggest("intent", output.intent)
    suggest("tags", output.suggested_tags)
    suggest("resurface_condition", output.suggested_resurface_condition)

    if output.category and output.category != "none" and may_suggest(states, "category"):
        category = (
            await session.execute(
                select(Category).where(
                    Category.slug == output.category,
                    or_(Category.user_id.is_(None), Category.user_id == intention.user_id),
                )
            )
        ).scalars().first()
        if category is not None:  # an unknown slug from the model is ignored, never created
            intention.category_id = category.id
            states["category"] = FieldState.SUGGESTED.value
            applied.append("category")

    intention.field_states = states
    return applied


async def _category_slugs(session: AsyncSession, intention: Intention) -> list[str]:
    rows = await session.execute(
        select(Category.slug).where(or_(Category.user_id.is_(None), Category.user_id == intention.user_id)).order_by(Category.slug)
    )
    return list(rows.scalars().all())


def make_capture_analyzer(provider: AIProvider, fetch_metadata: MetadataFetcher = fetch_page_metadata) -> Analyzer:
    async def analyze(session: AsyncSession, intention: Intention, run: IntentionAnalysis) -> None:
        metadata = await fetch_metadata(intention.original_url) if intention.original_url else None
        output = await provider.structured(
            system=build_system_prompt(await _category_slugs(session, intention)),
            user=build_user_input(
                source_type=intention.source_type,
                content=intention.original_content,
                user_note=intention.user_note,
                metadata=metadata,
            ),
            output=IntentionAnalysisOutput,
        )
        # Record the model that actually answered (the fallback, when the main model was overloaded).
        run.provider, run.model, run.prompt_version = provider.name, getattr(provider, "last_model", provider.model), PROMPT_VERSION
        run.output = output.model_dump(mode="json")
        await apply_suggestions(session, intention, output)

    return analyze


async def run_analysis(
    session_factory: async_sessionmaker[AsyncSession],
    intention_id: uuid.UUID,
    user_id: uuid.UUID,
    analyzer: Analyzer | None = None,
) -> None:
    """Runs one analysis. Safe to call after the item was deleted (it does nothing then)."""
    analyzer = analyzer or make_capture_analyzer(get_ai_provider())
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
            else:
                logger.info("analysis failed", extra={"intention_id": str(intention_id), "code": code})
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


async def latest_confidence(session: AsyncSession, intention_id: uuid.UUID) -> float | None:
    """Confidence of the most recent successful analysis (shown only as a soft hint, never a guarantee)."""
    output = (
        await session.execute(
            select(IntentionAnalysis.output)
            .where(IntentionAnalysis.intention_id == intention_id, IntentionAnalysis.status == AnalysisRunStatus.SUCCEEDED.value)
            .order_by(IntentionAnalysis.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    value = (output or {}).get("confidence")
    return float(value) if isinstance(value, (int, float)) else None
