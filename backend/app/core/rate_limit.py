"""Sliding-window rate limiting for expensive endpoints (capture, AI analysis, auth).

In-memory, so it limits per API process. That is enough for one instance in development and
the first deployment; move the store to Redis when the API runs as several instances (stage 14).

Usage in a route (stage 06+):

    capture_limit = RateLimit("capture", limit=30, window_seconds=60)

    @router.post("/captures", dependencies=[Depends(capture_limit)])
"""

from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

from app.core.errors import RateLimitedError


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: float, now: float | None = None) -> int | None:
        """Records a hit. Returns None when allowed, or the seconds to wait when over the limit."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, math.ceil(hits[0] + window_seconds - now))
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


class RateLimit:
    """FastAPI dependency. Keys by the authenticated user when known (request.state.user_id,
    set by the auth dependency in stage 05), otherwise by client address."""

    def __init__(self, name: str, limit: int, window_seconds: float) -> None:
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds

    async def __call__(self, request: Request) -> None:
        who = getattr(request.state, "user_id", None) or (request.client.host if request.client else "unknown")
        wait = limiter.hit(f"{self.name}:{who}", self.limit, self.window_seconds)
        if wait is not None:
            raise RateLimitedError(retry_after=wait)
