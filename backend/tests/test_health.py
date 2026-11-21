from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "test"}


def test_ready_reports_database_state(client: TestClient) -> None:
    """200 with a reachable database, 503 without one; the body shape is the same either way."""
    response = client.get("/api/v1/health/ready")
    assert response.status_code in (200, 503)
    body = response.json()
    assert body["database"] in ("ok", "unavailable")
    assert body["status"] == ("ok" if response.status_code == 200 else "degraded")
    assert body["ai"] in ("configured", "not_configured")
