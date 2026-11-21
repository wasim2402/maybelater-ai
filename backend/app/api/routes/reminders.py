"""Reminders: create (only on the user's confirmation), list, change, snooze, complete, cancel."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.intentions import to_out
from app.api.routes.resurfacing import clock
from app.core.deps import current_user, db_session
from app.models import Reminder, User
from app.schemas.intentions import IntentionOut
from app.schemas.user import validate_timezone
from app.services import reminders as service
from app.services.reminders import ReminderPreset, ReminderState
from app.services.users import effective_preferences

router = APIRouter(prefix="/reminders", tags=["reminders"])

Timezone = Annotated[str, AfterValidator(validate_timezone)]


class When(BaseModel):
    """Exactly one of: a preset (resolved in `timezone`), an instant with an offset (`at`), or a
    wall-clock time in `timezone` without an offset (`local`, e.g. "2026-11-21T10:00")."""

    model_config = ConfigDict(extra="forbid")

    preset: ReminderPreset | None = None
    at: datetime | None = None
    local: datetime | None = None
    timezone: Timezone | None = Field(default=None, description="IANA zone; defaults to the user's")

    @model_validator(mode="after")
    def _exactly_one(self) -> "When":
        if sum(v is not None for v in (self.preset, self.at, self.local)) != 1:
            raise ValueError("Send exactly one of: preset, at, local.")
        if self.at is not None and self.at.utcoffset() is None:
            raise ValueError("`at` needs a time zone offset; use `local` for a wall-clock time.")
        if self.local is not None and self.local.utcoffset() is not None:
            raise ValueError("`local` is a wall-clock time without an offset.")
        return self


class ReminderCreate(When):
    intention_id: UUID
    # Required on purpose: the client states whether the user confirmed this exact time.
    confirm: bool


class ReminderAction(BaseModel):
    """PATCH body. `confirm` a draft, `reschedule` or `snooze` (with a time), or `complete`."""

    model_config = ConfigDict(extra="forbid")

    action: Literal["confirm", "reschedule", "snooze", "complete"]
    preset: ReminderPreset | None = None
    at: datetime | None = None
    local: datetime | None = None
    timezone: Timezone | None = None

    @model_validator(mode="after")
    def _time_only_when_needed(self) -> "ReminderAction":
        given = sum(v is not None for v in (self.preset, self.at, self.local))
        if self.action in ("reschedule", "snooze"):
            When.model_validate({k: getattr(self, k) for k in ("preset", "at", "local", "timezone")})
        elif given or self.timezone:
            raise ValueError(f"`{self.action}` takes no time.")
        return self


class ReminderOut(BaseModel):
    id: UUID
    intention_id: UUID
    status: str
    scheduled_at: datetime
    timezone: str
    local_time: str = Field(description="The time on the clock it was set in, e.g. 2026-11-21T10:00")
    approved_at: datetime | None
    sent_at: datetime | None
    cancelled_at: datetime | None
    completed_at: datetime | None
    delivery_channel: str
    created_at: datetime
    updated_at: datetime
    item: IntentionOut


class ReminderList(BaseModel):
    items: list[ReminderOut]
    # The user turned reminders off: they stay scheduled but aren't delivered until turned back on.
    delivery_paused: bool


def reminder_out(reminder: Reminder) -> ReminderOut:
    return ReminderOut(
        id=reminder.id,
        intention_id=reminder.intention_id,
        status=reminder.status,
        scheduled_at=reminder.scheduled_at,
        timezone=reminder.timezone,
        local_time=service.local_wall_time(reminder),
        approved_at=reminder.approved_at,
        sent_at=reminder.sent_at,
        cancelled_at=reminder.cancelled_at,
        completed_at=reminder.completed_at,
        delivery_channel=reminder.delivery_channel,
        created_at=reminder.created_at,
        updated_at=reminder.updated_at,
        item=to_out(reminder.intention),
    )


def _resolve(body: When | ReminderAction, user: User, now: datetime) -> tuple[datetime, str]:
    timezone = body.timezone or user.timezone
    return service.resolve_time(preset=body.preset, at=body.at, local=body.local, timezone=timezone, now=now), timezone


@router.get("", response_model=ReminderList)
async def list_reminders(
    state: ReminderState = Query("all"),
    intention_id: UUID | None = Query(None),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> ReminderList:
    """`due`: shown and not done yet. `upcoming`: waiting. `history`: done or cancelled."""
    items = await service.list_reminders(session, user, state, intention_id)
    return ReminderList(items=[reminder_out(r) for r in items], delivery_paused=not effective_preferences(user).reminders.enabled)


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    body: ReminderCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    now: Callable[[], datetime] = Depends(clock),
) -> ReminderOut:
    """`confirm: true` schedules it (the user saw the exact time and pressed "Set reminder").
    `confirm: false` keeps a draft, which is never delivered."""
    moment = now()
    when, timezone = _resolve(body, user, moment)
    return reminder_out(await service.create_reminder(session, user, body.intention_id, when, timezone, confirm=body.confirm, now=moment))


@router.patch("/{reminder_id}", response_model=ReminderOut)
async def update_reminder(
    reminder_id: UUID,
    body: ReminderAction,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    now: Callable[[], datetime] = Depends(clock),
) -> ReminderOut:
    moment = now()
    if body.action == "confirm":
        reminder = await service.confirm_reminder(session, user, reminder_id, moment)
    elif body.action == "complete":
        reminder = await service.complete_reminder(session, user, reminder_id, moment)
    else:
        when, timezone = _resolve(body, user, moment)
        if body.action == "reschedule":
            reminder = await service.reschedule_reminder(session, user, reminder_id, when, timezone)
        else:
            reminder = await service.snooze_reminder(session, user, reminder_id, when)
    return reminder_out(reminder)


@router.delete("/{reminder_id}", response_model=ReminderOut)
async def cancel_reminder(
    reminder_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
    now: Callable[[], datetime] = Depends(clock),
) -> ReminderOut:
    """Cancels a reminder that hasn't been shown yet (kept as history, never delivered)."""
    return reminder_out(await service.cancel_reminder(session, user, reminder_id, now()))
