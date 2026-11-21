"""Reminders through the API and the delivery worker, against the real test database."""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import Activity, Reminder, ReminderDelivery
from app.services.reminder_delivery import DeliveryFailed, DeliveryReport, deliver_due
from tests.api_utils import api_client, as_user
from tests.db_utils import migrate, require_test_database_url, run

ANA, BOB = as_user("auth-ana"), as_user("auth-bob")
WEDNESDAY = datetime(2026, 11, 18, 11, 0, tzinfo=UTC)  # 12:00 in Berlin


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


class CountingChannel:
    """Records every send; can fail the first N attempts; can pause to force overlapping workers."""

    name = "in_app"

    def __init__(self, fail_first: int = 0, retryable: bool = True, pause: float = 0.0) -> None:
        self.calls: list[str] = []
        self.fail_first = fail_first
        self.retryable = retryable
        self.pause = pause

    async def deliver(self, reminder, delivery) -> None:
        self.calls.append(delivery.idempotency_key)
        if self.pause:
            await asyncio.sleep(self.pause)
        if len(self.calls) <= self.fail_first:
            raise DeliveryFailed("provider_unavailable", retryable=self.retryable)


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    migrate(url)
    return url


@pytest.fixture
def clock() -> Clock:
    return Clock(WEDNESDAY)


@pytest.fixture
def client(db_url: str, clock: Clock) -> Iterator[TestClient]:
    with api_client(db_url) as test_client:
        test_client.app.state.clock = clock
        for user in (ANA, BOB):
            test_client.patch("/api/v1/me", headers=user, json={"timezone": "Europe/Berlin"})
        yield test_client


def save(client: TestClient, content: str, headers=ANA) -> str:
    return client.post("/api/v1/captures", headers=headers, json={"content": content}).json()["item"]["id"]


def remind(client: TestClient, item: str, headers=ANA, confirm: bool = True, **when):
    when = when or {"local": "2026-11-18T18:00"}
    return client.post("/api/v1/reminders", headers=headers, json={"intention_id": item, "confirm": confirm, **when})


def act(client: TestClient, reminder: str, headers=ANA, **body):
    return client.patch(f"/api/v1/reminders/{reminder}", headers=headers, json=body)


def listed(client: TestClient, state: str = "all", headers=ANA) -> dict:
    response = client.get("/api/v1/reminders", headers=headers, params={"state": state})
    assert response.status_code == 200, response.text
    return response.json()


def deliver(db_url: str, now: datetime, channel=None) -> DeliveryReport:
    async def block(engine):
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            return await deliver_due(session, now, channel)

    return run(block, db_url)


def count(db_url: str, model, **where) -> int:
    async def block(engine):
        async with async_sessionmaker(engine)() as session:
            query = select(func.count()).select_from(model)
            for key, value in where.items():
                query = query.where(getattr(model, key) == value)
            return (await session.execute(query)).scalar_one()

    return run(block, db_url)


def sql(db_url: str, statement: str, **params) -> None:
    async def block(engine):
        async with engine.begin() as conn:
            await conn.execute(text(statement), params)

    run(block, db_url)


# --- creating: explicit consent and time zones -------------------------------------------------


def test_a_confirmed_reminder_is_scheduled_in_the_users_zone(client: TestClient) -> None:
    item = save(client, "Call the bike shop")
    response = remind(client, item, local="2026-11-21T10:00")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "scheduled" and body["approved_at"]
    assert body["timezone"] == "Europe/Berlin" and body["local_time"] == "2026-11-21T10:00"
    assert datetime.fromisoformat(body["scheduled_at"]) == datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    assert body["item"]["id"] == item


def test_another_zone_can_be_chosen_and_is_kept(client: TestClient) -> None:
    item = save(client, "Watch the launch stream")
    body = remind(client, item, local="2026-11-21T10:00", timezone="America/New_York").json()
    assert body["timezone"] == "America/New_York" and body["local_time"] == "2026-11-21T10:00"
    assert datetime.fromisoformat(body["scheduled_at"]) == datetime(2026, 11, 21, 15, 0, tzinfo=UTC)


def test_confirmation_must_be_stated(client: TestClient) -> None:
    item = save(client, "Renew passport")
    response = client.post("/api/v1/reminders", headers=ANA, json={"intention_id": item, "local": "2026-11-21T10:00"})
    assert response.status_code == 422


