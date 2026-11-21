"""Web Push: reminder notifications that reach a device even when MaybeLater isn't open.

Consent and unsubscribe:
- A device is subscribed only after the user turns notifications on in Settings and the browser's
  permission prompt is accepted. Turning it off in Settings (or signing out) removes the subscription.
- "Show my reminders" off, and quiet hours, hold push exactly like in-app delivery (the push is created
  only when the reminder is delivered).

Delivery:
- When a reminder is delivered in the app, one `reminder_deliveries` row with channel `web_push` is
  written for that version (unique per reminder, version and channel): a version is pushed at most
  once, even with two workers or a rerun after a crash.
- Each push carries `Topic` (push services replace an undelivered message with the same topic) and the
  notification `tag` is the reminder id (the device replaces rather than stacks), so even a resend after
  a crash shows one notification.
- Retryable failures (429, 5xx, timeouts) back off like other deliveries; 404/410 means the
  subscription is gone and it is disabled. Only status codes are stored, never the payload.
- The payload is end-to-end encrypted to the browser (RFC 8291); the push service cannot read it.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from urllib.parse import urlsplit

from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.time import ensure_utc, utc_now
from app.models import Intention, PushSubscription, Reminder, ReminderDelivery, User
from app.models.enums import DeliveryChannel, DeliveryStatus

logger = logging.getLogger("app.push")

PUSH_TTL_SECONDS = 4 * 3600  # a reminder older than this isn't worth showing as a fresh notification
MAX_ATTEMPTS = 5
SEND_TIMEOUT_SECONDS = 10.0
BATCH = 50

# The push services browsers use. The server only ever POSTs to these (no request forgery through a
# crafted "endpoint").
ALLOWED_PUSH_HOSTS = (
    "fcm.googleapis.com",  # Chrome, Edge (Chromium), Opera, Samsung Internet
    "updates.push.services.mozilla.com",  # Firefox
    "push.services.mozilla.com",
    "web.push.apple.com",  # Safari
    "notify.windows.com",  # legacy Edge / Windows (*.notify.windows.com)
    "push.apple.com",
)


class InvalidSubscriptionError(AppError):
    status_code = 422
    code = "invalid_push_subscription"
    message = "This browser's notification subscription isn't one we can use."


class PushNotConfiguredError(AppError):
    status_code = 503
    code = "push_not_configured"
    message = "Notifications aren't set up on this server yet."


def endpoint_allowed(endpoint: str) -> bool:
    try:
        parts = urlsplit(endpoint)
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host or parts.username or parts.password or parts.port not in (None, 443):
        return False
    return any(host == allowed or host.endswith("." + allowed) for allowed in ALLOWED_PUSH_HOSTS)


def _valid_key(value: str, raw_length: int) -> bool:
    try:
        return len(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))) == raw_length
    except (ValueError, TypeError):
        return False


# --- subscriptions ------------------------------------------------------------------------------


async def subscribe(session: AsyncSession, user: User, endpoint: str, p256dh: str, auth: str, label: str | None) -> PushSubscription:
    """Saves (or refreshes) this device's subscription for the user. The same browser signing in as
    another account moves the subscription to that account."""
    if not endpoint_allowed(endpoint) or not _valid_key(p256dh, 65) or not _valid_key(auth, 16):
        raise InvalidSubscriptionError()
    statement = (
        insert(PushSubscription)
        .values(user_id=user.id, endpoint=endpoint, p256dh=p256dh, auth=auth, label=label, failure_count=0)
        .on_conflict_do_update(
            constraint="uq_push_subscriptions_endpoint",
            set_={"user_id": user.id, "p256dh": p256dh, "auth": auth, "label": label, "failure_count": 0, "disabled_at": None},
        )
        .returning(PushSubscription.id)
    )
    sub_id = (await session.execute(statement)).scalar_one()
    await session.commit()
    session.expunge_all()
    return (await session.execute(select(PushSubscription).where(PushSubscription.id == sub_id))).scalar_one()


async def unsubscribe(session: AsyncSession, user: User, endpoint: str) -> bool:
    sub = (
        await session.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id))
    ).scalar_one_or_none()
    if sub is None:
        return False
    await session.delete(sub)
    await session.commit()
    return True


async def active_subscriptions(session: AsyncSession, user_id: uuid.UUID) -> list[PushSubscription]:
    query = select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.disabled_at.is_(None))
    return list((await session.execute(query)).scalars().all())


# --- sending ------------------------------------------------------------------------------------


@dataclass
class PushResult:
    status: int  # HTTP status from the push service; 0 for a network error or timeout


class PushSender(Protocol):
    async def send(self, subscription: PushSubscription, payload: str, *, ttl: int, topic: str, urgency: str) -> PushResult: ...


class WebPushSender:
    """Sends through pywebpush with VAPID (RFC 8292) and aes128gcm encryption (RFC 8291)."""

    def __init__(self, settings: Settings) -> None:
        if not settings.push_configured:
            raise PushNotConfiguredError()
        self._private_key = settings.vapid_private_key
        self._claims = {"sub": settings.vapid_subject}

    async def send(self, subscription: PushSubscription, payload: str, *, ttl: int, topic: str, urgency: str) -> PushResult:
        from pywebpush import WebPushException, webpush_async

        info = {"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}}
        try:
            response = await asyncio.wait_for(
                webpush_async(
                    info,
                    data=payload,
                    vapid_private_key=self._private_key,
                    vapid_claims=dict(self._claims),  # pywebpush adds aud/exp to the dict it's given
                    ttl=ttl,
                    headers={"Topic": topic, "Urgency": urgency},
                    timeout=SEND_TIMEOUT_SECONDS,
                ),
                timeout=SEND_TIMEOUT_SECONDS + 2,
            )
        except WebPushException as exc:
            response = exc.response
            if response is None:
                return PushResult(0)
        except (TimeoutError, OSError):
            return PushResult(0)
        status = getattr(response, "status", None) or getattr(response, "status_code", 0)
        return PushResult(int(status or 0))


def topic_for(reminder_id: uuid.UUID) -> str:
    """Push-service collapse key: at most 32 URL-safe characters."""
    return base64.urlsafe_b64encode(hashlib.sha256(str(reminder_id).encode()).digest()).decode()[:32]


def reminder_payload(reminder: Reminder, item: Intention) -> str:
    title = item.title or item.original_content
    title = " ".join(title.split())
    if len(title) > 120:
        title = title[:119].rstrip() + "…"
    return json.dumps(
        {
            "type": "reminder",
            "title": "Reminder",
            "body": title,
            "url": f"/app/items/{item.id}",
            "tag": f"reminder-{reminder.id}",
            "reminder_id": str(reminder.id),
        },
        ensure_ascii=False,
    )


def push_idempotency_key(reminder: Reminder) -> str:
    return f"reminder:{reminder.id}:v{reminder.schedule_version}:web_push"


async def queue_push(session: AsyncSession, reminder: Reminder, now: datetime) -> bool:
    """Called in the same transaction that delivers a reminder in the app: records that this version
    should be pushed, if the user has a device subscribed. Idempotent per version."""
    if not await active_subscriptions(session, reminder.user_id):
        return False
    statement = (
        insert(ReminderDelivery)
        .values(
            reminder_id=reminder.id,
            user_id=reminder.user_id,
            schedule_version=reminder.schedule_version,
            idempotency_key=push_idempotency_key(reminder),
            channel=DeliveryChannel.WEB_PUSH.value,
            status=DeliveryStatus.PENDING.value,
            attempts=0,
            next_attempt_at=ensure_utc(now),
        )
        .on_conflict_do_nothing(constraint="uq_reminder_deliveries_version_channel")
    )
    await session.execute(statement)
    return True


@dataclass
class PushReport:
    delivered: list[str]
    retrying: list[str]
    failed: list[str]
    disabled_subscriptions: int = 0


async def send_pending_pushes(session: AsyncSession, now: datetime, sender: PushSender, limit: int = BATCH) -> PushReport:
    """Sends due web_push deliveries. Rows are locked for the pass (SKIP LOCKED), so concurrent workers
    don't send the same one; a delivered row is never sent again."""
    from app.services.reminder_delivery import backoff  # shared backoff schedule

    now = ensure_utc(now)
    report = PushReport([], [], [])
    query = (
        select(ReminderDelivery, Reminder, Intention)
        .join(Reminder, Reminder.id == ReminderDelivery.reminder_id)
        .join(Intention, and_(Intention.id == Reminder.intention_id, Intention.user_id == Reminder.user_id))
        .where(
            ReminderDelivery.channel == DeliveryChannel.WEB_PUSH.value,
            ReminderDelivery.status == DeliveryStatus.PENDING.value,
            ReminderDelivery.next_attempt_at <= now,
        )
        .order_by(ReminderDelivery.next_attempt_at)
        .limit(limit)
        .with_for_update(of=ReminderDelivery, skip_locked=True)
    )
    rows = (await session.execute(query)).all()

    for delivery, reminder, item in rows:
        key = str(reminder.id)
        # The reminder moved on since (snoozed, rescheduled, done, cancelled): this push is stale.
        if reminder.schedule_version != delivery.schedule_version or reminder.completed_at is not None or reminder.status != "sent":
            delivery.status = DeliveryStatus.FAILED.value
            delivery.last_error_code = "superseded"
            delivery.next_attempt_at = None
            report.failed.append(key)
            continue

        subs = await active_subscriptions(session, reminder.user_id)
        if not subs:
            delivery.status = DeliveryStatus.FAILED.value
            delivery.last_error_code = "no_subscriptions"
            delivery.next_attempt_at = None
            report.failed.append(key)
            continue

        payload = reminder_payload(reminder, item)
        delivery.attempts += 1
        delivery.last_attempt_at = now
        statuses = await asyncio.gather(
            *(sender.send(sub, payload, ttl=PUSH_TTL_SECONDS, topic=topic_for(reminder.id), urgency="high") for sub in subs)
        )
        succeeded, retryable = 0, 0
        for sub, result in zip(subs, statuses, strict=True):
            if 200 <= result.status < 300:
                succeeded += 1
                sub.last_success_at = now
                sub.failure_count = 0
            elif result.status in (404, 410):
                sub.disabled_at = now  # the browser unsubscribed or the subscription expired
                report.disabled_subscriptions += 1
            elif result.status in (0, 408, 429) or result.status >= 500:
                retryable += 1
                sub.failure_count += 1
            else:  # 400, 401, 403, 413: a problem with this request or our keys; retrying won't help
                sub.failure_count += 1
                logger.warning("push rejected", extra={"status": result.status, "reminder_id": key})

        codes = sorted({r.status for r in statuses if not 200 <= r.status < 300})
        if succeeded:
            delivery.status = DeliveryStatus.DELIVERED.value
            delivery.delivered_at = now
            delivery.next_attempt_at = None
            delivery.last_error_code = None
            report.delivered.append(key)
        elif retryable and delivery.attempts < MAX_ATTEMPTS:
            delivery.next_attempt_at = now + backoff(delivery.attempts)
            delivery.last_error_code = f"http_{codes[0]}" if codes else "network"
            report.retrying.append(key)
        else:
            delivery.status = DeliveryStatus.FAILED.value
            delivery.next_attempt_at = None
            delivery.last_error_code = f"http_{codes[0]}" if codes else "failed"
            report.failed.append(key)

    await session.commit()
    return report


async def send_test(session: AsyncSession, user: User, sender: PushSender) -> int:
    """A test notification to each of the user's devices. Returns how many accepted it."""
    subs = await active_subscriptions(session, user.id)
    payload = json.dumps(
        {"type": "test", "title": "MaybeLater", "body": "Notifications are on. Reminders will look like this.", "url": "/app/reminders", "tag": "test"}
    )
    results = await asyncio.gather(*(sender.send(s, payload, ttl=60, topic="test", urgency="normal") for s in subs))
    ok = 0
    for sub, result in zip(subs, results, strict=True):
        if 200 <= result.status < 300:
            ok += 1
            sub.last_success_at = utc_now()
        elif result.status in (404, 410):
            sub.disabled_at = utc_now()
    await session.commit()
    return ok
