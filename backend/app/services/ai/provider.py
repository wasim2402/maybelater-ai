"""The AI provider boundary. Everything that talks to a model goes through `AIProvider`, so the
provider can change without touching routes or business logic. Prompts, output schemas and the
OpenAI implementation arrive in stage 07; outputs are validated Pydantic models, never raw JSON.
"""

from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import ProviderNotConfiguredError

OutputT = TypeVar("OutputT", bound=BaseModel)


class AIProvider(Protocol):
    async def structured(self, *, system: str, user: str, output: type[OutputT]) -> OutputT:
        """Runs one structured call and returns a validated `output` instance.
        Raises ProviderError on timeout or upstream failure."""
        ...


class UnconfiguredProvider:
    """Used when OPENAI_API_KEY / OPENAI_MODEL are not set: callers get a clear 503, and
    capture keeps working without analysis."""

    async def structured(self, *, system: str, user: str, output: type[OutputT]) -> OutputT:
        raise ProviderNotConfiguredError("Suggestions are not available yet. Your item is saved.")


def get_ai_provider(settings: Settings | None = None) -> AIProvider:
    settings = settings or get_settings()
    if not settings.ai_configured:
        return UnconfiguredProvider()
    # Stage 07: return OpenAIProvider(settings) (timeouts, retries via tenacity, structured outputs).
    return UnconfiguredProvider()