def test_an_unconfirmed_reminder_is_a_draft_and_never_delivered(client: TestClient, db_url: str, clock: Clock) -> None:
    item = save(client, "Book the dentist")
    draft = remind(client, item, confirm=False).json()
    assert draft["status"] == "draft" and draft["approved_at"] is None
    report = deliver(db_url, WEDNESDAY + timedelta(days=2))
    assert report.delivered == [] and listed(client, "upcoming")["items"][0]["status"] == "draft"

    confirmed = act(client, draft["id"], action="confirm")
    assert confirmed.json()["status"] == "scheduled"


def test_a_draft_whose_time_passed_cannot_be_confirmed(client: TestClient, clock: Clock) -> None:
    item = save(client, "Return the library book")
    draft = remind(client, item, confirm=False).json()
    clock.now = WEDNESDAY + timedelta(days=1)
    response = act(client, draft["id"], action="confirm")
    assert response.status_code == 422 and response.json()["error"]["code"] == "invalid_reminder_time"


@pytest.mark.parametrize(
    ("when", "code"),
    [
        ({"local": "2026-11-18T11:00"}, "invalid_reminder_time"),  # earlier today
        ({"at": "2027-12-01T09:00:00+00:00"}, "invalid_reminder_time"),  # over a year
        ({"local": "2027-03-28T02:30"}, "time_does_not_exist"),  # skipped by the clock change
        ({"at": "2026-11-21T10:00:00"}, "validation_error"),  # no offset
        ({"local": "2026-11-21T10:00", "preset": "tomorrow"}, "validation_error"),  # two times
        ({"preset": "someday"}, "validation_error"),
        ({"local": "2026-11-21T10:00", "timezone": "Mars/Olympus"}, "validation_error"),
    ],
)
def test_invalid_times_are_refused(client: TestClient, when: dict, code: str) -> None:
    item = save(client, "Water the plants")
    response = remind(client, item, **when)
    assert response.status_code == 422 and response.json()["error"]["code"] == code


def test_one_open_reminder_per_item(client: TestClient) -> None:
    item = save(client, "Send the thank-you note")
    first = remind(client, item).json()
    second = remind(client, item, local="2026-11-19T09:00")
    assert second.status_code == 409 and second.json()["error"]["code"] == "reminder_exists"
    client.delete(f"/api/v1/reminders/{first['id']}", headers=ANA)
    assert remind(client, item, local="2026-11-19T09:00").status_code == 201


def test_preset_is_resolved_on_the_server(client: TestClient) -> None:
    item = save(client, "Pick up the parcel")
    body = remind(client, item, preset="weekend").json()
    assert body["local_time"] == "2026-11-21T10:00"


# --- ownership -----------------------------------------------------------------------------------


def test_reminders_are_private(client: TestClient) -> None:
    anas = save(client, "Ana's thing")
    reminder = remind(client, anas).json()
    assert remind(client, anas, headers=BOB).status_code == 404  # Bob can't remind himself of Ana's item
    assert listed(client, headers=BOB)["items"] == []
    assert act(client, reminder["id"], headers=BOB, action="complete").status_code == 404
    assert client.delete(f"/api/v1/reminders/{reminder['id']}", headers=BOB).status_code == 404
    assert listed(client)["items"][0]["status"] == "scheduled"


# --- lifecycle -----------------------------------------------------------------------------------


def test_a_reminder_is_delivered_once_when_due(client: TestClient, db_url: str, clock: Clock) -> None:
    item = save(client, "Order the birthday cake")
    reminder = remind(client, item, local="2026-11-18T18:00").json()  # 17:00 UTC

    assert deliver(db_url, datetime(2026, 11, 18, 16, 59, tzinfo=UTC)).delivered == []  # never early
    report = deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC))
    assert report.delivered == [reminder["id"]]
    assert deliver(db_url, datetime(2026, 11, 18, 17, 1, tzinfo=UTC)).delivered == []  # and only once

    due = listed(client, "due")["items"]
    assert [r["id"] for r in due] == [reminder["id"]] and due[0]["status"] == "sent" and due[0]["sent_at"]
    assert count(db_url, ReminderDelivery, reminder_id=reminder["id"]) == 1
    assert count(db_url, Activity, event_type="reminder_sent") == 1


def test_complete_removes_it_from_due(client: TestClient, db_url: str) -> None:
    item = save(client, "Pay the electricity bill")
    reminder = remind(client, item).json()
    deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC))
    done = act(client, reminder["id"], action="complete").json()
    assert done["status"] == "sent" and done["completed_at"]
    assert listed(client, "due")["items"] == [] and listed(client, "history")["items"][0]["id"] == reminder["id"]


