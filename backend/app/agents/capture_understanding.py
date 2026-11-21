"""Capture Understanding Agent: the only active agent (stage 08).

A deterministic workflow around one structured LLM call, not an autonomous loop:

    1. read_captured_item      (owned item only)
    2. read_page_metadata      (the item's own link only; SSRF-safe)
    3. provider.structured     (versioned prompt, captured content fenced as untrusted data)
    4. validate                (IntentionAnalysisOutput; malformed output is rejected)
    5. save_suggestions        (only undecided fields; the user reviews them in the app)

It can only use the three tools above. It cannot delete or publish anything, read another user's
items, create reminders or claim success before the backend has stored the result.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy import or_, select

from app.agents.tools import MetadataFetcher, ToolContext, read_captured_item, read_page_metadata, save_suggestions
from app.core.errors import AppError
from app.models import Category
from app.services.ai.prompts import PROMPT_VERSION, build_system_prompt, build_user_input
from app.services.ai.provider import AIProvider
from app.services.ai.schemas import ANALYSIS_SCHEMA_VERSION, IntentionAnalysisOutput
from app.services.page_metadata import fetch_page_metadata

logger = logging.getLogger("app.agent")

AGENT_NAME = "capture_understanding"
ALLOWED_TOOLS = ("read_captured_item", "read_page_metadata", "save_suggestions")


@dataclass
class AgentResult:
    output: IntentionAnalysisOutput
    applied_fields: list[str]
    provider: str
    model: str
    prompt_version: str = PROMPT_VERSION
    schema_version: str = ANALYSIS_SCHEMA_VERSION
    metadata_available: bool = False
    timings_ms: dict[str, float] = field(default_factory=dict)


class CaptureUnderstandingAgent:
    name = AGENT_NAME
    tools = ALLOWED_TOOLS

    def __init__(self, provider: AIProvider, fetch_metadata: MetadataFetcher = fetch_page_metadata) -> None:
        self.provider = provider
        self.fetch_metadata = fetch_metadata

    async def _category_slugs(self, ctx: ToolContext) -> list[str]:
        rows = await ctx.session.execute(
            select(Category.slug).where(or_(Category.user_id.is_(None), Category.user_id == ctx.user_id)).order_by(Category.slug)
        )
        return list(rows.scalars().all())

    async def run(self, ctx: ToolContext, intention_id: uuid.UUID) -> AgentResult:
        timings: dict[str, float] = {}
        started = clock = time.perf_counter()

        def lap(step: str) -> None:
            nonlocal clock
            now = time.perf_counter()
            timings[step] = round((now - clock) * 1000, 1)
            clock = now

        try:
            item = await read_captured_item(ctx, intention_id)
            metadata = await read_page_metadata(ctx, item, self.fetch_metadata)
            lap("gather")
            output = await self.provider.structured(
                system=build_system_prompt(await self._category_slugs(ctx)),
                user=build_user_input(source_type=item.source_type, content=item.content, user_note=item.owner_note, metadata=metadata),
                output=IntentionAnalysisOutput,
            )
            lap("model")
            applied = await save_suggestions(ctx, intention_id, output)
            lap("save")
        except Exception as exc:
            code = exc.code if isinstance(exc, AppError) else type(exc).__name__
            logger.info(
                "agent run",
                extra={"agent": self.name, "intention_id": str(intention_id), "outcome": code, "prompt_version": PROMPT_VERSION,
                       "duration_ms": round((time.perf_counter() - started) * 1000, 1), **{f"{k}_ms": v for k, v in timings.items()}},
            )
            raise

        model = getattr(self.provider, "last_model", self.provider.model)
        logger.info(
            "agent run",
            extra={
                "agent": self.name,
                "intention_id": str(intention_id),
                "outcome": "ok",
                "provider": self.provider.name,
                "model": model,
                "prompt_version": PROMPT_VERSION,
                "schema_version": ANALYSIS_SCHEMA_VERSION,
                "fields_written": len(applied),
                "confidence": output.confidence,
                "metadata_available": metadata is not None,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                **{f"{k}_ms": v for k, v in timings.items()},
            },
        )
        return AgentResult(
            output=output,
            applied_fields=applied,
            provider=self.provider.name,
            model=model,
            metadata_available=metadata is not None,
            timings_ms=timings,
        )
