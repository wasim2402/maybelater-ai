"""History events. Metadata is ids, counts and codes only, never saved content (docs/DATA_MODEL.md)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity
from app.models.enums import ActivityType

_ALLOWED_VALUE = (str, int, float, bool, type(None))


async def record_activity(
    session: AsyncSession,
    user_id: uuid.UUID,
    event: ActivityType,
    intention_id: uuid.UUID | None = None,
    **metadata: object,
) -> None:
    """Adds an activity row to the current transaction (the caller commits)."""
    safe = {k: v for k, v in metadata.items() if isinstance(v, _ALLOWED_VALUE) and (not isinstance(v, str) or len(v) <= 64)}
    session.add(Activity(user_id=user_id, intention_id=intention_id, event_type=event.value, event_metadata=safe))
