"""Logging in two shapes, chosen by LOG_FORMAT (auto | pretty | json):

- **pretty** (default in development): one readable, coloured line per event, e.g.
      14:02:07  GET     /api/v1/me                       200 OK          12.4 ms  a1b2c3d4
- **json** (default everywhere else): one JSON object per line for log collectors.

Both carry the request id. Never log secrets, tokens, request bodies or saved content: ids, codes,
counts and timings only.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import UTC, datetime
from http import HTTPStatus
from typing import TextIO

from app.core.request_context import get_request_id

_RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime", "color_message"}
_ACCESS_FIELDS = {"method", "path", "status", "duration_ms"}

# uvicorn's start-up chatter that the start-up panel already covers.
_QUIET_UVICORN = ("Started server process", "Waiting for application startup", "Application startup complete")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": get_request_id(),
        }
        for key, value in vars(record).items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class Style:
    """ANSI colours, or nothing when the output is not a terminal (or NO_COLOR is set)."""

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def __call__(self, text: str, *codes: str) -> str:
        codes = tuple(c for c in codes if c)  # "" means "no extra style"
        if not self.enabled or not codes:
            return text
        return f"\033[{';'.join(codes)}m{text}\033[0m"

    # common shades
    def dim(self, text: str) -> str:
        return self(text, "2")

    def bold(self, text: str) -> str:
        return self(text, "1")


def colour_supported(stream: TextIO) -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FORCE_COLOR"):
        return True
    return hasattr(stream, "isatty") and stream.isatty()


_LEVEL_COLOURS = {"DEBUG": "2", "INFO": "36", "WARNING": "33", "ERROR": "31", "CRITICAL": "41;97"}
_METHOD_COLOURS = {"GET": "34", "POST": "32", "PATCH": "33", "PUT": "33", "DELETE": "31", "OPTIONS": "2"}


def status_colour(status: int) -> str:
    if status >= 500:
        return "31"  # red
    if status >= 400:
        return "33"  # yellow
    if status >= 300:
        return "36"  # cyan
    return "32"  # green


class PrettyFormatter(logging.Formatter):
    def __init__(self, colour: bool) -> None:
        super().__init__()
        self.s = Style(colour)

    def format(self, record: logging.LogRecord) -> str:
        s = self.s
        clock = s.dim(datetime.fromtimestamp(record.created).strftime("%H:%M:%S"))
        request_id = get_request_id()
        rid = s.dim(request_id[:8]) if request_id != "-" else ""

        if record.name == "app.access" and _ACCESS_FIELDS <= vars(record).keys():
            return self._access(record, clock, rid)

        level = s(f"{record.levelname:<7}", _LEVEL_COLOURS.get(record.levelname, "0"))
        name = "server" if record.name in ("uvicorn", "uvicorn.error") else record.name.removeprefix("app.")
        source = s.dim(name)
        extras = " ".join(
            f"{s.dim(key + '=')}{value}"
            for key, value in vars(record).items()
            if key not in _RESERVED and not key.startswith("_")
        )
        line = f"{clock}  {level} {source}  {record.getMessage()}"
        if extras:
            line += f"  {extras}"
        if rid:
            line += f"  {rid}"
        if record.exc_info:
            line += "\n" + s(self.formatException(record.exc_info), "31")
        return line

    def _access(self, record: logging.LogRecord, clock: str, rid: str) -> str:
        s = self.s
        method: str = record.method  # type: ignore[attr-defined]
        path: str = record.path  # type: ignore[attr-defined]
        status: int = record.status  # type: ignore[attr-defined]
        duration: float = record.duration_ms  # type: ignore[attr-defined]
        try:
            phrase = HTTPStatus(status).phrase
        except ValueError:
            phrase = ""
        status_text = s(f"{status} {phrase}"[:26].ljust(26), status_colour(status), "1" if status >= 400 else "")
        slow = duration >= 500
        timing = s(f"{duration:>8.1f} ms", "33" if slow else "2")
        path_text = path if len(path) <= 40 else path[:39] + "…"
        return f"{clock}  {s(f'{method:<7}', _METHOD_COLOURS.get(method, '0'), '1')} {path_text:<40} {status_text} {timing}  {rid}"


class _QuietUvicornStartup(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return not (record.name.startswith("uvicorn") and record.getMessage().startswith(_QUIET_UVICORN))


def resolve_format(log_format: str, development: bool) -> str:
    if log_format in ("pretty", "json"):
        return log_format
    return "pretty" if development else "json"


def configure_logging(level: str = "INFO", log_format: str = "json") -> None:
    handler = logging.StreamHandler(sys.stdout)
    if log_format == "pretty":
        handler.setFormatter(PrettyFormatter(colour=colour_supported(sys.stdout)))
        handler.addFilter(_QuietUvicornStartup())
    else:
        handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # Library chatter (each outgoing HTTP call, e.g. the JWKS fetch) only when something is wrong.
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)
    # uvicorn's own access log would duplicate ours (and include query strings); keep its errors only.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers[:] = []
        logging.getLogger(name).propagate = True
