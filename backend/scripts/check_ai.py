"""Live check of the AI setup: sends one sample item to Gemini and prints the validated suggestions.

Run from backend/ with the venv active, after setting GEMINI_API_KEY in backend/.env:
    python scripts/check_ai.py
    python scripts/check_ai.py "https://example.com/some-article"
Uses no database and stores nothing.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.services.ai.prompts import PROMPT_VERSION, build_system_prompt, build_user_input  # noqa: E402
from app.services.ai.provider import get_ai_provider  # noqa: E402
from app.services.ai.schemas import IntentionAnalysisOutput  # noqa: E402
from app.services.page_metadata import fetch_page_metadata  # noqa: E402

CATEGORIES = ["reading", "watch-listen", "places", "shopping", "food-cooking", "travel", "learning", "ideas", "to-do"]


async def main() -> int:
    settings = get_settings()
    if not settings.ai_configured:
        print("AI is not configured: set GEMINI_API_KEY (and optionally GEMINI_MODEL) in backend/.env")
        return 1
    content = sys.argv[1] if len(sys.argv) > 1 else "Try the ramen place Ana mentioned near the station, maybe this weekend"
    source = "url" if content.startswith(("http://", "https://")) else "text"
    metadata = await fetch_page_metadata(content) if source == "url" else None
    provider = get_ai_provider(settings)
    fallback = getattr(provider, "fallback_model", "")
    print(f"provider: {provider.name} · model: {provider.model}" + (f" · fallback: {fallback}" if fallback else "") + f" · prompt: {PROMPT_VERSION}")
    print(f"input ({source}): {content}" + (f"\npage metadata: {metadata}" if source == "url" else ""))
    try:
        result = await provider.structured(
            system=build_system_prompt(CATEGORIES),
            user=build_user_input(source_type=source, content=content, user_note=None, metadata=metadata),
            output=IntentionAnalysisOutput,
        )
    except AppError as exc:
        print(f"FAILED: {exc.code}: {exc.message}")
        if exc.__cause__ is not None:
            print(f"cause: {type(exc.__cause__).__name__}: {exc.__cause__}")
        return 2
    answered = getattr(provider, "last_model", provider.model)
    note = " (fallback: the main model was busy)" if answered != provider.model else ""
    print(f"OK, answered by {answered}{note}. Validated output:")
    print(result.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
