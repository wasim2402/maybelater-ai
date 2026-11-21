"""Evaluates the Capture Understanding Agent's model step against the curated sample captures.

Run from backend/ with the venv active (needs GEMINI_API_KEY):
    python scripts/eval_capture.py            # all cases
    python scripts/eval_capture.py ramen-note museum-trip

Uses the same prompt, schema and provider as the app (including the fallback model), no database.
Prints a table and writes evals/last_run.json (synthetic inputs and model answers only).
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.services.ai.prompts import PROMPT_VERSION, build_system_prompt, build_user_input  # noqa: E402
from app.services.ai.provider import get_ai_provider  # noqa: E402
from app.services.ai.schemas import ANALYSIS_SCHEMA_VERSION, IntentionAnalysisOutput  # noqa: E402
from evals.scoring import score, summarize  # noqa: E402

CATEGORIES = ["food-cooking", "ideas", "learning", "places", "reading", "shopping", "to-do", "travel", "watch-listen"]
CONCURRENCY = 2
RATE_LIMIT_WAITS = (20, 40, 60)  # seconds to wait when the per-minute quota runs out


async def run_case(provider_factory, case: dict, gate: asyncio.Semaphore) -> dict:
    async with gate:
        provider = provider_factory()  # one per case, so last_model is per case
        content = case["content"]
        source = "url" if content.startswith(("http://", "https://")) else "text"
        for wait in (*RATE_LIMIT_WAITS, None):
            started = time.perf_counter()
            try:
                out = await provider.structured(
                    system=build_system_prompt(CATEGORIES),
                    user=build_user_input(source_type=source, content=content, user_note=None, metadata=None),
                    output=IntentionAnalysisOutput,
                )
                break
            except AppError as exc:
                if exc.code == "provider_rate_limited" and wait is not None:
                    print(f"  ...    {case['id']:<18} rate limited, waiting {wait}s")
                    await asyncio.sleep(wait)
                    continue
                return {"id": case["id"], "error": exc.code, "latency_ms": round((time.perf_counter() - started) * 1000, 1)}
        return {
            "id": case["id"],
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "model": getattr(provider, "last_model", provider.model),
            "output": out,
        }


async def main() -> int:
    settings = get_settings()
    if not settings.ai_configured:
        print("AI is not configured: set GEMINI_API_KEY in backend/.env")
        return 1
    data = json.loads((ROOT / "evals" / "capture_cases.json").read_text(encoding="utf-8"))
    cases = [c for c in data["cases"] if len(sys.argv) < 2 or c["id"] in sys.argv[1:]]
    sample = get_ai_provider(settings)
    print(f"{len(cases)} cases · {sample.name} {sample.model} (fallback {getattr(sample, 'fallback_model', '') or 'off'}) · {PROMPT_VERSION}\n")

    gate = asyncio.Semaphore(CONCURRENCY)
    runs = await asyncio.gather(*(run_case(lambda: get_ai_provider(settings), c, gate) for c in cases))

    by_id = {c["id"]: c for c in cases}
    scores, latencies, failures, report_cases = [], [], 0, []
    for run in runs:
        latencies.append(run["latency_ms"])
        if "error" in run:
            failures += 1
            print(f"  ERROR  {run['id']:<18} {run['error']}  ({run['latency_ms']:.0f} ms)")
            report_cases.append(run)
            continue
        result = score(by_id[run["id"]], run["output"])
        scores.append(result)
        failed = [k for k, ok in result.checks.items() if not ok]
        mark = "PASS " if result.passed else "FAIL "
        detail = f"failed: {', '.join(failed)}" if failed else ""
        if result.invented:
            detail += f" invented: {result.invented}"
        print(f"  {mark}  {run['id']:<18} {run['output'].category:<13} {run['latency_ms']:>7.0f} ms  {run['model']:<18} {detail}")
        report_cases.append(
            {"id": run["id"], "model": run["model"], "latency_ms": run["latency_ms"], "checks": result.checks,
             "invented": result.invented, "output": run["output"].model_dump(mode="json")}
        )

    summary = summarize(scores, failures, latencies)
    print("\n" + "\n".join(f"  {k:<26} {v}" for k, v in summary.items()))
    report = {
        "ran_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "provider": sample.name,
        "model": sample.model,
        "fallback_model": getattr(sample, "fallback_model", ""),
        "prompt_version": PROMPT_VERSION,
        "schema_version": ANALYSIS_SCHEMA_VERSION,
        "summary": summary,
        "cases": report_cases,
    }
    (ROOT / "evals" / "last_run.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("\nreport: evals/last_run.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
