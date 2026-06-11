# backend/app/core/rate_limiter.py
"""
PURPOSE: Simple sliding-window in-memory rate limiter for FastAPI endpoints.
Data flow: FastAPI Depends() injection -> checks request count per client IP within window.
Extension: Replace with Redis-backed sliding window for multi-instance deployments.
"""
import time
import asyncio
import logging
from collections import defaultdict, deque
from fastapi import HTTPException, Request, status

logger = logging.getLogger("eve.core.rate_limiter")

# Structure: {ip_address: deque of timestamps}
_request_log: dict[str, deque] = defaultdict(deque)
_lock = asyncio.Lock()


def rate_limit(requests: int = 60, window_seconds: int = 60):
    """
    FastAPI dependency that limits requests per IP using a sliding-window algorithm.
    Usage:
        @router.post("/chat")
        async def chat(request: Request, _: None = Depends(rate_limit(requests=20, window_seconds=60))):
    """
    async def check(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - window_seconds

        async with _lock:
            bucket = _request_log[client_ip]
            # Remove timestamps outside the sliding window
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= requests:
                logger.warning(
                    f"Rate limit exceeded for {client_ip}: {len(bucket)} reqs in {window_seconds}s"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Max {requests} requests per {window_seconds} seconds."
                )

            bucket.append(now)

    return check
