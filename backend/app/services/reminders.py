"""Reminders: user-approved, one per item at a time, stored as a UTC instant plus the zone the user
picked the time in.

Lifecycle (docs/REMINDERS.md):

    draft --confirm--> scheduled --(worker)--> sent --complete--> (done)
      |                  |   ^                   |
      |                  |   +----reschedule-----+
      |                  +--snooze--> snoozed --(worker)--> sent
      +------cancel------+-----cancel----+--> cancelled (final)

Consent: nothing is scheduled without an explicit confirmation from the user (`confirm: true` on
create, or the `confirm` action on a draft); the database refuses a scheduled reminder without
`approved_at`. No agent tool can create reminders.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.time import ensure_utc, zone
from app.models import Intention, Reminder, User
from app.models.enums import ActivityType, ReminderStatus
from app.services.activity import record_activity
from app.services.intentions import get_intention
from app.services.resurfacing import resolve_preset

ReminderPreset = Literal["in_an_hour", "this_evening", "tomorrow", "weekend", "next_week"]
ReminderState = Literal["due", "upcoming", "history", "all"]

OPEN = (ReminderStatus.DRAFT.value, ReminderStatus.SCHEDULED.value, ReminderStatus.SNOOZED.value)
PENDING = (ReminderStatus.SCHEDULED.value, ReminderStatus.SNOOZED.value)
MAX_AHEAD = timedelta(days=366)


class ReminderTimeError(AppError):
    status_code = 422
    code = "invalid_reminder_time"
    message = "Choose a time in the future, within a year."


class NonexistentLocalTimeError(AppError):
    status_code = 422
    code = "time_does_not_exist"
    message = "That time doesn't exist on that day because the clocks change. Pick another time."


class ReminderExistsError(ConflictError):
    code = "reminder_exists"
    message = "This item already has a reminder. Change that one instead."


class ReminderClosedError(ConflictError):
    code = "reminder_closed"
    message = "This reminder was cancelled. Set a new one instead."


class ReminderStateError(ConflictError):
    code = "invalid_reminder_transition"
    message = "That can't be done to this reminder right now."


# --- time -------------------------------------------------------------------------------------


def resolve_local(local: datetime, timezone: str) -> datetime:
    """A wall-clock time in `timezone` (no offset) as a UTC instant.

    - A time skipped by a daylight-saving change (02:30 on a spring-forward night) does not exist:
      rejected rather than silently moved.
    - A repeated time (01:30 on a fall-back night) takes the first occurrence (fold=0).
    """
    if local.tzinfo is not None:
        raise ValueError("local time must not carry an offset")
    tz = zone(timezone)
    aware = local.replace(tzinfo=tz, fold=0)
    round_trip = aware.astimezone(UTC).astimezone(tz).replace(tzinfo=None)
    if round_trip != local:
        raise NonexistentLocalTimeError()
    return aware.astimezone(UTC)


def resolve_reminder_preset(preset: ReminderPreset, timezone: str, now: datetime) -> datetime:
    """Presets are wall-clock times in the user's zone, resolved on the server."""
    now = ensure_utc(now)
    if preset == "in_an_hour":
        return (now + timedelta(hours=1)).replace(second=0, microsecond=0)
    if preset == "this_evening":
        tz = ZoneInfo(timezone)
        local = now.astimezone(tz)
        evening = datetime.combine(local.date(), time(19, 0), tzinfo=tz)
        if evening <= local:
            raise ReminderTimeError("It's already evening. Choose another time.")
        return evening.astimezone(UTC)
    return resolve_preset(preset, timezone, now)


def resolve_time(
    *, preset: ReminderPreset | None, at: datetime | None, local: datetime | None, timezone: str, now: datetime
) -> datetime:
    """One of: a preset, an exact instant with an offset, or a wall-clock time in `timezone`.
    Must be in the future and within a year."""
    if preset is not None:
        when = resolve_reminder_preset(preset, timezone, now)
    elif at is not None:
        when = ensure_utc(at)
    elif local is not None:
        when = resolve_local(local, timezone)
    else:  # the request schemas make this unreachable
        raise ReminderTimeError()
    if not (ensure_utc(now) < when <= ensure_utc(now) + MAX_AHEAD):
        raise ReminderTimeError()
    return when


