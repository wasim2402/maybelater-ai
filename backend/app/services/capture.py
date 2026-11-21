"""Capture: turn what the user sent into a stored intention, before anything else happens.

Each input kind has a handler that turns the raw input into `CaptureData`. Text and URL exist now;
image, screenshot and voice add a handler here (and their upload route) without changing the flow:

    detect kind -> handler.prepare(raw) -> store original -> start analysis (separately)
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Literal, Protocol
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.url_safety import normalize_url, validate_capture_url
from app.models import Intention, User
from app.models.enums import ActivityType, IntentionStatus, SourceType
from app.services.activity import record_activity

_URL_ONLY = re.compile(r"^https?://\S+$", re.IGNORECASE)
TITLE_MAX = 120


@dataclass(frozen=True)
class CaptureData:
    source_type: SourceType
    original_content: str  # exactly what the user sent (trimmed)
    original_url: str | None
    normalized_url: str | None
    provisional_title: str  # shown until the user or a suggestion gives a better one


class CaptureHandler(Protocol):
    source_type: SourceType

    def prepare(self, content: str) -> CaptureData: ...


class TextHandler:
    source_type = SourceType.TEXT

    def prepare(self, content: str) -> CaptureData:
        first_line = content.splitlines()[0].strip()
        title = first_line if len(first_line) <= TITLE_MAX else first_line[: TITLE_MAX - 1].rstrip() + "…"
        return CaptureData(SourceType.TEXT, content, None, None, title)


class UrlHandler:
    source_type = SourceType.URL

    def prepare(self, content: str) -> CaptureData:
        url = validate_capture_url(content)  # scheme, host, private addresses: raises UnsafeUrlError
        parts = urlsplit(url)
        readable = (parts.hostname or "").removeprefix("www.") + (parts.path.rstrip("/") or "")
        title = readable if len(readable) <= TITLE_MAX else readable[: TITLE_MAX - 1] + "…"
        return CaptureData(SourceType.URL, url, url, normalize_url(url), title)


HANDLERS: dict[SourceType, CaptureHandler] = {SourceType.TEXT: TextHandler(), SourceType.URL: UrlHandler()}


def detect_source(content: str) -> SourceType:
    return SourceType.URL if _URL_ONLY.match(content.strip()) else SourceType.TEXT


async def _load(session: AsyncSession, user: User, **where: object) -> Intention | None:
    query = select(Intention).options(selectinload(Intention.category)).where(Intention.user_id == user.id)
    for column, value in where.items():
        query = query.where(getattr(Intention, column) == value)
    return (await session.execute(query.order_by(Intention.created_at.desc()).limit(1))).scalar_one_or_none()


async def capture(
    session: AsyncSession,
    user: User,
    *,
    content: str,
    note: str | None,
    client_request_id: uuid.UUID | None,
    analysis_status: str,
) -> tuple[Literal["created", "duplicate", "replayed"], Intention]:
    """Stores the capture and returns it. Retries of the same attempt and links already open in the
    inbox return the existing item instead of saving a second copy."""
    if client_request_id:
        existing = await _load(session, user, client_request_id=client_request_id)
        if existing:
            return "replayed", existing

    data = HANDLERS[detect_source(content)].prepare(content)

    if data.normalized_url:
        duplicate = await _load(session, user, normalized_url=data.normalized_url)
        if duplicate and duplicate.status in (IntentionStatus.INBOX, IntentionStatus.ACTIVE):
            return "duplicate", duplicate

    intention = Intention(
        user_id=user.id,
        source_type=data.source_type.value,
        original_content=data.original_content,
        original_url=data.original_url,
        normalized_url=data.normalized_url,
        user_note=note,
        title=data.provisional_title,
        client_request_id=client_request_id,
        analysis_status=analysis_status,
    )
    session.add(intention)
    try:
        await session.flush()
    except IntegrityError:
        # Two identical attempts raced (a double-click): the other one won; return it.
        await session.rollback()
        if client_request_id:
            existing = await _load(session, user, client_request_id=client_request_id)
            if existing:
                return "replayed", existing
        raise
    await record_activity(session, user.id, ActivityType.CAPTURED, intention.id, source_type=data.source_type.value)
    await session.commit()
    loaded = await _load(session, user, id=intention.id)
    assert loaded is not None
    return "created", loaded
