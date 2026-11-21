"""Capture and the inbox: POST /captures, and list / read / edit / delete /intentions."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.deps import app_settings, current_user, db_session
from app.core.errors import AppError, ProviderNotConfiguredError
from app.core.rate_limit import RateLimit
from app.db.session import SessionLocal
from app.models import Category, Intention, User
from app.schemas.intentions import (
    AnalyzeRequest,
    CaptureCreate,
    CaptureResult,
    CategoryOut,
    IntentionOut,
    IntentionPage,
    IntentionUpdate,
    StatusFilter,
    SuggestionDecision,
    SuggestionField,
)
from app.services import intentions as service
from app.services.analysis import Analyzer, initial_analysis_status, latest_confidence, run_analysis
from app.services.capture import capture

router = APIRouter(tags=["intentions"])


class InvalidFilterError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Some filters need attention."


class CategoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Write a name for the category.")
        return value


class TagCount(BaseModel):
    tag: str
    count: int


class InvalidCursorError(AppError):
    status_code = 400
    code = "invalid_cursor"
    message = "That page link has expired. Start again from the first page."


def category_out(category: Category | None) -> CategoryOut | None:
    if category is None:
        return None
    return CategoryOut(id=category.id, name=category.name, slug=category.slug, is_system=category.user_id is None)


def to_out(item: Intention) -> IntentionOut:
    return IntentionOut(
        id=item.id,
        source_type=item.source_type,
        original_content=item.original_content,
        original_url=item.original_url,
        user_note=item.user_note,
        title=item.title,
        summary=item.summary,
        intent=item.intent,
        category=category_out(item.category),
        tags=list(item.tags or []),
        resurface_condition=item.resurface_condition,
        field_states=dict(item.field_states or {}),
        analysis_status=item.analysis_status,
        status=item.status,
        resurface_at=item.resurface_at,
        snoozed_until=item.snoozed_until,
        completed_at=item.completed_at,
        archived_at=item.archived_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    """For work that outlives the request (analysis). Tests swap it via app.state."""
    return getattr(request.app.state, "session_factory", None) or SessionLocal


def analyzer(request: Request) -> Analyzer | None:
    """The analysis step; None means the real provider. Tests inject a fake via app.state."""
    return getattr(request.app.state, "analyzer", None)


@router.post(
    "/captures",
    response_model=CaptureResult,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": CaptureResult, "description": "Already saved (duplicate link or retried attempt)"}},
    dependencies=[Depends(RateLimit("capture", limit=30, window_seconds=60))],
)
async def create_capture(
    body: CaptureCreate,
    response: Response,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    settings: Settings = Depends(app_settings),
    factory: async_sessionmaker[AsyncSession] = Depends(session_factory),
    run_with: Analyzer | None = Depends(analyzer),
) -> CaptureResult:
    result, item = await capture(
        session,
        user,
        content=body.content,
        note=body.note,
        client_request_id=body.client_request_id,
        analysis_status=initial_analysis_status(settings),
    )
    if result == "created":
        if item.analysis_status == "pending":
            background.add_task(run_analysis, factory, item.id, user.id, run_with)
    else:
        response.status_code = status.HTTP_200_OK
    return CaptureResult(result=result, item=to_out(item))


@router.get("/intentions", response_model=IntentionPage)
async def list_intentions(
    status_filter: StatusFilter = Query(default="open", alias="status"),
    q: str | None = Query(default=None, max_length=200, description="Words to find in title, note, summary or the saved text"),
    category: str | None = Query(default=None, max_length=36, description="A category id, or 'none' for uncategorised"),
    tag: str | None = Query(default=None, max_length=40),
    created_after: datetime | None = Query(default=None, description="ISO 8601 with a time zone offset"),
    created_before: datetime | None = Query(default=None, description="ISO 8601 with a time zone offset"),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=512),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> IntentionPage:
    details = []
    category_id: UUID | None = None
    if category and category != "none":
        try:
            category_id = UUID(category)
        except ValueError:
            details.append({"field": "category", "issue": "Use a category id or 'none'."})
    for name, value in (("created_after", created_after), ("created_before", created_before)):
        if value is not None and value.utcoffset() is None:
            details.append({"field": name, "issue": "Include a time zone offset, e.g. 2026-11-21T00:00:00+05:30."})
    if created_after and created_before and created_after.utcoffset() is not None and created_before.utcoffset() is not None and created_after >= created_before:
        details.append({"field": "created_before", "issue": "The end must be after the start."})
    if details:
        raise InvalidFilterError(details=details)

    filters = service.IntentionFilters(
        status=status_filter,
        q=q,
        category=category_id,
        uncategorized=category == "none",
        tag=" ".join(tag.split()).lower() if tag else None,
        created_after=created_after,
        created_before=created_before,
    )
    try:
        items, next_cursor = await service.list_intentions(session, user, filters=filters, limit=limit, cursor=cursor)
    except service.BadCursor as exc:
        raise InvalidCursorError() from exc
    return IntentionPage(items=[to_out(i) for i in items], next_cursor=next_cursor)


@router.get("/intentions/{intention_id}", response_model=IntentionOut)
async def read_intention(intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> IntentionOut:
    out = to_out(await service.get_intention(session, user, intention_id))
    out.suggestion_confidence = await latest_confidence(session, intention_id)
    return out


@router.patch("/intentions/{intention_id}", response_model=IntentionOut)
async def update_intention(
    intention_id: UUID, body: IntentionUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)
) -> IntentionOut:
    return to_out(await service.update_intention(session, user, intention_id, body))


@router.delete("/intentions/{intention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intention(intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> Response:
    await service.delete_intention(session, user, intention_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, tags=["categories"])
async def create_category(body: CategoryCreate, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> CategoryOut:
    category = await service.create_category(session, user, body.name)
    out = category_out(category)
    assert out is not None
    return out


@router.get("/tags", response_model=list[TagCount], tags=["categories"])
async def list_tags(user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> list[TagCount]:
    return [TagCount(tag=t, count=n) for t, n in await service.list_tags(session, user)]


@router.get("/categories", response_model=list[CategoryOut], tags=["categories"])
async def list_categories(user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> list[CategoryOut]:
    return [c for c in (category_out(cat) for cat in await service.list_categories(session, user)) if c]


@router.post(
    "/intentions/{intention_id}/suggestions/{field}",
    response_model=IntentionOut,
    responses={409: {"description": "That field holds no suggestion"}},
)
async def decide_suggestion(
    intention_id: UUID,
    field: SuggestionField,
    body: SuggestionDecision,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> IntentionOut:
    return to_out(await service.decide_suggestion(session, user, intention_id, field, body.action))


@router.post(
    "/ai/analyze",
    response_model=IntentionOut,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["ai"],
    dependencies=[Depends(RateLimit("analyze", limit=10, window_seconds=60))],
)
async def analyze(
    body: AnalyzeRequest,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    settings: Settings = Depends(app_settings),
    factory: async_sessionmaker[AsyncSession] = Depends(session_factory),
    run_with: Analyzer | None = Depends(analyzer),
) -> IntentionOut:
    """Starts (or retries) AI analysis for one item. Returns at once with analysis_status `pending`;
    poll GET /intentions/{id} for the result. Fields the user decided on are never overwritten."""
    if not settings.ai_configured:
        raise ProviderNotConfiguredError("Suggestions are not switched on for this app yet.")
    item = await service.request_reanalysis(session, user, body.intention_id)
    background.add_task(run_analysis, factory, item.id, user.id, run_with)
    return to_out(item)
