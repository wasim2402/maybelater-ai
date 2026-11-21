"""The development console: readable request lines and the start-up status panel."""

import logging

from app.core.config import Settings
from app.core.logging import PrettyFormatter, resolve_format, status_colour
from app.core.request_context import reset_request_id, set_request_id
from app.core.startup import Check, render


def access_record(status: int, duration: float = 12.3, path: str = "/api/v1/me") -> logging.LogRecord:
    record = logging.makeLogRecord({"name": "app.access", "msg": "request", "levelname": "INFO", "levelno": 20})
    record.method, record.path, record.status, record.duration_ms = "GET", path, status, duration
    return record


def test_access_line_shows_method_path_status_phrase_timing_and_request_id() -> None:
    token = set_request_id("abcdef1234567890")
    try:
        line = PrettyFormatter(colour=False).format(access_record(404))
    finally:
        reset_request_id(token)
    assert "GET" in line and "/api/v1/me" in line
    assert "404 Not Found" in line
    assert "12.3 ms" in line
    assert line.rstrip().endswith("abcdef12")
    assert "\033[" not in line  # no colour codes when colour is off


def test_status_colours_by_class() -> None:
    assert [status_colour(s) for s in (200, 302, 422, 503)] == ["32", "36", "33", "31"]
    coloured = PrettyFormatter(colour=True).format(access_record(500))
    assert "\033[31;1m500 Internal Server Error" in coloured


def test_long_paths_are_shortened() -> None:
    line = PrettyFormatter(colour=False).format(access_record(200, path="/api/v1/" + "x" * 80))
    assert "…" in line


def test_other_events_show_level_source_and_fields() -> None:
    record = logging.makeLogRecord({"name": "uvicorn.error", "msg": "Uvicorn running", "levelname": "INFO", "levelno": 20})
    line = PrettyFormatter(colour=False).format(record)
    assert "INFO" in line and "server" in line and "Uvicorn running" in line
    warn = logging.makeLogRecord({"name": "app.health", "msg": "database not reachable", "levelname": "WARNING", "levelno": 30, "error_type": "OSError"})
    assert "error_type=OSError" in PrettyFormatter(colour=False).format(warn)


def test_format_resolution() -> None:
    assert resolve_format("auto", development=True) == "pretty"
    assert resolve_format("auto", development=False) == "json"
    assert resolve_format("json", development=True) == "json"


def test_status_panel_lists_each_check() -> None:
    settings = Settings(app_env="development", _env_file=None)  # type: ignore[call-arg]
    checks = [
        Check("Database", "ok", "connected · PostgreSQL 18.4"),
        Check("Sign-in", "warn", "web app not reachable yet"),
        Check("AI", "off", "not configured"),
        Check("Docs", "info", "http://localhost:8000/docs"),
    ]
    panel = render(checks, settings, "0.1.0", colour=False)
    assert "MaybeLater API" in panel and "development" in panel
    assert "●  Database" in panel and "○  AI" in panel and "   Docs" in panel
    ascii_panel = render(checks, settings, "0.1.0", colour=False, unicode=False)
    assert "*  Database" in ascii_panel and "·" not in ascii_panel and "─" not in ascii_panel


def test_success_lines_have_well_formed_colour_codes() -> None:
    line = PrettyFormatter(colour=True).format(access_record(200))
    assert "\033[32m200 OK" in line
    assert ";m" not in line
