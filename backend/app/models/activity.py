from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAt, UUIDPrimaryKey, check_in
from app.models.enums import ActivityType, values


class Activity(UUIDPrimaryKey, CreatedAt, Base):
    """An event in a user's history (capture, edit, resurface, snooze, complete ...), also the source
    for the product metrics in PRODUCT_REQUIREMENTS.md section 9.

    `event_metadata` holds ids, counts and codes only: never titles, URLs, notes or other saved content.
    Activities go with their intention when it is deleted, and with the user when the account is.
    """

    __tablename__ = "activities"
    __table_args__ = (
        check_in("event_type", values(ActivityType), "event_type_valid"),
        CheckConstraint("jsonb_typeof(metadata) = 'object'", name="metadata_is_object"),
        ForeignKeyConstraint(
            ["intention_id", "user_id"],
            ["intentions.id", "intentions.user_id"],
            ondelete="CASCADE",
            name="fk_activities_intention_owner",
        ),
        Index("ix_activities_user_created", "user_id", text("created_at DESC")),
        Index("ix_activities_intention_id", "intention_id", postgresql_where=text("intention_id IS NOT NULL")),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    intention_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
