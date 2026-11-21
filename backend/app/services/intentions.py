"""Reading and changing a user's intentions. Every query is scoped to the given user; another user's
item behaves exactly like a missing one (404)."""

from __future__ import annotations

import base64
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, and_, delete, false, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError
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


MAX_SEARCH_TERMS = 8
_WORD = re.compile(r"\w+", re.UNICODE)


def search_terms(q: str | None) -> list[str]:
    """Words from a search box: letters and digits only (so nothing can reach the query syntax),
    lower-cased, at most 8 terms of 40 characters."""
    if not q:
        return []
    terms: list[str] = []
    for word in _WORD.findall(q.lower()):
        word = word.strip("_")[:40]
        if word and word not in terms:
            terms.append(word)
    return terms[:MAX_SEARCH_TERMS]


def _escape_like(term: str) -> str:
    """Makes % and _ literal in an ILIKE pattern (with ESCAPE '\\')."""
    return term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


@dataclass(frozen=True)
class IntentionFilters:
    status: StatusFilter = "open"
    q: str | None = None
    category: uuid.UUID | None = None
    uncategorized: bool = False
    tag: str | None = None
    created_after: datetime | None = None
    created_before: datetime | None = None


def _apply_filters(query: Select[tuple[Intention]], filters: IntentionFilters) -> Select[tuple[Intention]]:
    if filters.status != "all":
        query = query.where(Intention.status.in_([s.value for s in STATUS_FILTERS[filters.status]]))
    terms = search_terms(filters.q)
    if filters.q and filters.q.strip() and not terms:
        # Typed something, but nothing searchable (only symbols): an honest "no matches", not everything.
        query = query.where(false())
    elif terms:
        # Every word must match, as a word prefix ("sourd" finds "sourdough"), in the title, note,
        # intent, summary or original text; links also match on their URL text.
        tsquery = " & ".join(f"{t}:*" for t in terms)
        in_text = Intention.search_vector.op("@@")(func.to_tsquery("simple", tsquery))
        in_url = and_(*[Intention.original_url.ilike(f"%{_escape_like(t)}%", escape="\\") for t in terms])
        query = query.where(or_(in_text, in_url))
    if filters.uncategorized:
        query = query.where(Intention.category_id.is_(None))
    elif filters.category:
        query = query.where(Intention.category_id == filters.category)
    if filters.tag:
        query = query.where(Intention.tags.contains([filters.tag]))  # @>, served by the GIN index
    if filters.created_after:
        query = query.where(Intention.created_at >= filters.created_after)
    if filters.created_before:
        query = query.where(Intention.created_at < filters.created_before)
    return query


async def list_intentions(
    session: AsyncSession, user: User, *, filters: IntentionFilters, limit: int, cursor: str | None
) -> tuple[list[Intention], str | None]:
    """Newest first; keyset pagination on (created_at, id), so pages never skip or repeat items,
    with or without filters. Every query is scoped to the user and fully parameterised."""
    query = _apply_filters(_owned(user), filters)
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


async def decide_suggestion(session: AsyncSession, user: User, intention_id: uuid.UUID, field: str, action: str) -> Intention:
    """Accept or dismiss one AI suggestion. Only a field currently in the `suggested` state qualifies."""
    item = await get_intention(session, user, intention_id)
    states = dict(item.field_states or {})
    if states.get(field) != FieldState.SUGGESTED.value:
        raise ConflictError("There is no suggestion to decide on for that field.")
    if action == "accept":
        states[field] = FieldState.ACCEPTED.value
    else:
        states[field] = FieldState.DISMISSED.value
        if field == "category":
            item.category_id = None
        elif field == "tags":
            item.tags = []
        else:
            setattr(item, field, None)
    item.field_states = states
    await record_activity(session, user.id, ActivityType.EDITED, item.id, fields=field, decision=action)
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


async def request_reanalysis(session: AsyncSession, user: User, intention_id: uuid.UUID) -> Intention:
    """Marks an item for analysis again (retry after a failure, or fresh suggestions). Decided fields
    stay as they are: analysis only writes fields still open to suggestion."""
    item = await get_intention(session, user, intention_id)
    if item.analysis_status == "pending":
        raise ConflictError("Suggestions are already being prepared for this item.")
    item.analysis_status = "pending"
    await session.commit()
    session.expire(item)
    return await get_intention(session, user, intention_id)


class CategoryExistsError(ConflictError):
    code = "category_exists"
    message = "You already have a category with that name."


MAX_USER_CATEGORIES = 50


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:50]
    return slug or f"category-{uuid.uuid4().hex[:8]}"


async def create_category(session: AsyncSession, user: User, name: str) -> Category:
    """A category of the user's own. Names are unique per user (case-insensitive) and may not repeat
    a system category, so the list never shows two "Reading"s."""
    name = " ".join(name.split())
    existing = await session.execute(
        select(Category.id).where(
            or_(Category.user_id.is_(None), Category.user_id == user.id), func.lower(Category.name) == name.lower()
        )
    )
    if existing.first():
        raise CategoryExistsError()
    count = (await session.execute(select(func.count()).select_from(Category).where(Category.user_id == user.id))).scalar_one()
    if count >= MAX_USER_CATEGORIES:
        raise ConflictError(f"You can have up to {MAX_USER_CATEGORIES} categories of your own.")
    base, slug, n = slugify(name), slugify(name), 2
    while (await session.execute(select(Category.id).where(Category.user_id == user.id, Category.slug == slug))).first():
        slug = f"{base[:46]}-{n}"
        n += 1
    category = Category(user_id=user.id, name=name, slug=slug)
    session.add(category)
    await session.commit()
    return category


async def list_tags(session: AsyncSession, user: User, limit: int = 100) -> list[tuple[str, int]]:
    """The user's tags with how many items carry each, most used first."""
    tag = func.unnest(Intention.tags).label("tag")
    inner = select(tag).where(Intention.user_id == user.id).subquery()
    rows = await session.execute(
        select(inner.c.tag, func.count().label("n")).group_by(inner.c.tag).order_by(func.count().desc(), inner.c.tag).limit(limit)
    )
    return [(r.tag, r.n) for r in rows]
