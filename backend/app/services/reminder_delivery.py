"""Delivers due reminders. Runs on the server, so nothing depends on a browser tab staying open.

Scheduler: PostgreSQL itself, not Redis + ARQ (docs/REMINDERS.md, Scheduling). A worker loop wakes
every few seconds and claims due reminders with `SELECT ... FOR UPDATE SKIP LOCKED`, so several API
processes or workers can run at once without picking the same reminder.

Exactly once per version: before a channel is called, a `reminder_deliveries` row is written for
(reminder_id, schedule_version), unique in the database. A doubled run, a retry or a rerun after a
crash finds that row: a delivered row only repairs the reminder's status and never sends again.

Channels: only `in_app` exists (the reminder becoming `sent` is what the app shows). Email and push
come later, behind consent, unsubscribe and the same delivery record (`idempotency_key` is meant to
be passed to their providers).
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Protocol

from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.time import ensure_utc, utc_now
from app.models import Reminder, ReminderDelivery, User
from app.models.enums import ActivityType, DeliveryChannel, DeliveryStatus, ReminderStatus
from app.services.activity import record_activity
from app.services.push import PushSender, queue_push, send_pending_pushes
from app.services.reminders import PENDING, in_quiet_hours
from app.services.users import effective_preferences

logger = logging.getLogger("app.reminders")

BATCH = 100
MAX_ATTEMPTS = 5
BACKOFF = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=15), timedelta(hours=1))


class DeliveryFailed(Exception):
    """A channel could not deliver. `code` is a short, safe identifier (never message content)."""

    def __init__(self, code: str, *, retryable: bool = True) -> None:
        super().__init__(code)
        self.code = code[:60]
        self.retryable = retryable


class Channel(Protocol):
    name: str

    async def deliver(self, reminder: Reminder, delivery: ReminderDelivery) -> None: ...


class InAppChannel:
    """In-app: the reminder turning `sent` is the notification; the web app shows it."""

    name = DeliveryChannel.IN_APP.value

    async def deliver(self, reminder: Reminder, delivery: ReminderDelivery) -> None:
        return None


@dataclass
class DeliveryReport:
    delivered: list[str] = field(default_factory=list)
    retrying: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    repaired: list[str] = field(default_factory=list)
    paused: int = 0
    quiet: int = 0


def idempotency_key(reminder: Reminder) -> str:
    return f"reminder:{reminder.id}:v{reminder.schedule_version}"


def backoff(attempts: int) -> timedelta:
    return BACKOFF[min(attempts, len(BACKOFF)) - 1]


async def deliver_due(
    session: AsyncSession, now: datetime, channel: Channel | None = None, limit: int = BATCH, *, push: bool = False
) -> DeliveryReport:
    """One pass: deliver every reminder due at `now` that isn't paused, quiet, or waiting for a retry.
    Commits once at the end; rows are locked for the pass so no other worker touches them. With
    `push`, each delivered reminder is also queued for Web Push (sent by `send_pending_pushes`)."""
    now = ensure_utc(now)
    channel = channel or InAppChannel()
    report = DeliveryReport()

    query = (
        select(Reminder, User, ReminderDelivery)
        .join(User, User.id == Reminder.user_id)
        .outerjoin(
            ReminderDelivery,
            and_(
                ReminderDelivery.reminder_id == Reminder.id,
                ReminderDelivery.schedule_version == Reminder.schedule_version,
                ReminderDelivery.channel == channel.name,
            ),
        )
        .where(
            Reminder.status.in_(PENDING),
            Reminder.scheduled_at <= now,
            Reminder.completed_at.is_(None),
            or_(
                ReminderDelivery.id.is_(None),
                ReminderDelivery.status == DeliveryStatus.DELIVERED.value,
                and_(ReminderDelivery.status == DeliveryStatus.PENDING.value, ReminderDelivery.next_attempt_at <= now),
            ),
        )
        .order_by(Reminder.scheduled_at)
        .limit(limit)
        .with_for_update(of=Reminder, skip_locked=True)
    )
    rows = (await session.execute(query)).all()

    for reminder, user, delivery in rows:
        if delivery is not None and delivery.status == DeliveryStatus.DELIVERED.value:
            # Delivered before, but the reminder wasn't marked (a crash between the two). Never resend.
            _mark_sent(reminder, delivery.delivered_at or now)
            report.repaired.append(str(reminder.id))
            continue

        prefs = effective_preferences(user).reminders
        if not prefs.enabled:
            report.paused += 1  # stays due; delivered once the user turns reminders back on
            continue
        if prefs.quiet_hours and in_quiet_hours(now, user.timezone, prefs.quiet_hours.start, prefs.quiet_hours.end):
            report.quiet += 1  # delivered on the first pass after quiet hours end
            continue

        if delivery is None:
            delivery = await _claim(session, reminder, channel.name)
            if delivery is None:  # another worker claimed this version first
                continue

        delivery.attempts += 1
        delivery.last_attempt_at = now
        reminder.delivery_attempts += 1
        reminder.last_attempt_at = now
        try:
            await channel.deliver(reminder, delivery)
        except DeliveryFailed as failure:
            delivery.last_error_code = reminder.last_error_code = failure.code
            if failure.retryable and delivery.attempts < MAX_ATTEMPTS:
                delivery.status = DeliveryStatus.PENDING.value
                delivery.next_attempt_at = now + backoff(delivery.attempts)
                report.retrying.append(str(reminder.id))
            else:
                delivery.status = DeliveryStatus.FAILED.value
                delivery.next_attempt_at = None
                report.failed.append(str(reminder.id))
                logger.warning("reminder delivery failed", extra={"reminder_id": str(reminder.id), "code": failure.code})
            continue

        delivery.status = DeliveryStatus.DELIVERED.value
        delivery.delivered_at = now
        delivery.next_attempt_at = None
        delivery.last_error_code = None
        _mark_sent(reminder, now)
        await record_activity(session, user.id, ActivityType.REMINDER_SENT, reminder.intention_id, reminder_id=str(reminder.id), channel=channel.name)
        if push:
            await queue_push(session, reminder, now)
        report.delivered.append(str(reminder.id))

    await session.commit()
    return report


def _mark_sent(reminder: Reminder, at: datetime) -> None:
    reminder.status = ReminderStatus.SENT.value
    reminder.sent_at = at
    reminder.last_error_code = None


async def _claim(session: AsyncSession, reminder: Reminder, channel: str) -> ReminderDelivery | None:
    """Writes this version's delivery row, or returns None if one already exists."""
    statement = (
        insert(ReminderDelivery)
        .values(
            reminder_id=reminder.id,
            user_id=reminder.user_id,
            schedule_version=reminder.schedule_version,
            idempotency_key=idempotency_key(reminder),
            channel=channel,
            status=DeliveryStatus.PENDING.value,
            attempts=0,
        )
        .on_conflict_do_nothing(constraint="uq_reminder_deliveries_version_channel")
        .returning(ReminderDelivery.id)
    )
    new_id = (await session.execute(statement)).scalar_one_or_none()
    if new_id is None:
        return None
    return await session.get(ReminderDelivery, new_id)


async def run_worker(
    session_factory: async_sessionmaker[AsyncSession],
    stop: asyncio.Event,
    interval: float,
    clock: Callable[[], datetime] = utc_now,
    channel: Channel | None = None,
    push_sender: PushSender | None = None,
) -> None:
    """Delivers due reminders every `interval` seconds until `stop` is set. Errors are logged and the
    loop carries on: one bad pass never stops reminders for good."""
    logger.info("reminder worker started", extra={"interval_seconds": interval})
    while not stop.is_set():
        try:
            async with session_factory() as session:
                report = await deliver_due(session, clock(), channel, push=push_sender is not None)
            if push_sender is not None:
                async with session_factory() as session:
                    await send_pending_pushes(session, clock(), push_sender)
            if report.delivered or report.failed or report.repaired:
                logger.info(
                    "reminders delivered",
                    extra={"delivered": len(report.delivered), "failed": len(report.failed), "repaired": len(report.repaired)},
                )
        except Exception:  # noqa: BLE001 - keep the loop alive; the next pass retries
            logger.exception("reminder worker pass failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            pass
    logger.info("reminder worker stopped")
