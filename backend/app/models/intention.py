from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey, check_in
from app.models.enums import AnalysisStatus, IntentionStatus, SourceType, values

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.reminder import Reminder
    from app.models.user import User

OPEN_STATUSES = "status IN ('inbox', 'active')"


class Intention(UUIDPrimaryKey, Timestamps, Base):
    """Something a user saved for later.

    Two kinds of data live here and are kept apart:
    - **What the user captured**: `source_type`, `original_content`, `original_url`, `user_note`.
      Written once at capture; never changed by AI.
    - **Interpretation**: `title`, `summary`, `intent`, `category_id`, `tags`, `resurface_condition`.
      Filled by AI suggestions or by the user. `field_states` records who stands behind each value
      (see enums.FieldState); AI may only write a field whose state is absent or `suggested`, so a
      re-analysis never overwrites a user's edit. Raw AI output is kept in `intention_analyses`.
    """

    __tablename__ = "intentions"
    __table_args__ = (
        check_in("source_type", values(SourceType), "source_type_valid"),
        check_in("status", values(IntentionStatus), "status_valid"),
        check_in("analysis_status", values(AnalysisStatus), "analysis_status_valid"),
        CheckConstraint("length(original_content) BETWEEN 1 AND 20000", name="original_content_length"),
        CheckConstraint("source_type <> 'url' OR original_url IS NOT NULL", name="url_source_has_url"),
        CheckConstraint("original_url IS NULL OR original_url ~* '^https?://'", name="original_url_scheme"),
        CheckConstraint("jsonb_typeof(field_states) = 'object'", name="field_states_is_object"),
        CheckConstraint("cardinality(tags) <= 20", name="tags_max"),
        CheckConstraint("status <> 'completed' OR completed_at IS NOT NULL", name="completed_has_timestamp"),
        CheckConstraint("status <> 'archived' OR archived_at IS NOT NULL", name="archived_has_timestamp"),
        # Lets child tables reference (id, user_id) together, so a reminder or activity can never point
        # at another user's intention.
        UniqueConstraint("id", "user_id", name="uq_intentions_id_user_id"),
        # Inbox list and cursor pagination: newest first, ties broken by id.
        Index("ix_intentions_user_created", "user_id", text("created_at DESC"), text("id DESC")),
        Index("ix_intentions_user_status_created", "user_id", "status", text("created_at DESC")),
        # Resurfacing scans: open items with a chosen date or a snooze ending.
        Index("ix_intentions_user_resurface_at", "user_id", "resurface_at", postgresql_where=text(OPEN_STATUSES + " AND resurface_at IS NOT NULL")),
        Index("ix_intentions_user_snoozed_until", "user_id", "snoozed_until", postgresql_where=text("snoozed_until IS NOT NULL")),
        Index("ix_intentions_category_id", "category_id"),
        Index("ix_intentions_tags", "tags", postgresql_using="gin"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # --- what the user captured (immutable after capture) ---
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    original_content: Mapped[str] = mapped_column(Text, nullable=False)
    original_url: Mapped[str | None] = mapped_column(String(2048))
    user_note: Mapped[str | None] = mapped_column(String(1000))  # "why I saved it", in the user's words

    # --- interpretation (AI-suggested or user-edited; see field_states) ---
    title: Mapped[str | None] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(String(2000))
    intent: Mapped[str | None] = mapped_column(String(500))
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False, server_default=text("'{}'::varchar[]"), default=list)
    resurface_condition: Mapped[str | None] = mapped_column(String(300))  # a simple context, e.g. "this weekend"
    field_states: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict)
    analysis_status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=AnalysisStatus.PENDING.value, default=AnalysisStatus.PENDING.value)

    # --- lifecycle and resurfacing ---
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=IntentionStatus.INBOX.value, default=IntentionStatus.INBOX.value)
    resurface_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # a date the user chose
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_resurfaced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="intentions")
    category: Mapped[Category | None] = relationship()
    reminders: Mapped[list[Reminder]] = relationship(
        back_populates="intention", passive_deletes=True, overlaps="reminders", foreign_keys="Reminder.intention_id"
    )