def in_quiet_hours(moment: datetime, timezone: str, start: str, end: str) -> bool:
    """Whether `moment` falls inside the user's quiet hours (local "HH:MM" to "HH:MM", which may wrap
    past midnight, e.g. 22:00-07:00). Equal start and end means no quiet hours."""
    local = ensure_utc(moment).astimezone(ZoneInfo(timezone)).time().replace(second=0, microsecond=0)
    s, e = time.fromisoformat(start), time.fromisoformat(end)
    if s == e:
        return False
    if s < e:
        return s <= local < e
    return local >= s or local < e


def local_wall_time(reminder: Reminder) -> str:
    """"2026-11-21T10:00": the reminder's time on the clock it was set in."""
    return reminder.scheduled_at.astimezone(ZoneInfo(reminder.timezone)).strftime("%Y-%m-%dT%H:%M")


# --- queries ----------------------------------------------------------------------------------


def _owned(user: User):
    return (
        select(Reminder)
        .options(selectinload(Reminder.intention).selectinload(Intention.category))
        .where(Reminder.user_id == user.id)
    )


async def get_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID) -> Reminder:
    reminder = (await session.execute(_owned(user).where(Reminder.id == reminder_id))).scalar_one_or_none()
    if reminder is None:
        raise NotFoundError("We could not find that reminder.")
    return reminder


async def list_reminders(
    session: AsyncSession, user: User, state: ReminderState = "all", intention_id: uuid.UUID | None = None, limit: int = 100
) -> list[Reminder]:
    """due: delivered and not marked done. upcoming: waiting (draft, scheduled, snoozed).
    history: done or cancelled."""
    query = _owned(user)
    if intention_id is not None:
        query = query.where(Reminder.intention_id == intention_id)
    if state == "due":
        query = query.where(Reminder.status == ReminderStatus.SENT.value, Reminder.completed_at.is_(None)).order_by(Reminder.sent_at.desc())
    elif state == "upcoming":
        query = query.where(Reminder.status.in_(OPEN)).order_by(Reminder.scheduled_at.asc())
    elif state == "history":
        query = query.where(
            (Reminder.status == ReminderStatus.CANCELLED.value) | Reminder.completed_at.is_not(None)
        ).order_by(Reminder.updated_at.desc())
    else:
        query = query.order_by(Reminder.scheduled_at.desc())
    return list((await session.execute(query.limit(limit))).scalars().all())


# --- actions ----------------------------------------------------------------------------------


async def _commit(session: AsyncSession, user: User, reminder_id: uuid.UUID) -> Reminder:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "uq_reminders_one_open_per_intention" in str(exc.orig):
            raise ReminderExistsError() from exc
        raise
    session.expunge_all()  # reload with fresh relationships
    return await get_reminder(session, user, reminder_id)


async def create_reminder(
    session: AsyncSession, user: User, intention_id: uuid.UUID, when: datetime, timezone: str, *, confirm: bool, now: datetime
) -> Reminder:
    """`confirm=True` is the user pressing "Set reminder" after seeing the exact time: scheduled.
    `confirm=False` keeps a draft that is never delivered until confirmed."""
    await get_intention(session, user, intention_id)  # ownership (404 for someone else's item)
    open_one = (
        await session.execute(select(Reminder.id).where(Reminder.intention_id == intention_id, Reminder.status.in_(OPEN)))
    ).scalar_one_or_none()
    if open_one is not None:
        raise ReminderExistsError()
    reminder = Reminder(
        user_id=user.id,
        intention_id=intention_id,
        scheduled_at=when,
        timezone=timezone,
        status=ReminderStatus.SCHEDULED.value if confirm else ReminderStatus.DRAFT.value,
        approved_at=ensure_utc(now) if confirm else None,
    )
    session.add(reminder)
    await session.flush()
    if confirm:
        await record_activity(session, user.id, ActivityType.REMINDER_CREATED, intention_id, reminder_id=str(reminder.id))
    return await _commit(session, user, reminder.id)


