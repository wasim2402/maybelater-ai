"""Resurfacing: the recommendations list and the user's actions on items that came back."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.intentions import to_out
from app.core.deps import current_user, db_session
from app.core.time import utc_now
from app.models import User
from app.schemas.intentions import IntentionOut
from app.services import recommendations as service
from app.services.resurfacing import NextAction, Preset, Signal

router = APIRouter(tags=["resurfacing"])


def clock(request: Request) -> Callable[[], datetime]:
    """The current time. Tests replace it via app.state.clock for deterministic results."""
    return getattr(request.app.state, "clock", None) or utc_now


class RecommendationOut(BaseModel):
    item: IntentionOut
    signal: Signal
    reason: str
    next_action: NextAction
    due_at: datetime


class RecommendationList(BaseModel):
    items: list[RecommendationOut]
    generated_at: datetime


class WhenRequest(BaseModel):
    """Either a preset (resolved on the server in the user's time zone) or an exact time with an offset."""

    model_config = ConfigDict(extra="forbid")

    preset: Preset | None = None
    at: datetime | None = None

    @model_validator(mode="after")
    def _one_of(self) -> "WhenRequest":
        if (self.preset is None) == (self.at is None):
            raise ValueError("Send either a preset or a time, not both.")
        if self.at is not None and self.at.utcoffset() is None:
            raise ValueError("Include a time zone offset.")
        return self


class BringBackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preset: Preset | None = None
    at: datetime | None = None
    clear: Literal[True] | None = None

    @model_validator(mode="after")
    def _one_of(self) -> "BringBackRequest":
        if sum(v is not None for v in (self.preset, self.at, self.clear)) != 1:
            raise ValueError("Send one of: preset, at, or clear.")
        if self.at is not None and self.at.utcoffset() is None:
            raise ValueError("Include a time zone offset.")
        return self


@router.get("/recommendations", response_model=RecommendationList)
async def list_recommendations(
    user: User = Depends(current_user), session: AsyncSession = Depends(db_session), now: Callable[[], datetime] = Depends(clock)
) -> RecommendationList:
    """Items worth another look now, strongest reason first. Deterministic rules only (no AI)."""
    moment = now()
    recs = await service.recommendations(session, user, moment)
    return RecommendationList(
        items=[
            RecommendationOut(item=to_out(r.item), signal=r.candidate.signal, reason=r.candidate.reason, next_action=r.candidate.next_action, due_at=r.candidate.due_at)
            for r in recs
        ],
        generated_at=moment,
    )


@router.post("/intentions/{intention_id}/snooze", response_model=IntentionOut)
async def snooze(
    intention_id: UUID,
    body: WhenRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    now: Callable[[], datetime] = Depends(clock),
) -> IntentionOut:
    when = service.resolve_when(body.preset, body.at, user, now())
    return to_out(await service.snooze(session, user, intention_id, when))


@router.delete("/intentions/{intention_id}/snooze", response_model=IntentionOut)
async def unsnooze(intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session)) -> IntentionOut:
    return to_out(await service.unsnooze(session, user, intention_id))


@router.post("/intentions/{intention_id}/dismiss", response_model=IntentionOut)
async def dismiss(
    intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session), now: Callable[[], datetime] = Depends(clock)
) -> IntentionOut:
    return to_out(await service.dismiss(session, user, intention_id, now()))


@router.post("/intentions/{intention_id}/resurface", response_model=IntentionOut)
async def bring_back(
    intention_id: UUID,
    body: BringBackRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    now: Callable[[], datetime] = Depends(clock),
) -> IntentionOut:
    """Sets the date to see this again (preset or exact time), or clears it."""
    when = None if body.clear else service.resolve_when(body.preset, body.at, user, now())
    return to_out(await service.bring_back(session, user, intention_id, when))


@router.post("/intentions/{intention_id}/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def viewed(
    intention_id: UUID, user: User = Depends(current_user), session: AsyncSession = Depends(db_session), now: Callable[[], datetime] = Depends(clock)
) -> Response:
    """The user opened the item. Clears it from resurfacing if it had come due."""
    await service.mark_viewed(session, user, intention_id, now())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
