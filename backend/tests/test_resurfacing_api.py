"""Resurfacing through the API, against the real test database, with a controllable clock."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import Activity
from tests.api_utils import api_client, as_user
from tests.db_utils import migrate, require_test_database_url, run

ANA, BOB = as_user("auth-ana"), as_user("auth-bob")
WEDNESDAY = datetime(2026, 11, 18, 11, 0, tzinfo=UTC)  # 12:00 in Berlin


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


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


def recommended(client: TestClient, headers=ANA) -> list[dict]:
    response = client.get("/api/v1/recommendations", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def ids(recs: list[dict]) -> list[str]:
    return [r["item"]["id"] for r in recs]


def bring_back(client: TestClient, item_id: str, headers=ANA, **body):
    return client.post(f"/api/v1/intentions/{item_id}/resurface", headers=headers, json=body)


def test_bring_back_preset_is_resolved_in_the_users_time_zone(client: TestClient) -> None:
    item = save(client, "Lemon cake recipe")
    body = bring_back(client, item, preset="weekend").json()
    local = datetime.fromisoformat(body["resurface_at"]).astimezone(ZoneInfo("Europe/Berlin"))
    assert (local.date().isoformat(), local.hour) == ("2026-11-21", 10)


def test_a_chosen_date_resurfaces_when_it_arrives(client: TestClient, clock: Clock) -> None:
    item = save(client, "Try the ramen place")
    bring_back(client, item, preset="tomorrow")
    assert recommended(client) == []
    clock.now = WEDNESDAY + timedelta(days=1)  # Thursday 12:00 Berlin, after 09:00
    recs = recommended(client)
    assert ids(recs) == [item]
    assert recs[0]["signal"] == "date" and recs[0]["reason"] == "You asked to see this again today."
    assert recs[0]["item"]["original_content"] == "Try the ramen place"


def test_opening_snoozing_or_dismissing_clears_it(client: TestClient, clock: Clock) -> None:
    opened, snoozed, dismissed = (save(client, t) for t in ("opened", "snoozed", "dismissed"))
    for item in (opened, snoozed, dismissed):
        bring_back(client, item, at=(WEDNESDAY + timedelta(hours=1)).isoformat())
    clock.now = WEDNESDAY + timedelta(hours=2)
    assert set(ids(recommended(client))) == {opened, snoozed, dismissed}

    assert client.post(f"/api/v1/intentions/{opened}/viewed", headers=ANA).status_code == 204
    assert client.post(f"/api/v1/intentions/{snoozed}/snooze", headers=ANA, json={"preset": "next_week"}).status_code == 200
    assert client.post(f"/api/v1/intentions/{dismissed}/dismiss", headers=ANA).status_code == 200
    assert recommended(client) == []

    clock.now = datetime(2026, 11, 23, 9, 0, tzinfo=UTC)  # Monday 10:00 Berlin: the snooze has ended
    recs = recommended(client)
    assert ids(recs) == [snoozed] and recs[0]["signal"] == "snooze"


def test_snoozed_items_do_not_appear_early(client: TestClient, clock: Clock) -> None:
    item = save(client, "later")
    bring_back(client, item, at=(WEDNESDAY - timedelta(hours=1) + timedelta(hours=2)).isoformat())
    client.post(f"/api/v1/intentions/{item}/snooze", headers=ANA, json={"at": (WEDNESDAY + timedelta(days=2)).isoformat()})
    clock.now = WEDNESDAY + timedelta(days=1)
    assert recommended(client) == []
    clock.now = WEDNESDAY + timedelta(days=2, minutes=1)
    assert ids(recommended(client)) == [item]


def test_completed_and_archived_are_excluded(client: TestClient, clock: Clock) -> None:
    done, archived = save(client, "done"), save(client, "archived")
    for item in (done, archived):
        bring_back(client, item, at=(WEDNESDAY + timedelta(minutes=5)).isoformat())
    client.patch(f"/api/v1/intentions/{done}", headers=ANA, json={"status": "completed"})
    client.patch(f"/api/v1/intentions/{archived}", headers=ANA, json={"status": "archived"})
    clock.now = WEDNESDAY + timedelta(hours=1)
    assert recommended(client) == []


def test_lists_never_include_another_users_items(client: TestClient, clock: Clock) -> None:
    bobs = save(client, "bob's", headers=BOB)
    bring_back(client, bobs, headers=BOB, at=(WEDNESDAY + timedelta(minutes=5)).isoformat())
    clock.now = WEDNESDAY + timedelta(hours=1)
    assert recommended(client) == []
    assert ids(recommended(client, headers=BOB)) == [bobs]
    for path in ("snooze", "dismiss", "viewed", "resurface"):
        body = {"preset": "tomorrow"} if path in ("snooze", "resurface") else None
        assert client.post(f"/api/v1/intentions/{bobs}/{path}", headers=ANA, json=body).status_code == 404, path


def test_confirmed_conditions_resurface_and_suggested_ones_do_not(client: TestClient, clock: Clock) -> None:
    confirmed = save(client, "Visit the flea market")
    client.patch(f"/api/v1/intentions/{confirmed}", headers=ANA, json={"resurface_condition": "this weekend"})
    clock.now = datetime(2026, 11, 21, 10, 0, tzinfo=UTC)  # Saturday 11:00 Berlin
    recs = recommended(client)
    assert ids(recs) == [confirmed]
    assert recs[0]["signal"] == "condition" and "this weekend" in recs[0]["reason"]


def test_suggestions_switch_and_stale_preference(client: TestClient, clock: Clock) -> None:
    condition = save(client, "Evening walk route")
    client.patch(f"/api/v1/intentions/{condition}", headers=ANA, json={"resurface_condition": "tonight"})
    clock.now = datetime(2026, 11, 18, 18, 30, tzinfo=UTC)  # 19:30 Berlin
    assert ids(recommended(client)) == [condition]
    client.patch("/api/v1/me", headers=ANA, json={"preferences": {"resurfacing": {"enabled": False}}})
    assert recommended(client) == []

    client.patch("/api/v1/me", headers=ANA, json={"preferences": {"resurfacing": {"enabled": True, "stale_after_days": 7}}})
    clock.now = WEDNESDAY + timedelta(days=60)
    recs = recommended(client)
    assert any(r["signal"] == "stale" for r in recs)


def test_showing_is_recorded_once_per_day(client: TestClient, clock: Clock, db_url: str) -> None:
    item = save(client, "recorded")
    bring_back(client, item, at=(WEDNESDAY + timedelta(minutes=5)).isoformat())
    clock.now = WEDNESDAY + timedelta(hours=1)
    recommended(client)
    recommended(client)
    first = client.get(f"/api/v1/intentions/{item}", headers=ANA).json()

    async def resurfaced_events(engine):
        async with async_sessionmaker(engine)() as session:
            return (await session.execute(select(func.count()).select_from(Activity).where(Activity.event_type == "resurfaced"))).scalar_one()

    assert run(resurfaced_events, db_url) == 1
    assert first["resurface_at"] is not None


def test_showing_and_opening_do_not_count_as_edits(client: TestClient, clock: Clock) -> None:
    item = save(client, "untouched")
    before = bring_back(client, item, at=(WEDNESDAY + timedelta(minutes=5)).isoformat()).json()["updated_at"]
    clock.now = WEDNESDAY + timedelta(hours=1)
    recommended(client)
    client.post(f"/api/v1/intentions/{item}/viewed", headers=ANA)
    assert client.get(f"/api/v1/intentions/{item}", headers=ANA).json()["updated_at"] == before


@pytest.mark.parametrize(
    "body",
    [
        {"at": "2020-01-01T00:00:00+00:00"},  # past
        {"at": "2030-01-01T00:00:00+00:00"},  # more than a year ahead
        {"at": "2026-12-01T09:00:00"},  # no offset
        {"preset": "tomorrow", "at": "2026-12-01T09:00:00+00:00"},  # both
        {},  # neither
        {"preset": "someday"},
    ],
)
def test_invalid_times_are_422(client: TestClient, body: dict) -> None:
    item = save(client, "x")
    response = client.post(f"/api/v1/intentions/{item}/snooze", headers=ANA, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_clearing_the_date(client: TestClient) -> None:
    item = save(client, "clear me")
    bring_back(client, item, preset="tomorrow")
    cleared = bring_back(client, item, clear=True).json()
    assert cleared["resurface_at"] is None
    assert bring_back(client, item, clear=True, preset="tomorrow").status_code == 422


def test_a_new_date_ends_a_snooze(client: TestClient) -> None:
    item = save(client, "both")
    client.post(f"/api/v1/intentions/{item}/snooze", headers=ANA, json={"preset": "next_week"})
    body = bring_back(client, item, preset="tomorrow").json()
    assert body["snoozed_until"] is None and body["resurface_at"] is not None
