"""Web Push: subscriptions (consent, ownership, safe endpoints) and reminder pushes (once per version,
retries, gone subscriptions, stale pushes), against the real test database with a fake sender."""

from __future__ import annotations

import asyncio
import base64
import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import PushSubscription, ReminderDelivery
from app.services.push import PushResult, endpoint_allowed, send_pending_pushes, topic_for
from app.services.reminder_delivery import deliver_due
from tests.api_utils import api_client, as_user
from tests.db_utils import migrate, require_test_database_url, run

ANA, BOB = as_user("auth-ana"), as_user("auth-bob")
WEDNESDAY = datetime(2026, 11, 18, 11, 0, tzinfo=UTC)
DUE = datetime(2026, 11, 18, 17, 0, tzinfo=UTC)  # 18:00 Berlin


def b64(n: int) -> str:
    return base64.urlsafe_b64encode(os.urandom(n)).rstrip(b"=").decode()


def subscription(host: str = "fcm.googleapis.com", label: str | None = "Chrome on Windows") -> dict:
    return {"endpoint": f"https://{host}/fcm/send/{b64(24)}", "keys": {"p256dh": b64(65), "auth": b64(16)}, "label": label}


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


class FakeSender:
    """Answers with queued statuses per endpoint (default 201) and records every send."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, dict, dict]] = []
        self.script: dict[str, list[int]] = {}

    async def send(self, sub, payload: str, *, ttl: int, topic: str, urgency: str) -> PushResult:
        self.sent.append((sub.endpoint, json.loads(payload), {"ttl": ttl, "topic": topic, "urgency": urgency}))
        queue = self.script.get(sub.endpoint)
        return PushResult(queue.pop(0) if queue else 201)


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    migrate(url)
    return url


@pytest.fixture
def sender() -> FakeSender:
    return FakeSender()


@pytest.fixture
def client(db_url: str, sender: FakeSender) -> Iterator[TestClient]:
    with api_client(db_url) as test_client:
        test_client.app.state.clock = Clock(WEDNESDAY)
        test_client.app.state.push_sender = sender
        for user in (ANA, BOB):
            test_client.patch("/api/v1/me", headers=user, json={"timezone": "Europe/Berlin"})
        yield test_client


def subscribe(client: TestClient, body: dict | None = None, headers=ANA):
    return client.post("/api/v1/notifications/push/subscriptions", headers=headers, json=body or subscription())


def reminder_for(client: TestClient, text: str, headers=ANA) -> tuple[str, str]:
    item = client.post("/api/v1/captures", headers=headers, json={"content": text}).json()["item"]["id"]
    reminder = client.post("/api/v1/reminders", headers=headers, json={"intention_id": item, "confirm": True, "local": "2026-11-18T18:00"})
    return item, reminder.json()["id"]


def deliver(db_url: str, now: datetime) -> None:
    async def block(engine):
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            await deliver_due(session, now, push=True)

    run(block, db_url)


def push_pass(db_url: str, now: datetime, sender: FakeSender):
    async def block(engine):
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            return await send_pending_pushes(session, now, sender)

    return run(block, db_url)


def scalar(db_url: str, query):
    async def block(engine):
        async with async_sessionmaker(engine)() as session:
            return (await session.execute(query)).scalar()

    return run(block, db_url)


# --- endpoints and subscriptions -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("endpoint", "ok"),
    [
        ("https://fcm.googleapis.com/fcm/send/abc", True),
        ("https://updates.push.services.mozilla.com/wpush/v2/abc", True),
        ("https://web.push.apple.com/QGx", True),
        ("https://db5p.notify.windows.com/w/?token=x", True),
        ("http://fcm.googleapis.com/fcm/send/abc", False),  # not https
        ("https://evil.example/fcm.googleapis.com", False),
        ("https://fcm.googleapis.com.evil.example/x", False),
        ("https://127.0.0.1/x", False),
        ("https://user:pw@fcm.googleapis.com/x", False),
        ("https://fcm.googleapis.com:8443/x", False),
        ("not a url", False),
    ],
)
def test_only_known_push_services_are_accepted(endpoint: str, ok: bool) -> None:
    assert endpoint_allowed(endpoint) is ok


def test_status_reports_availability_and_devices(client: TestClient) -> None:
    body = client.get("/api/v1/notifications/push", headers=ANA).json()
    assert body["available"] is True and body["devices"] == []
    assert subscribe(client).status_code == 201
    devices = client.get("/api/v1/notifications/push", headers=ANA).json()["devices"]
    assert [d["label"] for d in devices] == ["Chrome on Windows"]


def test_without_vapid_keys_push_is_unavailable(db_url: str) -> None:
    with api_client(db_url) as plain:
        body = plain.get("/api/v1/notifications/push", headers=ANA).json()
        assert body == {"available": False, "public_key": None, "devices": []}
        response = plain.post("/api/v1/notifications/push/test", headers=ANA)
        assert response.status_code == 503 and response.json()["error"]["code"] == "push_not_configured"


@pytest.mark.parametrize(
    "body",
    [
        subscription(host="evil.example"),
        {**subscription(), "keys": {"p256dh": b64(64), "auth": b64(16)}},  # wrong key length
        {**subscription(), "keys": {"p256dh": b64(65), "auth": b64(8)}},
        {"endpoint": "https://fcm.googleapis.com/x"},  # no keys
    ],
)
def test_bad_subscriptions_are_refused(client: TestClient, body: dict) -> None:
    assert subscribe(client, body).status_code == 422


def test_subscribing_again_refreshes_and_another_account_takes_the_device_over(client: TestClient, db_url: str) -> None:
    sub = subscription()
    subscribe(client, sub)
    subscribe(client, {**sub, "label": "Chrome (renamed)"})
    assert scalar(db_url, select(func.count()).select_from(PushSubscription)) == 1
    subscribe(client, sub, headers=BOB)  # Bob signs in on the same browser
    assert client.get("/api/v1/notifications/push", headers=ANA).json()["devices"] == []
    assert len(client.get("/api/v1/notifications/push", headers=BOB).json()["devices"]) == 1


def test_unsubscribe_is_idempotent_and_scoped_to_the_user(client: TestClient) -> None:
    sub = subscription()
    subscribe(client, sub)
    assert client.post("/api/v1/notifications/push/unsubscribe", headers=BOB, json={"endpoint": sub["endpoint"]}).status_code == 204
    assert len(client.get("/api/v1/notifications/push", headers=ANA).json()["devices"]) == 1  # Bob can't remove Ana's
    for _ in range(2):
        assert client.post("/api/v1/notifications/push/unsubscribe", headers=ANA, json={"endpoint": sub["endpoint"]}).status_code == 204
    assert client.get("/api/v1/notifications/push", headers=ANA).json()["devices"] == []


def test_a_listed_device_can_be_removed_only_by_its_owner(client: TestClient) -> None:
    device = subscribe(client).json()
    assert client.delete(f"/api/v1/notifications/push/subscriptions/{device['id']}", headers=BOB).status_code == 404
    assert client.delete(f"/api/v1/notifications/push/subscriptions/{device['id']}", headers=ANA).status_code == 204


def test_test_notification_goes_to_each_device(client: TestClient, sender: FakeSender) -> None:
    subscribe(client)
    subscribe(client, subscription(host="updates.push.services.mozilla.com", label="Firefox"))
    assert client.post("/api/v1/notifications/push/test", headers=ANA).json() == {"sent": 2}
    assert len(sender.sent) == 2 and sender.sent[0][1]["type"] == "test"


# --- reminder pushes -----------------------------------------------------------------------------


def test_a_due_reminder_is_pushed_once_with_a_safe_payload(client: TestClient, db_url: str, sender: FakeSender) -> None:
    sub = subscription()
    subscribe(client, sub)
    item, reminder = reminder_for(client, "Call the bike shop about the brakes")

    deliver(db_url, DUE)
    assert push_pass(db_url, DUE, sender).delivered == [reminder]
    assert push_pass(db_url, DUE + timedelta(minutes=5), sender).delivered == []  # never twice
    deliver(db_url, DUE + timedelta(minutes=5))  # a rerun of delivery doesn't queue another
    assert push_pass(db_url, DUE + timedelta(minutes=6), sender).delivered == []

    assert len(sender.sent) == 1
    endpoint, payload, meta = sender.sent[0]
    assert endpoint == sub["endpoint"]
    assert payload == {
        "type": "reminder",
        "title": "Reminder",
        "body": "Call the bike shop about the brakes",
        "url": f"/app/items/{item}",
        "tag": f"reminder-{reminder}",
        "reminder_id": reminder,
    }
    assert meta["topic"] == topic_for(__import__("uuid").UUID(reminder)) and len(meta["topic"]) <= 32
    assert meta["urgency"] == "high" and meta["ttl"] > 0


def test_two_push_workers_at_once_send_once(client: TestClient, db_url: str) -> None:
    subscribe(client)
    reminder_for(client, "Only once please")
    deliver(db_url, DUE)

    class SlowSender(FakeSender):
        async def send(self, *args, **kwargs):
            await asyncio.sleep(0.2)
            return await super().send(*args, **kwargs)

    slow = SlowSender()

    async def both(engine):
        maker = async_sessionmaker(engine, expire_on_commit=False)

        async def one():
            async with maker() as session:
                return await send_pending_pushes(session, DUE, slow)

        return await asyncio.gather(one(), one())

    run(both, db_url)
    assert len(slow.sent) == 1


def test_no_push_without_a_subscribed_device(client: TestClient, db_url: str, sender: FakeSender) -> None:
    reminder_for(client, "In-app only")
    deliver(db_url, DUE)
    push_pass(db_url, DUE, sender)
    assert sender.sent == []
    assert scalar(db_url, select(func.count()).select_from(ReminderDelivery).where(ReminderDelivery.channel == "web_push")) == 0


def test_cancelled_and_paused_reminders_are_not_pushed(client: TestClient, db_url: str, sender: FakeSender) -> None:
    subscribe(client)
    _, cancelled = reminder_for(client, "Cancelled one")
    client.delete(f"/api/v1/reminders/{cancelled}", headers=ANA)
    prefs = client.get("/api/v1/me", headers=ANA).json()["preferences"]
    prefs["reminders"]["enabled"] = False
    client.patch("/api/v1/me", headers=ANA, json={"preferences": prefs})
    reminder_for(client, "Paused one")
    deliver(db_url, DUE)
    push_pass(db_url, DUE, sender)
    assert sender.sent == []


def test_retryable_failures_back_off_and_send_once_successfully(client: TestClient, db_url: str, sender: FakeSender) -> None:
    sub = subscription()
    subscribe(client, sub)
    _, reminder = reminder_for(client, "Flaky push service")
    sender.script[sub["endpoint"]] = [503]
    deliver(db_url, DUE)
    assert push_pass(db_url, DUE, sender).retrying == [reminder]
    assert push_pass(db_url, DUE + timedelta(seconds=30), sender).delivered == []  # waiting for the backoff
    assert push_pass(db_url, DUE + timedelta(minutes=2), sender).delivered == [reminder]
    assert push_pass(db_url, DUE + timedelta(minutes=30), sender).delivered == []
    assert len(sender.sent) == 2


def test_a_gone_subscription_is_disabled_and_other_devices_still_get_it(client: TestClient, db_url: str, sender: FakeSender) -> None:
    gone, alive = subscription(), subscription(host="updates.push.services.mozilla.com", label="Firefox")
    subscribe(client, gone)
    subscribe(client, alive)
    _, reminder = reminder_for(client, "Two devices")
    sender.script[gone["endpoint"]] = [410]
    deliver(db_url, DUE)
    report = push_pass(db_url, DUE, sender)
    assert report.delivered == [reminder] and report.disabled_subscriptions == 1
    assert [d["label"] for d in client.get("/api/v1/notifications/push", headers=ANA).json()["devices"]] == ["Firefox"]


def test_a_push_for_a_reminder_handled_in_the_meantime_is_dropped(client: TestClient, db_url: str, sender: FakeSender) -> None:
    sub = subscription()
    subscribe(client, sub)
    _, reminder = reminder_for(client, "Handled before the retry")
    sender.script[sub["endpoint"]] = [503]
    deliver(db_url, DUE)
    push_pass(db_url, DUE, sender)  # fails, waits to retry
    client.app.state.clock.now = DUE + timedelta(seconds=10)
    client.patch(f"/api/v1/reminders/{reminder}", headers=ANA, json={"action": "complete"})
    assert push_pass(db_url, DUE + timedelta(minutes=2), sender).failed == [reminder]
    assert len(sender.sent) == 1  # only the first, failed attempt


def test_a_rejected_push_is_not_retried(client: TestClient, db_url: str, sender: FakeSender) -> None:
    sub = subscription()
    subscribe(client, sub)
    _, reminder = reminder_for(client, "Bad keys")
    sender.script[sub["endpoint"]] = [403]
    deliver(db_url, DUE)
    assert push_pass(db_url, DUE, sender).failed == [reminder]
    assert push_pass(db_url, DUE + timedelta(hours=2), sender).failed == []


def test_deleting_the_account_removes_its_devices(client: TestClient, db_url: str) -> None:
    subscribe(client)
    client.delete("/api/v1/me", headers=ANA)
    assert scalar(db_url, select(func.count()).select_from(PushSubscription)) == 0
