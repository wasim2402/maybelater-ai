"""One error format for every failure the API returns.

Body (always):
    {"error": {"code": "not_found", "message": "...", "request_id": "...", "details": [...]?}}

Clients branch on `code` (stable, snake_case) and show `message` (safe, human-readable).
Stack traces, SQL and secrets never reach the client; they go to the server log with the request id.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id

logger = logging.getLogger("app.errors")


class AppError(Exception):
    """Base for errors raised on purpose by routes and services."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"
    message: str = "The request could not be processed."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.message = message or self.message
        self.details = details
        self.headers = headers
        super().__init__(self.message)


class UnauthenticatedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthenticated"
    message = "Sign in to continue."


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    message = "You do not have access to this."


class NotFoundError(AppError):
    """Also used for another user's resources, so their existence is never revealed."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "We could not find that."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "That conflicts with something that already exists."


class PayloadTooLargeError(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    code = "payload_too_large"
    message = "The request is too large."


class UnsafeUrlError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "unsafe_url"
    message = "Only public http and https links can be saved."


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"
    message = "Too many requests. Wait a moment and try again."

    def __init__(self, retry_after: int, message: str | None = None) -> None:
        super().__init__(message, headers={"Retry-After": str(retry_after)})


class ProviderError(AppError):
    """An upstream service (the AI provider) failed or timed out. The user's data is unaffected."""

    status_code = status.HTTP_502_BAD_GATEWAY
    code = "provider_error"
    message = "A service we depend on did not respond. Your data is safe; try again."


class ProviderNotConfiguredError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "provider_not_configured"
    message = "This feature is not available yet."


# HTTP status -> code for errors raised by the framework itself (404 route, 405 method ...)
_HTTP_CODES = {
    400: "bad_request",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
    415: "unsupported_media_type",
    429: "rate_limited",
}


def error_body(code: str, message: str, details: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message, "request_id": get_request_id()}
    if details:
        error["details"] = details
    return {"error": error}


def _response(status_code: int, body: dict[str, Any], headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=body, headers=headers)


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    if exc.status_code >= 500:
        logger.warning("app error", extra={"code": exc.code, "status": exc.status_code})
    return _response(exc.status_code, error_body(exc.code, exc.message, exc.details), exc.headers)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    # Field paths and reasons only: never echo the submitted values back (they may be private).
    details = [
        {"field": ".".join(str(p) for p in err.get("loc", ()) if p != "body"), "issue": err.get("msg", "Invalid value")}
        for err in exc.errors()
    ]
    return _response(422, error_body("validation_error", "Some fields need attention.", details))


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_CODES.get(exc.status_code, "error")
    message = exc.detail if isinstance(exc.detail, str) and exc.status_code < 500 else "The request could not be processed."
    if exc.status_code == 404:
        message = "We could not find that."
    return _response(exc.status_code, error_body(code, message), getattr(exc, "headers", None))


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    # Unhandled exceptions are answered by RequestContextMiddleware (app/core/middleware.py), which
    # still knows the request id and sits inside CORS.
