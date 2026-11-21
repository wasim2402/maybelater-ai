from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAt, UUIDPrimaryKey, check_in
from app.models.enums import AnalysisRunStatus, values


class IntentionAnalysis(UUIDPrimaryKey, CreatedAt, Base):
    """One AI analysis run on an intention: which provider, model and prompt version produced it, and
    its validated structured output (never raw model text, never scraped page bodies). Applying the
    output to the intention respects Intention.field_states."""

    __tablename__ = "intention_analyses"
    __table_args__ = (
        check_in("status", values(AnalysisRunStatus), "status_valid"),
        CheckConstraint("output IS NULL OR jsonb_typeof(output) = 'object'", name="output_is_object"),
        CheckConstraint("status <> 'succeeded' OR output IS NOT NULL", name="succeeded_has_output"),
        ForeignKeyConstraint(
            ["intention_id", "user_id"],
            ["intentions.id", "intentions.user_id"],
            ondelete="CASCADE",
            name="fk_intention_analyses_intention_owner",
        ),
        Index("ix_intention_analyses_intention_created", "intention_id", text("created_at DESC")),
        Index("ix_intention_analyses_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    intention_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=AnalysisRunStatus.PENDING.value, default=AnalysisRunStatus.PENDING.value)
    provider: Mapped[str | None] = mapped_column(String(40))
    model: Mapped[str | None] = mapped_column(String(80))
    prompt_version: Mapped[str | None] = mapped_column(String(40))
    output: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_code: Mapped[str | None] = mapped_column(String(60))  # a code, never a provider message with content
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
