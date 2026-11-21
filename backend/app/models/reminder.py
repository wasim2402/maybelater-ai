from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey, check_in
from app.models.enums import DeliveryChannel, ReminderStatus, values

if TYPE_CHECKING:
    from app.models.intention import Intention


class Reminder(UUIDPrimaryKey, Timestamps, Base):
    """A user-approved reminder for one intention.

    Lifecycle: draft -> scheduled -> sent, with snoozed and cancelled as alternatives.
    Consent is enforced by the database: a reminder cannot be scheduled, snoozed or sent without
    `approved_at` (the moment the user confirmed it). AI may propose a draft; only a person schedules.
    Deleting the intention deletes its reminders (no orphans).
    """

    __tablename__ = "reminders"
    __table_args__ = (
        check_in("status", values(ReminderStatus), "status_valid"),
        check_in("delivery_channel", values(DeliveryChannel), "delivery_channel_valid"),
        CheckConstraint("status = 'draft' OR status = 'cancelled' OR approved_at IS NOT NULL", name="approved_before_scheduling"),
        CheckConstraint("status <> 'sent' OR sent_at IS NOT NULL", name="sent_has_timestamp"),
        CheckConstraint("status <> 'cancelled' OR cancelled_at IS NOT NULL", name="cancelled_has_timestamp"),
        CheckConstraint("delivery_attempts >= 0", name="delivery_attempts_non_negative"),
        CheckConstraint("length(timezone) BETWEEN 1 AND 64", name="timezone_length"),
        ForeignKeyConstraint(
            ["intention_id", "user_id"],
            ["intentions.id", "intentions.user_id"],
            ondelete="CASCADE",
            name="fk_reminders_intention_owner",
        ),
        # The delivery worker's scan: reminders that are due.
        Index("ix_reminders_due", "scheduled_at", postgresql_where=text("status IN ('scheduled', 'snoozed')")),
        Index("ix_reminders_user_scheduled", "user_id", "scheduled_at"),
        Index("ix_reminders_intention_id", "intention_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    intention_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # UTC instant
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)  # the zone the user picked the time in
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=ReminderStatus.DRAFT.value, default=ReminderStatus.DRAFT.value)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Delivery metadata (stage 11). Codes only, never message content.
    delivery_channel: Mapped[str] = mapped_column(String(16), nullable=False, server_default=DeliveryChannel.IN_APP.value, default=DeliveryChannel.IN_APP.value)
    delivery_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(60))

    intention: Mapped[Intention] = relationship(back_populates="reminders", foreign_keys=[intention_id], overlaps="reminders")