def test_completing_a_waiting_reminder_calls_it_off(client: TestClient, db_url: str) -> None:
    item = save(client, "Reply to Sam")
    reminder = remind(client, item).json()
    done = act(client, reminder["id"], action="complete").json()
    assert done["status"] == "cancelled" and done["completed_at"]
    assert deliver(db_url, WEDNESDAY + timedelta(days=1)).delivered == []


def test_cancelled_reminders_are_not_delivered(client: TestClient, db_url: str) -> None:
    item = save(client, "Cancel the gym trial")
    reminder = remind(client, item).json()
    cancelled = client.delete(f"/api/v1/reminders/{reminder['id']}", headers=ANA)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert client.delete(f"/api/v1/reminders/{reminder['id']}", headers=ANA).status_code == 200  # idempotent
    assert deliver(db_url, WEDNESDAY + timedelta(days=1)).delivered == []
    assert count(db_url, ReminderDelivery) == 0
    # A cancelled reminder is final.
    assert act(client, reminder["id"], action="snooze", preset="tomorrow").json()["error"]["code"] == "reminder_closed"
    assert act(client, reminder["id"], action="reschedule", local="2026-11-20T09:00").status_code == 409


def test_a_delivered_reminder_cannot_be_cancelled_only_completed(client: TestClient, db_url: str) -> None:
    item = save(client, "Check the oven light")
    reminder = remind(client, item).json()
    deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC))
    response = client.delete(f"/api/v1/reminders/{reminder['id']}", headers=ANA)
    assert response.status_code == 409 and response.json()["error"]["code"] == "invalid_reminder_transition"


def test_snooze_brings_it_back_later_as_a_new_delivery(client: TestClient, db_url: str, clock: Clock) -> None:
    item = save(client, "Try the new ramen place")
    reminder = remind(client, item).json()
    deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC))

    clock.now = datetime(2026, 11, 18, 17, 5, tzinfo=UTC)
    snoozed = act(client, reminder["id"], action="snooze", preset="in_an_hour").json()
    assert snoozed["status"] == "snoozed" and listed(client, "due")["items"] == []
    assert deliver(db_url, datetime(2026, 11, 18, 17, 30, tzinfo=UTC)).delivered == []
    assert deliver(db_url, datetime(2026, 11, 18, 18, 5, tzinfo=UTC)).delivered == [reminder["id"]]
    assert count(db_url, ReminderDelivery, reminder_id=reminder["id"]) == 2  # one per version


def test_rescheduling_moves_the_time_and_keeps_approval(client: TestClient, db_url: str) -> None:
    item = save(client, "Buy flowers")
    reminder = remind(client, item).json()
    moved = act(client, reminder["id"], action="reschedule", local="2026-11-19T08:30").json()
    assert moved["status"] == "scheduled" and moved["local_time"] == "2026-11-19T08:30" and moved["approved_at"]
    assert deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC)).delivered == []  # not at the old time
    assert deliver(db_url, datetime(2026, 11, 19, 7, 30, tzinfo=UTC)).delivered == [reminder["id"]]


@pytest.mark.parametrize("body", [{"action": "complete", "preset": "tomorrow"}, {"action": "snooze"}, {"action": "explode"}])
def test_malformed_actions_are_refused(client: TestClient, body: dict) -> None:
    item = save(client, "Tidy the desk")
    reminder = remind(client, item).json()
    assert act(client, reminder["id"], **body).status_code == 422


def test_deleting_the_item_deletes_its_reminders(client: TestClient, db_url: str) -> None:
    item = save(client, "Temporary thought")
    remind(client, item)
    client.delete(f"/api/v1/intentions/{item}", headers=ANA)
    assert listed(client)["items"] == [] and count(db_url, Reminder) == 0


# --- delivery guarantees -----------------------------------------------------------------------


def test_two_workers_at_once_deliver_each_reminder_once(client: TestClient, db_url: str) -> None:
    items = [save(client, f"Thing {n}") for n in range(3)]
    for item in items:
        remind(client, item)
    channel = CountingChannel(pause=0.2)
    due = datetime(2026, 11, 18, 17, 0, tzinfo=UTC)

    async def both(engine):
        maker = async_sessionmaker(engine, expire_on_commit=False)

        async def one():
            async with maker() as session:
                return await deliver_due(session, due, channel)

        return await asyncio.gather(one(), one())

    first, second = run(both, db_url)
    assert sorted(first.delivered + second.delivered) == sorted(r["id"] for r in listed(client, "due")["items"])
    assert len(channel.calls) == 3 and len(set(channel.calls)) == 3
    assert count(db_url, ReminderDelivery) == 3 and count(db_url, Activity, event_type="reminder_sent") == 3


