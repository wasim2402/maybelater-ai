from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey, check_in
from app.models.enums import DeliveryChannel, DeliveryStatus, ReminderStatus, values

if TYPE_CHECKING:
    from app.models.intention import Intention


class Reminder(UUIDPrimaryKey, Timestamps, Base):
    """A user-approved reminder for one intention.

    Lifecycle: draft -> scheduled -> sent, with snoozed and cancelled as alternatives.
    Consent is enforced by the database: a reminder cannot be scheduled, snoozed or sent without
    `approved_at` (the moment the user confirmed it). AI may propose a draft; only a person schedules.
    Deleting the intention deletes its reminders (no orphans).

    `schedule_version` goes up every time the time changes (reschedule, snooze). Each version is
    delivered at most once: `reminder_deliveries` is unique on (reminder_id, schedule_version), so a
    retried or doubled worker run cannot send twice. `completed_at`: the user said "done" with it.
    """

    __tablename__ = "reminders"
    __table_args__ = (
        check_in("status", values(ReminderStatus), "status_valid"),
        check_in("delivery_channel", values(DeliveryChannel), "delivery_channel_valid"),
        CheckConstraint("status = 'draft' OR status = 'cancelled' OR approved_at IS NOT NULL", name="approved_before_scheduling"),
        CheckConstraint("status <> 'sent' OR sent_at IS NOT NULL", name="sent_has_timestamp"),
        CheckConstraint("status <> 'cancelled' OR cancelled_at IS NOT NULL", name="cancelled_has_timestamp"),
        CheckConstraint("delivery_attempts >= 0", name="delivery_attempts_non_negative"),
        CheckConstraint("schedule_version >= 1", name="schedule_version_positive"),
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
        # At most one reminder waiting per item (draft, scheduled or snoozed).
        Index(
            "uq_reminders_one_open_per_intention",
            "intention_id",
            unique=True,
            postgresql_where=text("status IN ('draft', 'scheduled', 'snoozed')"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    intention_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # UTC instant
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)  # the zone the user picked the time in
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=ReminderStatus.DRAFT.value, default=ReminderStatus.DRAFT.value)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    schedule_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1", default=1)

    # Delivery metadata (stage 11). Codes only, never message content.
    delivery_channel: Mapped[str] = mapped_column(String(16), nullable=False, server_default=DeliveryChannel.IN_APP.value, default=DeliveryChannel.IN_APP.value)
    delivery_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(60))

    intention: Mapped[Intention] = relationship(back_populates="reminders", foreign_keys=[intention_id], overlaps="reminders")


class ReminderDelivery(UUIDPrimaryKey, Timestamps, Base):
    """One delivery of one version of a reminder: the idempotency record and its attempts.

    The unique (reminder_id, schedule_version) is what makes delivery exactly-once per version: a
    second worker, a retry or a crash-and-rerun finds this row instead of sending again. External
    channels (later) pass `idempotency_key` to their provider. Only codes are stored, never content.
    """

    __tablename__ = "reminder_deliveries"
    __table_args__ = (
        check_in("status", values(DeliveryStatus), "status_valid"),
        check_in("channel", values(DeliveryChannel), "channel_valid"),
        CheckConstraint("attempts >= 0", name="attempts_non_negative"),
        CheckConstraint("status <> 'delivered' OR delivered_at IS NOT NULL", name="delivered_has_timestamp"),
        UniqueConstraint("reminder_id", "schedule_version", name="uq_reminder_deliveries_version"),
        UniqueConstraint("idempotency_key", name="uq_reminder_deliveries_idempotency_key"),
        Index("ix_reminder_deliveries_user_id", "user_id"),
    )

    reminder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reminders.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    schedule_version: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(60))
