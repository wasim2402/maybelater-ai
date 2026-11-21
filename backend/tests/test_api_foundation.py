"""The shared API behaviour every later endpoint inherits: error body, request ids, size cap, CORS, rate limits."""

from fastapi.testclient import TestClient

from tests.conftest import WEB_ORIGIN


def assert_error(response, status: int, code: str) -> dict:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert error["code"] == code
    assert isinstance(error["message"], str) and error["message"]
    assert error["request_id"] == response.headers["x-request-id"]
    return error


def test_unknown_route_uses_error_format(client: TestClient) -> None:
    assert_error(client.get("/api/v1/does-not-exist"), 404, "not_found")


def test_app_error_uses_error_format(client: TestClient) -> None:
    assert_error(client.get("/api/v1/_probe/missing"), 404, "not_found")


def test_method_not_allowed(client: TestClient) -> None:
    assert_error(client.delete("/api/v1/health"), 405, "method_not_allowed")


def test_validation_error_lists_fields_without_echoing_values(client: TestClient) -> None:
    private = "x" * 60
    response = client.post("/api/v1/_probe/echo", json={"text": private})
    error = assert_error(response, 422, "validation_error")
    assert error["details"][0]["field"] == "text"
    assert private not in response.text


def test_crash_hides_internals_and_keeps_request_id(client: TestClient) -> None:
    response = client.get("/api/v1/_probe/crash")
    error = assert_error(response, 500, "internal_error")
    assert "hunter2" not in response.text and "RuntimeError" not in response.text
    assert error["request_id"] != "-"


def test_crash_response_still_has_cors_headers(client: TestClient) -> None:
    response = client.get("/api/v1/_probe/crash", headers={"Origin": WEB_ORIGIN})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == WEB_ORIGIN


def test_request_id_is_generated_and_echoed(client: TestClient) -> None:
    generated = client.get("/api/v1/health").headers["x-request-id"]
    assert len(generated) == 32
    given = client.get("/api/v1/health", headers={"X-Request-ID": "trace-abc-123"})
    assert given.headers["x-request-id"] == "trace-abc-123"


def test_malformed_request_id_is_replaced(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "bad id\nwith newline"})
    assert response.headers["x-request-id"] != "bad id\nwith newline"


def test_body_over_limit_is_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/_probe/echo", content=b"{" + b" " * 4096 + b"}", headers={"content-type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_cors_allows_known_origin_only(client: TestClient) -> None:
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
    allowed = client.options("/api/v1/health", headers={"Origin": WEB_ORIGIN, **preflight})
    assert allowed.headers.get("access-control-allow-origin") == WEB_ORIGIN
    assert allowed.headers.get("access-control-allow-credentials") == "true"
    denied = client.options("/api/v1/health", headers={"Origin": "https://evil.example", **preflight})
    assert "access-control-allow-origin" not in denied.headers


def test_rate_limit_returns_429_with_retry_after(client: TestClient) -> None:
    assert client.get("/api/v1/_probe/limited").status_code == 200
    assert client.get("/api/v1/_probe/limited").status_code == 200
    response = client.get("/api/v1/_probe/limited")
    assert_error(response, 429, "rate_limited")
    assert int(response.headers["retry-after"]) >= 1


def test_docs_hidden_outside_development(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