def _reopen(reminder: Reminder, when: datetime, status: ReminderStatus) -> None:
    """A new time: a new version (delivered once, independently of earlier versions)."""
    reminder.scheduled_at = when
    reminder.status = status.value
    reminder.schedule_version += 1
    reminder.completed_at = None
    reminder.last_error_code = None


async def confirm_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID, now: datetime) -> Reminder:
    reminder = await get_reminder(session, user, reminder_id)
    if reminder.status != ReminderStatus.DRAFT.value:
        raise ReminderStateError("Only a draft reminder needs confirming.")
    if reminder.scheduled_at <= ensure_utc(now):
        raise ReminderTimeError("This time has passed. Choose a new one before confirming.")
    reminder.status = ReminderStatus.SCHEDULED.value
    reminder.approved_at = ensure_utc(now)
    await record_activity(session, user.id, ActivityType.REMINDER_CREATED, reminder.intention_id, reminder_id=str(reminder.id))
    return await _commit(session, user, reminder.id)


async def reschedule_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID, when: datetime, timezone: str) -> Reminder:
    """Change the time. A draft stays a draft; anything already approved is scheduled again."""
    reminder = await get_reminder(session, user, reminder_id)
    if reminder.status == ReminderStatus.CANCELLED.value:
        raise ReminderClosedError()
    reminder.timezone = timezone
    if reminder.status == ReminderStatus.DRAFT.value:
        reminder.scheduled_at = when
    else:
        _reopen(reminder, when, ReminderStatus.SCHEDULED)
    return await _commit(session, user, reminder.id)


async def snooze_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID, when: datetime) -> Reminder:
    """Later: from a due reminder, or to push back one that is still waiting."""
    reminder = await get_reminder(session, user, reminder_id)
    if reminder.status == ReminderStatus.CANCELLED.value:
        raise ReminderClosedError()
    if reminder.status == ReminderStatus.DRAFT.value:
        raise ReminderStateError("Confirm this reminder before snoozing it.")
    _reopen(reminder, when, ReminderStatus.SNOOZED)
    await record_activity(session, user.id, ActivityType.SNOOZED, reminder.intention_id, reminder_id=str(reminder.id))
    return await _commit(session, user, reminder.id)


async def complete_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID, now: datetime) -> Reminder:
    """Done with it. A delivered reminder leaves the due list; one still waiting is called off too."""
    reminder = await get_reminder(session, user, reminder_id)
    if reminder.status == ReminderStatus.CANCELLED.value:
        raise ReminderClosedError()
    if reminder.status == ReminderStatus.DRAFT.value:
        raise ReminderStateError("This reminder was never set. Cancel it instead.")
    if reminder.completed_at is None:
        reminder.completed_at = ensure_utc(now)
    if reminder.status in PENDING:
        reminder.status = ReminderStatus.CANCELLED.value
        reminder.cancelled_at = ensure_utc(now)
    return await _commit(session, user, reminder.id)


async def cancel_reminder(session: AsyncSession, user: User, reminder_id: uuid.UUID, now: datetime) -> Reminder:
    """Called off before it is delivered. Idempotent; a delivered reminder is completed instead."""
    reminder = await get_reminder(session, user, reminder_id)
    if reminder.status == ReminderStatus.CANCELLED.value:
        return reminder
    if reminder.status == ReminderStatus.SENT.value:
        raise ReminderStateError("This reminder has already been shown. Mark it done instead.")
    reminder.status = ReminderStatus.CANCELLED.value
    reminder.cancelled_at = ensure_utc(now)
    return await _commit(session, user, reminder.id)
