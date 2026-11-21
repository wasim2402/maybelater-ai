"""Database side of resurfacing: load a user's candidates, run the pure engine, record what was shown,
and the user's actions on resurfaced items (snooze, not now, bring back on a date, viewed)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.core.errors import AppError
from app.core.time import ensure_utc
from app.models import Intention, User
from app.models.enums import ActivityType
from app.services.activity import record_activity
from app.services.intentions import get_intention
from app.services.resurfacing import Candidate, ItemSnapshot, Preset, evaluate, resolve_preset
from app.services.users import effective_preferences

SCAN_LIMIT = 500
MAX_AHEAD = timedelta(days=366)


class InvalidWhenError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Choose a time in the future, within a year."


@dataclass
class Recommendation:
    item: Intention
    candidate: Candidate


def _snapshot(item: Intention) -> ItemSnapshot:
    return ItemSnapshot(
        id=item.id,
        status=item.status,
        created_at=item.created_at,
        resurface_at=item.resurface_at,
        snoozed_until=item.snoozed_until,
        dismissed_at=item.dismissed_at,
        last_viewed_at=item.last_viewed_at,
        last_resurfaced_at=item.last_resurfaced_at,
        resurface_condition=item.resurface_condition,
        condition_state=(item.field_states or {}).get("resurface_condition"),
    )


async def recommendations(session: AsyncSession, user: User, now: datetime) -> list[Recommendation]:
    """The user's resurfaced items right now, ranked, each with its reason. Records that they were
    shown (last_resurfaced_at, one `resurfaced` activity per item per local day)."""
    now = ensure_utc(now)
    prefs = effective_preferences(user)
    signals = [Intention.resurface_at <= now, Intention.snoozed_until <= now, Intention.resurface_condition.is_not(None)]
    query = (
        select(Intention)
        .options(selectinload(Intention.category))
        .where(Intention.user_id == user.id, Intention.status.in_(("inbox", "active")))
        .order_by(Intention.created_at.desc())
        .limit(SCAN_LIMIT)
    )
    if not prefs.resurfacing.stale_after_days:  # stale needs every open item; otherwise only items with a signal
        query = query.where(or_(*signals))
    items = {i.id: i for i in (await session.execute(query)).scalars().all()}

    candidates = evaluate([_snapshot(i) for i in items.values()], prefs, user.timezone, now)
    result = [Recommendation(items[c.id], c) for c in candidates]

    from zoneinfo import ZoneInfo

    tz = ZoneInfo(user.timezone)
    today = now.astimezone(tz).date()
    shown = [r for r in result if r.item.last_resurfaced_at is None or r.item.last_resurfaced_at.astimezone(tz).date() != today]
    if shown:
        await _touch(session, [r.item.id for r in shown], last_resurfaced_at=now)
        for rec in shown:
            set_committed_value(rec.item, "last_resurfaced_at", now)
            await record_activity(session, user.id, ActivityType.RESURFACED, rec.item.id, signal=rec.candidate.signal)
        await session.commit()
    return result


async def _touch(session: AsyncSession, ids: list[uuid.UUID], **values: datetime) -> None:
    """Bookkeeping fields (shown, viewed) are not edits: write them without moving updated_at."""
    await session.execute(update(Intention).where(Intention.id.in_(ids)).values(**values, updated_at=Intention.updated_at))


def resolve_when(preset: Preset | None, at: datetime | None, user: User, now: datetime) -> datetime:
    when = resolve_preset(preset, user.timezone, now) if preset else ensure_utc(at) if at else None
    if when is None or when <= now or when - now > MAX_AHEAD:
        raise InvalidWhenError()
    return when


async def snooze(session: AsyncSession, user: User, intention_id: uuid.UUID, when: datetime) -> Intention:
    item = await get_intention(session, user, intention_id)
    item.snoozed_until = when
    await record_activity(session, user.id, ActivityType.SNOOZED, item.id)
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def unsnooze(session: AsyncSession, user: User, intention_id: uuid.UUID) -> Intention:
    item = await get_intention(session, user, intention_id)
    item.snoozed_until = None
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def dismiss(session: AsyncSession, user: User, intention_id: uuid.UUID, now: datetime) -> Intention:
    """"Not now": takes it off the resurfaced list. Conditions and staleness stay quiet for 30 days;
    a date chosen later brings it back."""
    item = await get_intention(session, user, intention_id)
    item.dismissed_at = ensure_utc(now)
    await record_activity(session, user.id, ActivityType.DISMISSED, item.id)
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def bring_back(session: AsyncSession, user: User, intention_id: uuid.UUID, when: datetime | None) -> Intention:
    """Sets (or clears) the date the user wants to see this again. A new date also ends a snooze,
    so the item comes back when the user asked."""
    item = await get_intention(session, user, intention_id)
    item.resurface_at = when
    if when is not None:
        item.snoozed_until = None
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def mark_viewed(session: AsyncSession, user: User, intention_id: uuid.UUID, now: datetime) -> None:
    item = await get_intention(session, user, intention_id)  # ownership check (404 otherwise)
    await _touch(session, [item.id], last_viewed_at=ensure_utc(now))
    await session.commit()
