"""Reading and changing a user's intentions. Every query is scoped to the given user; another user's
item behaves exactly like a missing one (404)."""

from __future__ import annotations

import base64
import uuid
from datetime import datetime

from sqlalchemy import Select, and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.core.time import utc_now
from app.models import Category, Intention, User
from app.models.enums import ActivityType, FieldState, IntentionStatus
from app.schemas.intentions import IntentionUpdate, StatusFilter
from app.services.activity import record_activity

STATUS_FILTERS: dict[str, tuple[IntentionStatus, ...]] = {
    "open": (IntentionStatus.INBOX, IntentionStatus.ACTIVE),
    "inbox": (IntentionStatus.INBOX,),
    "active": (IntentionStatus.ACTIVE,),
    "completed": (IntentionStatus.COMPLETED,),
    "archived": (IntentionStatus.ARCHIVED,),
}

INTERPRETATION_FIELDS = ("title", "summary", "intent", "tags", "resurface_condition")


class BadCursor(ValueError):
    pass


def encode_cursor(item: Intention) -> str:
    raw = f"{item.created_at.isoformat()}|{item.id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        created, _, ident = raw.partition("|")
        return datetime.fromisoformat(created), uuid.UUID(ident)
    except (ValueError, UnicodeDecodeError) as exc:
        raise BadCursor("cursor is not valid") from exc


def _owned(user: User) -> Select[tuple[Intention]]:
    return select(Intention).options(selectinload(Intention.category)).where(Intention.user_id == user.id)


async def list_intentions(
    session: AsyncSession, user: User, *, status: StatusFilter, limit: int, cursor: str | None
) -> tuple[list[Intention], str | None]:
    """Newest first; keyset pagination on (created_at, id), so pages never skip or repeat items."""
    query = _owned(user)
    if status != "all":
        query = query.where(Intention.status.in_([s.value for s in STATUS_FILTERS[status]]))
    if cursor:
        created, ident = decode_cursor(cursor)
        query = query.where(or_(Intention.created_at < created, and_(Intention.created_at == created, Intention.id < ident)))
    rows = (await session.execute(query.order_by(Intention.created_at.desc(), Intention.id.desc()).limit(limit + 1))).scalars().all()
    items = list(rows[:limit])
    return items, encode_cursor(items[-1]) if len(rows) > limit else None


async def get_intention(session: AsyncSession, user: User, intention_id: uuid.UUID) -> Intention:
    item = (await session.execute(_owned(user).where(Intention.id == intention_id))).scalar_one_or_none()
    if item is None:
        raise NotFoundError("We could not find that item.")
    return item


async def _usable_category(session: AsyncSession, user: User, category_id: uuid.UUID) -> Category:
    category = (
        await session.execute(
            select(Category).where(Category.id == category_id, or_(Category.user_id.is_(None), Category.user_id == user.id))
        )
    ).scalar_one_or_none()
    if category is None:
        raise NotFoundError("That category does not exist.")
    return category


async def update_intention(session: AsyncSession, user: User, intention_id: uuid.UUID, update: IntentionUpdate) -> Intention:
    item = await get_intention(session, user, intention_id)
    sent = update.model_fields_set
    states = dict(item.field_states or {})
    edited: list[str] = []

    for field in INTERPRETATION_FIELDS:
        if field in sent:
            value = getattr(update, field)
            setattr(item, field, (value or None) if field != "tags" else (value or []))
            states[field] = FieldState.EDITED.value
            edited.append(field)
    if "user_note" in sent:
        item.user_note = update.user_note or None
        edited.append("user_note")
    if "category_id" in sent:
        item.category_id = (await _usable_category(session, user, update.category_id)).id if update.category_id else None
        states["category"] = FieldState.EDITED.value
        edited.append("category")
    item.field_states = states

    if "status" in sent and update.status and update.status.value != item.status:
        await _set_status(session, user, item, update.status)
    elif edited:
        await record_activity(session, user.id, ActivityType.EDITED, item.id, fields=",".join(sorted(edited)))

    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def _set_status(session: AsyncSession, user: User, item: Intention, status: IntentionStatus) -> None:
    now = utc_now()
    previous = item.status
    item.status = status.value
    item.completed_at = now if status == IntentionStatus.COMPLETED else None
    item.archived_at = now if status == IntentionStatus.ARCHIVED else None
    event = {
        IntentionStatus.COMPLETED: ActivityType.COMPLETED,
        IntentionStatus.ARCHIVED: ActivityType.ARCHIVED,
    }.get(status, ActivityType.RESTORED)
    await record_activity(session, user.id, event, item.id, previous=previous)


async def delete_intention(session: AsyncSession, user: User, intention_id: uuid.UUID) -> None:
    """Hard delete. Its reminders, analyses and history go with it (database cascades)."""
    result = await session.execute(delete(Intention).where(Intention.id == intention_id, Intention.user_id == user.id))
    if result.rowcount == 0:
        raise NotFoundError("We could not find that item.")
    await session.commit()


async def list_categories(session: AsyncSession, user: User) -> list[Category]:
    query = select(Category).where(or_(Category.user_id.is_(None), Category.user_id == user.id)).order_by(Category.user_id.is_not(None), Category.name)
    return list((await session.execute(query)).scalars().all())
