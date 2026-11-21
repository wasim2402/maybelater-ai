"""Response contracts shared by every resource: errors and cursor pagination."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    field: str
    issue: str


class ErrorInfo(BaseModel):
    code: str = Field(description="Stable snake_case code clients can branch on")
    message: str = Field(description="Safe, human-readable message")
    request_id: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorInfo


class Page(BaseModel, Generic[T]):
    """A page of a growing list. Pass `next_cursor` back as `cursor` for the next page; null means the end."""

    items: list[T]
    next_cursor: str | None = None


class PageParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    cursor: str | None = Field(default=None, max_length=512)


# Documented on every route so the OpenAPI schema shows the shared error body.
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    code: {"model": ErrorResponse} for code in (400, 401, 403, 404, 413, 422, 429, 500)
}
