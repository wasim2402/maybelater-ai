"""Narrow, typed tools for agents. No database handles, no SQL, no shell, no network beyond what a
tool explicitly does.

Every tool:
- takes a ToolContext whose user comes from the verified session (never from model output);
- validates its input and enforces ownership in its query;
- returns the minimum data the agent needs;
- declares whether it reads or writes;
- writes one audit log line with safe metadata only (ids, counts, codes, timings; never content).

Tools that delete, publish, notify or create reminders do not exist here, so no agent can call them.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models import Intention
from app.services.ai.prompts import PageMetadata
from app.services.ai.schemas import IntentionAnalysisOutput

audit = logging.getLogger("app.agent.tool")

Access = Literal["read", "write"]
MetadataFetcher = Callable[[str], Awaitable[PageMetadata | None]]


@dataclass(frozen=True)
class ToolContext:
    """Who the agent acts for. `user_id` comes from the authenticated request or the owning job."""

    session: AsyncSession
    user_id: uuid.UUID
    agent: str


@dataclass(frozen=True)
class CapturedItemView:
    """What an agent may see of a saved item: the capture itself, nothing else about the user."""

    intention_id: uuid.UUID
    source_type: str
    content: str
    url: str | None
    owner_note: str | None
    field_states: dict[str, str]


TOOL_ACCESS: dict[str, Access] = {
    "read_captured_item": "read",
    "read_page_metadata": "read",
    "save_suggestions": "write",
}


def _audit(ctx: ToolContext, tool: str, started: float, outcome: str, **fields: object) -> None:
    audit.info(
        "tool call",
        extra={
            "agent": ctx.agent,
            "tool": tool,
            "access": TOOL_ACCESS[tool],
            "user_id": str(ctx.user_id),
            "outcome": outcome,
            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            **fields,
        },
    )


async def _owned_intention(ctx: ToolContext, intention_id: uuid.UUID) -> Intention:
    if not isinstance(intention_id, uuid.UUID):
        raise ValueError("intention_id must be a UUID")
    item = (
        await ctx.session.execute(select(Intention).where(Intention.id == intention_id, Intention.user_id == ctx.user_id))
    ).scalar_one_or_none()
    if item is None:
        raise NotFoundError("We could not find that item.")
    return item


async def read_captured_item(ctx: ToolContext, intention_id: uuid.UUID) -> CapturedItemView:
    """READ. The capture of one item owned by the context's user."""
    started = time.perf_counter()
    try:
        item = await _owned_intention(ctx, intention_id)
    except NotFoundError:
        _audit(ctx, "read_captured_item", started, "not_found", intention_id=str(intention_id))
        raise
    _audit(ctx, "read_captured_item", started, "ok", intention_id=str(intention_id), source_type=item.source_type)
    return CapturedItemView(
        intention_id=item.id,
        source_type=item.source_type,
        content=item.original_content,
        url=item.original_url,
        owner_note=item.user_note,
        field_states=dict(item.field_states or {}),
    )


async def read_page_metadata(ctx: ToolContext, item: CapturedItemView, fetch: MetadataFetcher) -> PageMetadata | None:
    """READ. Safe page facts (title, description, site name) for the item's own saved link only.
    The agent cannot ask for an arbitrary URL: the link comes from the item it was given."""
    started = time.perf_counter()
    if not item.url:
        _audit(ctx, "read_page_metadata", started, "no_url", intention_id=str(item.intention_id))
        return None
    metadata = await fetch(item.url)
    _audit(ctx, "read_page_metadata", started, "ok" if metadata else "unavailable", intention_id=str(item.intention_id))
    return metadata


async def save_suggestions(ctx: ToolContext, intention_id: uuid.UUID, output: IntentionAnalysisOutput) -> list[str]:
    """WRITE. Stores validated suggestions on an owned item, only in fields nobody has decided on
    (state absent or `suggested`). Returns the fields written. Never deletes, never touches the
    captured original, never creates reminders. The caller commits."""
    from app.services.analysis import apply_suggestions  # one place owns the "never overwrite" rule

    started = time.perf_counter()
    if not isinstance(output, IntentionAnalysisOutput):
        raise TypeError("save_suggestions accepts only validated IntentionAnalysisOutput")
    item = await _owned_intention(ctx, intention_id)
    applied = await apply_suggestions(ctx.session, item, output)
    _audit(ctx, "save_suggestions", started, "ok", intention_id=str(intention_id), fields_written=len(applied))
    return applied
