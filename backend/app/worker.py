"""Standalone reminder worker: `python -m app.worker` (from backend/).

Use it when the API runs as several processes (set REMINDER_WORKER_ENABLED=false on the API). Running
it next to the in-process worker is also safe: due reminders are claimed with SKIP LOCKED and each
version is delivered at most once.
"""

from __future__ import annotations

import asyncio
import contextlib
import signal

from app.core.config import get_settings
from app.core.logging import configure_logging, resolve_format
from app.db.session import SessionLocal
from app.services.reminder_delivery import run_worker


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, resolve_format(settings.log_format, settings.is_development))
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):  # Windows: Ctrl+C raises KeyboardInterrupt instead
            loop.add_signal_handler(sig, stop.set)
    await run_worker(SessionLocal, stop, settings.reminder_worker_interval_seconds)


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
