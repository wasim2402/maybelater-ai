"""Capture and the inbox: POST /captures, and list / read / edit / delete /intentions."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.deps import app_settings, current_user, db_session
from app.core.errors import AppError
from app.core.rate_limit import RateLimit
from app.db.session import SessionLocal
from app.models import Category, Intention, User
from app.schemas.intentions import (
    CaptureCreate,
    CaptureResult,
    CategoryOut,
    IntentionOut,
    IntentionPage,
    IntentionUpdate,
    StatusFilter,
)
from app.services import intentions as service
from app.services.analysis import initial_analysis_status, run_analysis
from app.services.capture import capture

router = APIRouter(tags=["intentions"])


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
            background.add_task(run_analysis, factory, item.id, user.id)
    else:
        response.status_code = status.HTTP_200_OK
    return CaptureResult(result=result, item=to_out(item))


@router.get("/intentions", response_model=IntentionPage)
async def list_intentions(
    status_filter: StatusFilter = Query(default="open", alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=512),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> IntentionPage:
    try:
        items, next_cursor = await service.list_intentions(session, user, status=status_filter, limit=limit, cursor=cursor)
    except service.BadCursor as exc:
        raise InvalidCursorError() from exc
    return IntentionPage(items=[to_out(i) for i in items], next_cursor=next_cursor)


@router.get("/intentions/{intention_id}", response_model=IntentionOut)
async def read_intention(intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> IntentionOut:
    return to_out(await service.get_intention(session, user, intention_id))


@router.patch("/intentions/{intention_id}", response_model=IntentionOut)
async def update_intention(
    intention_id: UUID, body: IntentionUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)
) -> IntentionOut:
    return to_out(await service.update_intention(session, user, intention_id, body))


@router.delete("/intentions/{intention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intention(intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> Response:
    await service.delete_intention(session, user, intention_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/categories", response_model=list[CategoryOut], tags=["categories"])
async def list_categories(user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> list[CategoryOut]:
    return [c for c in (category_out(cat) for cat in await service.list_categories(session, user)) if c]
