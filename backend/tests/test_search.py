"""Organisation and search, against the real test database: full-text search, filters that combine,
pagination without gaps under filters, isolation between users, unsafe input, custom categories
and tag counts."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.services.intentions import search_terms
from tests.api_utils import api_client, as_user
from tests.db_utils import migrate, require_test_database_url

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


def save(client: TestClient, content: str, headers=ANA, **edits) -> str:
    item_id = client.post("/api/v1/captures", headers=headers, json={"content": content}).json()["item"]["id"]
    if edits:
        client.patch(f"/api/v1/intentions/{item_id}", headers=headers, json=edits)
    return item_id


def find(client: TestClient, headers=ANA, **params) -> list[str]:
    response = client.get("/api/v1/intentions", headers=headers, params={"status": "all", **params})
    assert response.status_code == 200, response.text
    return [i["id"] for i in response.json()["items"]]


def category_id(client: TestClient, slug: str) -> str:
    return next(c["id"] for c in client.get("/api/v1/categories", headers=ANA).json() if c["slug"] == slug)


# --- text search ----------------------------------------------------------------------------------


def test_search_matches_title_note_summary_and_original(client: TestClient) -> None:
    by_title = save(client, "some link text", title="Sourdough starter guide")
    by_note = save(client, "a different thing", user_note="for the weekend bake")
    by_summary = save(client, "another one", summary="A ramen place near the station")
    by_original = save(client, "Lisbon trip ideas for spring")
    save(client, "unrelated note")

    assert find(client, q="sourdough") == [by_title]
    assert find(client, q="bake") == [by_note]
    assert find(client, q="ramen") == [by_summary]
    assert find(client, q="lisbon") == [by_original]


def test_search_matches_word_prefixes_and_requires_every_word(client: TestClient) -> None:
    both = save(client, "Lemon drizzle cake for Mum's birthday")
    save(client, "Lemon tart recipe")
    assert set(find(client, q="lem")) == {both, find(client, q="tart")[0]}
    assert find(client, q="lemon cake") == [both]
    assert find(client, q="LEMON   Birth") == [both]  # case and spacing do not matter


def test_search_finds_links_by_url_text(client: TestClient) -> None:
    link = save(client, "https://www.bbc.co.uk/food/recipes/easy_sourdough")
    assert link in find(client, q="bbc")
    assert link in find(client, q="recipes")


def test_search_never_leaks_across_users(client: TestClient) -> None:
    save(client, "secret project apollo")
    bobs = save(client, "apollo moon documentary", headers=BOB)
    assert find(client, headers=BOB, q="apollo") == [bobs]
    assert find(client, headers=BOB, q="secret") == []


@pytest.mark.parametrize(
    "query",
    ["'; DROP TABLE intentions; --", "%", "_", "a & b | !c", ":*", "\\", "(((", "<script>", "ü" * 300, "🙂"],
)
def test_unsafe_or_odd_queries_are_handled(client: TestClient, query: str) -> None:
    save(client, "plain note")
    response = client.get("/api/v1/intentions", headers=ANA, params={"q": query[:200]})
    assert response.status_code == 200
    assert client.get("/api/v1/intentions", headers=ANA).status_code == 200  # table still there


def test_percent_and_underscore_are_literal_in_url_matching(client: TestClient) -> None:
    save(client, "https://example.com/a")
    assert find(client, q="%") == []
    assert find(client, q="_") == []


def test_empty_query_means_no_text_filter(client: TestClient) -> None:
    ids = {save(client, "one"), save(client, "two")}
    assert set(find(client, q="")) == ids
    assert set(find(client, q="   ")) == ids


def test_search_terms_are_sanitised() -> None:
    assert search_terms("Sourdough   STARTER, starter!") == ["sourdough", "starter"]
    assert search_terms("a:* & b | !c") == ["a", "b", "c"]
    assert search_terms(" ".join(f"w{i}" for i in range(20))) == [f"w{i}" for i in range(8)]
    assert search_terms(None) == []


# --- filters --------------------------------------------------------------------------------------


def test_filters_combine(client: TestClient) -> None:
    cooking, places = category_id(client, "food-cooking"), category_id(client, "places")
    recipe = save(client, "Lemon cake recipe", category_id=cooking, tags=["baking"])
    save(client, "Lemon grove to visit", category_id=places, tags=["travel"])
    done = save(client, "Lemon curd recipe", category_id=cooking, tags=["baking"], status="completed")
    loose = save(client, "Lemon without a category")

    assert set(find(client, q="lemon", category=cooking)) == {recipe, done}
    assert find(client, q="lemon", category=cooking, status="open") == [recipe]
    assert set(find(client, tag="baking")) == {recipe, done}
    assert find(client, tag="baking", status="completed") == [done]
    assert find(client, category="none") == [loose]
    assert find(client, q="lemon", tag="travel", category=cooking) == []


def test_date_filters(client: TestClient) -> None:
    item = save(client, "dated note")
    created = client.get(f"/api/v1/intentions/{item}", headers=ANA).json()["created_at"]
    assert item in find(client, created_after="2000-01-01T00:00:00+00:00")
    assert find(client, created_before="2000-01-01T00:00:00+00:00") == []
    assert item in find(client, created_after=created)  # inclusive start
    assert find(client, created_before=created) == []  # exclusive end


@pytest.mark.parametrize(
    "params",
    [
        {"created_after": "2026-01-01T00:00:00"},  # no offset
        {"created_after": "yesterday"},
        {"category": "not-a-uuid"},
        {"created_after": "2026-02-01T00:00:00+00:00", "created_before": "2026-01-01T00:00:00+00:00"},
        {"status": "deleted"},
        {"q": "x" * 201},
    ],
)
def test_malformed_filters_are_422(client: TestClient, params: dict) -> None:
    response = client.get("/api/v1/intentions", headers=ANA, params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_pagination_under_a_filter_never_skips_or_repeats(client: TestClient) -> None:
    wanted = [save(client, f"recipe number {i}") for i in range(7)]
    save(client, "not matching")
    seen, cursor = [], None
    while True:
        params = {"q": "recipe", "limit": 3, **({"cursor": cursor} if cursor else {})}
        page = client.get("/api/v1/intentions", headers=ANA, params=params).json()
        seen += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == list(reversed(wanted))


def test_search_reflects_edits_immediately(client: TestClient) -> None:
    item = save(client, "https://example.com/x")
    assert find(client, q="jacket") == []
    client.patch(f"/api/v1/intentions/{item}", headers=ANA, json={"title": "Rain jacket comparison"})
    assert find(client, q="jacket") == [item]


# --- categories and tags --------------------------------------------------------------------------


def test_custom_categories(client: TestClient) -> None:
    created = client.post("/api/v1/categories", headers=ANA, json={"name": "  Garden   projects "})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Garden projects" and body["slug"] == "garden-projects" and body["is_system"] is False
    assert any(c["id"] == body["id"] for c in client.get("/api/v1/categories", headers=ANA).json())
    assert all(c["id"] != body["id"] for c in client.get("/api/v1/categories", headers=BOB).json())  # private

    item = save(client, "plant tomatoes", category_id=body["id"])
    assert find(client, category=body["id"]) == [item]
    # Bob cannot use Ana's category
    bobs = save(client, "bob's", headers=BOB)
    assert client.patch(f"/api/v1/intentions/{bobs}", headers=BOB, json={"category_id": body["id"]}).status_code == 404


@pytest.mark.parametrize("name", ["garden projects", "GARDEN PROJECTS", "Reading"])
def test_duplicate_category_names_are_refused(client: TestClient, name: str) -> None:
    client.post("/api/v1/categories", headers=ANA, json={"name": "Garden projects"})
    response = client.post("/api/v1/categories", headers=ANA, json={"name": name})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "category_exists"


def test_category_name_validation(client: TestClient) -> None:
    assert client.post("/api/v1/categories", headers=ANA, json={"name": "   "}).status_code == 422
    unicode = client.post("/api/v1/categories", headers=ANA, json={"name": "Café visits"}).json()
    assert unicode["slug"] == "cafe-visits"


def test_tag_counts_are_per_user(client: TestClient) -> None:
    save(client, "a", tags=["baking", "weekend"])
    save(client, "b", tags=["baking"])
    save(client, "c", headers=BOB, tags=["secret-bob-tag"])
    tags = client.get("/api/v1/tags", headers=ANA).json()
    assert tags == [{"tag": "baking", "count": 2}, {"tag": "weekend", "count": 1}]
    assert [t["tag"] for t in client.get("/api/v1/tags", headers=BOB).json()] == ["secret-bob-tag"]


def test_unknown_category_filter_returns_nothing_not_an_error(client: TestClient) -> None:
    save(client, "anything")
    assert find(client, category=str(uuid.uuid4())) == []