def test_retries_back_off_and_never_send_twice(client: TestClient, db_url: str) -> None:
    item = save(client, "Confirm the hotel")
    reminder = remind(client, item).json()
    channel = CountingChannel(fail_first=1)
    due = datetime(2026, 11, 18, 17, 0, tzinfo=UTC)

    assert deliver(db_url, due, channel).retrying == [reminder["id"]]
    assert listed(client, "upcoming")["items"][0]["status"] == "scheduled"
    assert deliver(db_url, due + timedelta(seconds=30), channel).delivered == []  # waits for the backoff
    assert deliver(db_url, due + timedelta(minutes=2), channel).delivered == [reminder["id"]]
    assert deliver(db_url, due + timedelta(minutes=10), channel).delivered == []

    assert len(channel.calls) == 2 and len(set(channel.calls)) == 1  # same idempotency key both times
    assert count(db_url, ReminderDelivery) == 1 and count(db_url, Activity, event_type="reminder_sent") == 1


def test_a_permanent_failure_stops_retrying(client: TestClient, db_url: str) -> None:
    item = save(client, "Unsendable")
    reminder = remind(client, item).json()
    channel = CountingChannel(fail_first=99, retryable=False)
    due = datetime(2026, 11, 18, 17, 0, tzinfo=UTC)
    assert deliver(db_url, due, channel).failed == [reminder["id"]]
    assert deliver(db_url, due + timedelta(hours=2), channel).failed == []
    assert len(channel.calls) == 1


def test_a_delivery_recorded_before_a_crash_is_not_sent_again(client: TestClient, db_url: str) -> None:
    item = save(client, "Crash test")
    reminder = remind(client, item).json()
    # The channel delivered and the delivery row was written, but the reminder was never marked sent.
    sql(
        db_url,
        "INSERT INTO reminder_deliveries (reminder_id, user_id, schedule_version, idempotency_key, channel, status, attempts, delivered_at) "
        "SELECT id, user_id, schedule_version, 'reminder:' || id || '-v1', 'in_app', 'delivered', 1, now() FROM reminders WHERE id = :id",
        id=reminder["id"],
    )
    channel = CountingChannel()
    report = deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC), channel)
    assert report.repaired == [reminder["id"]] and channel.calls == []
    assert listed(client, "due")["items"][0]["status"] == "sent"


# --- preferences ---------------------------------------------------------------------------------


def _prefs(client: TestClient, **reminders) -> None:
    current = client.get("/api/v1/me", headers=ANA).json()["preferences"]
    current["reminders"] = {**current["reminders"], **reminders}
    assert client.patch("/api/v1/me", headers=ANA, json={"preferences": current}).status_code == 200


def test_turning_reminders_off_pauses_delivery_until_turned_on(client: TestClient, db_url: str) -> None:
    item = save(client, "Paused one")
    reminder = remind(client, item).json()
    _prefs(client, enabled=False)
    assert listed(client)["delivery_paused"] is True
    report = deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC))
    assert report.delivered == [] and report.paused == 1
    _prefs(client, enabled=True)
    assert deliver(db_url, datetime(2026, 11, 18, 17, 1, tzinfo=UTC)).delivered == [reminder["id"]]


def test_quiet_hours_hold_delivery_until_they_end(client: TestClient, db_url: str) -> None:
    item = save(client, "Late-night idea")
    reminder = remind(client, item, local="2026-11-18T23:00").json()  # 22:00 UTC
    _prefs(client, quiet_hours={"start": "22:00", "end": "07:00"})
    report = deliver(db_url, datetime(2026, 11, 18, 22, 0, tzinfo=UTC))
    assert report.delivered == [] and report.quiet == 1
    assert deliver(db_url, datetime(2026, 11, 19, 5, 59, tzinfo=UTC)).delivered == []  # 06:59 Berlin
    assert deliver(db_url, datetime(2026, 11, 19, 6, 0, tzinfo=UTC)).delivered == [reminder["id"]]  # 07:00


def test_one_users_preferences_do_not_affect_another(client: TestClient, db_url: str) -> None:
    ana_item, bob_item = save(client, "Ana's"), save(client, "Bob's", headers=BOB)
    remind(client, ana_item)
    bobs = remind(client, bob_item, headers=BOB).json()
    _prefs(client, enabled=False)
    assert deliver(db_url, datetime(2026, 11, 18, 17, 0, tzinfo=UTC)).delivered == [bobs["id"]]
