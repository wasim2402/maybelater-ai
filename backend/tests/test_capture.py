"""Capture and inbox, against the real test database: persistence, validation, duplicates, retries,
ownership, pagination, edits, status changes, deletion and analysis failure."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.errors import ProviderError
from app.core.url_safety import normalize_url
from app.models import Activity, Intention, IntentionAnalysis
from app.services.analysis import run_analysis
from tests.api_utils import api_client, as_user
from tests.db_utils import migrate, require_test_database_url, run

ANA, BOB = as_user("auth-ana"), as_user("auth-bob")


@pytest.fixture(scope="module")
def db_url() -> str:
    url = require_test_database_url()
    migrate(url)
    return url


@pytest.fixture
def client(db_url: str) -> Iterator[TestClient]:
    with api_client(db_url) as test_client:
        yield test_client


def save(client: TestClient, content: str, headers=ANA, **extra):
    return client.post("/api/v1/captures", headers=headers, json={"content": content, **extra})


# --- capture --------------------------------------------------------------------------------------


def test_text_capture_is_stored_as_written(client: TestClient) -> None:
    response = save(client, "  Try the ramen place Ana mentioned\nnear the station  ", note="  with Bob  ")
    assert response.status_code == 201
    body = response.json()
    assert body["result"] == "created"
    item = body["item"]
    assert item["source_type"] == "text"
    assert item["original_content"] == "Try the ramen place Ana mentioned\nnear the station"
    assert item["title"] == "Try the ramen place Ana mentioned"
    assert item["user_note"] == "with Bob"
    assert item["status"] == "inbox"
    assert item["analysis_status"] == "off"  # no AI provider configured in tests

    fetched = client.get(f"/api/v1/intentions/{item['id']}", headers=ANA)
    assert fetched.status_code == 200 and fetched.json()["original_content"] == item["original_content"]


def test_url_capture_keeps_the_original_and_a_readable_title(client: TestClient) -> None:
    item = save(client, "https://www.example.com/articles/sourdough?utm_source=news&id=7").json()["item"]
    assert item["source_type"] == "url"
    assert item["original_url"] == "https://www.example.com/articles/sourdough?utm_source=news&id=7"
    assert item["title"] == "example.com/articles/sourdough"


@pytest.mark.parametrize(
    ("content", "code"),
    [
        ("", "validation_error"),
        ("   \n\t ", "validation_error"),
        ("x" * 20_001, "validation_error"),
        ("http://localhost:8000/admin", "unsafe_url"),
        ("http://192.168.1.10/router", "unsafe_url"),
        ("https://user:pw@example.com/", "unsafe_url"),
    ],
)
def test_invalid_captures_are_rejected(client: TestClient, content: str, code: str) -> None:
    response = save(client, content)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code


def test_text_mentioning_a_link_is_a_note_not_a_url(client: TestClient) -> None:
    item = save(client, "Read https://example.com later this week").json()["item"]
    assert item["source_type"] == "text"


def test_duplicate_link_returns_the_open_item(client: TestClient) -> None:
    first = save(client, "https://example.com/recipe?id=3&utm_campaign=x").json()["item"]
    again = save(client, "HTTPS://EXAMPLE.com:443/recipe?id=3&fbclid=abc")
    assert again.status_code == 200
    assert again.json()["result"] == "duplicate"
    assert again.json()["item"]["id"] == first["id"]
    # different query value = different page = a new item
    assert save(client, "https://example.com/recipe?id=4").json()["result"] == "created"


def test_a_completed_link_can_be_saved_again(client: TestClient) -> None:
    first = save(client, "https://example.com/read-again").json()["item"]
    client.patch(f"/api/v1/intentions/{first['id']}", headers=ANA, json={"status": "completed"})
    assert save(client, "https://example.com/read-again").json()["result"] == "created"


def test_duplicates_are_per_user(client: TestClient) -> None:
    save(client, "https://example.com/shared")
    assert save(client, "https://example.com/shared", headers=BOB).json()["result"] == "created"


def test_retry_with_same_request_id_returns_the_same_item(client: TestClient) -> None:
    attempt = str(uuid.uuid4())
    first = save(client, "Book the dentist", client_request_id=attempt)
    retry = save(client, "Book the dentist", client_request_id=attempt)
    assert first.status_code == 201 and retry.status_code == 200
    assert retry.json()["result"] == "replayed"
    assert retry.json()["item"]["id"] == first.json()["item"]["id"]
    assert len(client.get("/api/v1/intentions", headers=ANA).json()["items"]) == 1


def test_capture_records_activity_without_content(client: TestClient, db_url: str) -> None:
    save(client, "A private thought about my health")

    async def events(engine):
        async with async_sessionmaker(engine)() as session:
            return (await session.execute(select(Activity.event_type, Activity.event_metadata))).all()

    rows = run(events, db_url)
    assert [r[0] for r in rows] == ["captured"]
    assert "health" not in str(rows[0][1])


def test_unauthenticated_capture_is_rejected(client: TestClient) -> None:
    assert client.post("/api/v1/captures", json={"content": "hi"}).status_code == 401


# --- inbox ----------------------------------------------------------------------------------------


def test_inbox_is_newest_first_and_paginates_without_gaps(client: TestClient) -> None:
    ids = [save(client, f"note {i}").json()["item"]["id"] for i in range(7)]
    seen: list[str] = []
    cursor = None
    while True:
        params = {"limit": 3, **({"cursor": cursor} if cursor else {})}
        page = client.get("/api/v1/intentions", headers=ANA, params=params).json()
        seen += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == list(reversed(ids))


def test_bad_cursor_is_400(client: TestClient) -> None:
    response = client.get("/api/v1/intentions", headers=ANA, params={"cursor": "not-a-cursor"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_cursor"


def test_status_filters(client: TestClient) -> None:
    a = save(client, "one").json()["item"]["id"]
    b = save(client, "two").json()["item"]["id"]
    c = save(client, "three").json()["item"]["id"]
    client.patch(f"/api/v1/intentions/{b}", headers=ANA, json={"status": "completed"})
    client.patch(f"/api/v1/intentions/{c}", headers=ANA, json={"status": "archived"})

    def ids(status: str) -> set[str]:
        return {i["id"] for i in client.get("/api/v1/intentions", headers=ANA, params={"status": status}).json()["items"]}

    assert ids("open") == {a}
    assert ids("completed") == {b}
    assert ids("archived") == {c}
    assert ids("all") == {a, b, c}


def test_users_never_see_each_others_items(client: TestClient) -> None:
    mine = save(client, "ana's secret").json()["item"]["id"]
    save(client, "bob's note", headers=BOB)
    assert [i["original_content"] for i in client.get("/api/v1/intentions", headers=BOB, params={"status": "all"}).json()["items"]] == ["bob's note"]
    for method, kwargs in (("get", {}), ("patch", {"json": {"title": "hacked"}}), ("delete", {})):
        response = getattr(client, method)(f"/api/v1/intentions/{mine}", headers=BOB, **kwargs)
        assert response.status_code == 404, method
    assert client.get(f"/api/v1/intentions/{mine}", headers=ANA).json()["title"] == "ana's secret"


# --- edits, status, deletion ----------------------------------------------------------------------


def test_edits_mark_fields_as_the_users_own(client: TestClient) -> None:
    item = save(client, "https://example.com/jacket").json()["item"]
    response = client.patch(
        f"/api/v1/intentions/{item['id']}",
        headers=ANA,
        json={"title": "Rain jacket", "user_note": "before March", "tags": ["Shopping", "shopping", " outdoor  gear "]},
    )
    body = response.json()
    assert body["title"] == "Rain jacket"
    assert body["user_note"] == "before March"
    assert body["tags"] == ["shopping", "outdoor gear"]
    assert body["field_states"] == {"title": "edited", "tags": "edited"}
    assert body["original_content"] == "https://example.com/jacket"  # the original never changes


def test_original_content_cannot_be_edited(client: TestClient) -> None:
    item = save(client, "keep me").json()["item"]
    response = client.patch(f"/api/v1/intentions/{item['id']}", headers=ANA, json={"original_content": "changed"})
    assert response.status_code == 422


def test_category_must_be_system_or_own(client: TestClient) -> None:
    item = save(client, "a place").json()["item"]
    categories = client.get("/api/v1/categories", headers=ANA).json()
    places = next(c for c in categories if c["slug"] == "places")
    ok = client.patch(f"/api/v1/intentions/{item['id']}", headers=ANA, json={"category_id": places["id"]})
    assert ok.json()["category"]["name"] == "Places"
    missing = client.patch(f"/api/v1/intentions/{item['id']}", headers=ANA, json={"category_id": str(uuid.uuid4())})
    assert missing.status_code == 404


def test_complete_archive_and_restore(client: TestClient) -> None:
    item_id = save(client, "finish the book").json()["item"]["id"]
    done = client.patch(f"/api/v1/intentions/{item_id}", headers=ANA, json={"status": "completed"}).json()
    assert done["status"] == "completed" and done["completed_at"]
    archived = client.patch(f"/api/v1/intentions/{item_id}", headers=ANA, json={"status": "archived"}).json()
    assert archived["archived_at"] and archived["completed_at"] is None
    back = client.patch(f"/api/v1/intentions/{item_id}", headers=ANA, json={"status": "inbox"}).json()
    assert back["status"] == "inbox" and back["archived_at"] is None


def test_delete_removes_the_item(client: TestClient) -> None:
    item_id = save(client, "temporary").json()["item"]["id"]
    assert client.delete(f"/api/v1/intentions/{item_id}", headers=ANA).status_code == 204
    assert client.get(f"/api/v1/intentions/{item_id}", headers=ANA).status_code == 404
    assert client.delete(f"/api/v1/intentions/{item_id}", headers=ANA).status_code == 404


# --- analysis -------------------------------------------------------------------------------------


@pytest.fixture
def ai_client(db_url: str) -> Iterator[TestClient]:
    with api_client(db_url, gemini_api_key="test-key", gemini_model="gemini-test") as test_client:
        async def unavailable(session, intention, analysis_run):
            raise ProviderError()  # never call the real provider from tests

        test_client.app.state.analyzer = unavailable
        yield test_client


def test_capture_succeeds_when_the_ai_provider_is_unavailable(ai_client: TestClient) -> None:
    response = save(ai_client, "Plan the Lisbon trip")
    assert response.status_code == 201
    assert response.json()["item"]["analysis_status"] == "pending"  # returned before analysis runs
    item_id = response.json()["item"]["id"]
    # the background analysis ran after the response; the provider is unavailable -> failed, item intact
    after = ai_client.get(f"/api/v1/intentions/{item_id}", headers=ANA).json()
    assert after["analysis_status"] == "failed"
    assert after["original_content"] == "Plan the Lisbon trip"


def _factory(db_url: str):
    return async_sessionmaker(create_async_engine(db_url, poolclass=NullPool), expire_on_commit=False)


def test_analysis_of_a_deleted_item_does_nothing(ai_client: TestClient, db_url: str) -> None:
    item_id = save(ai_client, "will be deleted").json()["item"]["id"]
    ai_client.delete(f"/api/v1/intentions/{item_id}", headers=ANA)
    user_id = ai_client.get("/api/v1/me", headers=ANA).json()["id"]
    asyncio.run(run_analysis(_factory(db_url), uuid.UUID(item_id), uuid.UUID(user_id)))  # must not raise


def test_provider_error_marks_failed_and_records_the_code(ai_client: TestClient, db_url: str) -> None:
    item = save(ai_client, "analyse me").json()["item"]
    user_id = ai_client.get("/api/v1/me", headers=ANA).json()["id"]

    async def reset(engine):
        async with async_sessionmaker(engine)() as session:
            row = await session.get(Intention, uuid.UUID(item["id"]))
            row.analysis_status = "pending"
            await session.commit()

    run(reset, db_url)

    async def failing(session, intention, analysis_run):
        raise ProviderError()

    asyncio.run(run_analysis(_factory(db_url), uuid.UUID(item["id"]), uuid.UUID(user_id), analyzer=failing))

    async def outcome(engine):
        async with async_sessionmaker(engine)() as session:
            status = (await session.get(Intention, uuid.UUID(item["id"]))).analysis_status
            codes = (await session.execute(select(IntentionAnalysis.error_code).where(IntentionAnalysis.error_code.is_not(None)))).scalars().all()
            return status, codes

    status, codes = run(outcome, db_url)
    assert status == "failed"
    assert "provider_error" in codes


def test_successful_analysis_marks_ready(ai_client: TestClient, db_url: str) -> None:
    item = save(ai_client, "analyse me well").json()["item"]
    user_id = ai_client.get("/api/v1/me", headers=ANA).json()["id"]

    async def reset(engine):
        async with async_sessionmaker(engine)() as session:
            row = await session.get(Intention, uuid.UUID(item["id"]))
            row.analysis_status = "pending"
            await session.commit()

    run(reset, db_url)

    async def ok(session, intention, analysis_run):
        analysis_run.output = {"title": "Better title"}

    asyncio.run(run_analysis(_factory(db_url), uuid.UUID(item["id"]), uuid.UUID(user_id), analyzer=ok))
    assert ai_client.get(f"/api/v1/intentions/{item['id']}", headers=ANA).json()["analysis_status"] == "ready"


# --- url normalisation unit tests -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "normal"),
    [
        ("HTTPS://Example.COM:443/a?utm_source=x&v=123&fbclid=z#t=10", "https://example.com/a?v=123#t=10"),
        ("http://example.com", "http://example.com/"),
        ("https://shop.example/p?id=7&color=red", "https://shop.example/p?id=7&color=red"),
        ("https://example.com:8443/x", "https://example.com:8443/x"),
    ],
)
def test_normalize_url(raw: str, normal: str) -> None:
    assert normalize_url(raw) == normal


def test_count_helper(db_url: str) -> None:
    """Sanity check that the wipe between tests leaves no intentions behind."""

    async def count(engine):
        async with async_sessionmaker(engine)() as session:
            return (await session.execute(select(func.count()).select_from(Intention))).scalar_one()

    with api_client(db_url):
        assert run(count, db_url) == 0
