"""Structured AI output, validated before anything is stored. Never raw model text.

The model is asked for exactly this shape (Gemini structured output with a response schema), and the
result is validated again here, so an out-of-range or malformed answer is rejected, not saved.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

ANALYSIS_SCHEMA_VERSION = "intention-analysis-v1"


class IntentionAnalysisOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(description="A short, plain title for the item, under 80 characters. Empty string if unclear.")
    summary: str = Field(description="One or two factual sentences about what the item is. Empty string if unknown.")
    intent: str = Field(
        description="Why someone might have saved this, phrased as a possibility, e.g. 'Possibly to try this recipe at the weekend.' Empty string if unclear."
    )
    category: str = Field(description="One slug from the provided category list, or 'none'.")
    suggested_tags: list[str] = Field(description="Up to 5 short lowercase tags.")
    suggested_resurface_condition: str | None = Field(
        description="Only if the item itself mentions timing or context (e.g. 'before the March trip', 'this weekend'); otherwise null."
    )
    confidence: float = Field(description="How sure you are about the suggestions, from 0 to 1.")

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return " ".join(value.split())[:120]

    @field_validator("summary")
    @classmethod
    def _summary(cls, value: str) -> str:
        return value.strip()[:600]

    @field_validator("intent")
    @classmethod
    def _intent(cls, value: str) -> str:
        return value.strip()[:300]

    @field_validator("category")
    @classmethod
    def _category(cls, value: str) -> str:
        return value.strip().lower()[:60]

    @field_validator("suggested_tags")
    @classmethod
    def _tags(cls, value: list[str]) -> list[str]:
        tags: list[str] = []
        for tag in value:
            cleaned = " ".join(str(tag).split()).lower()[:40]
            if cleaned and cleaned not in tags:
                tags.append(cleaned)
        return tags[:5]

    @field_validator("suggested_resurface_condition")
    @classmethod
    def _condition(cls, value: str | None) -> str | None:
        value = (value or "").strip()[:300]
        return value or None

    @field_validator("confidence")
    @classmethod
    def _confidence(cls, value: float) -> float:
        if not 0 <= value <= 1:
            raise ValueError("confidence must be between 0 and 1")
        return round(value, 3)
