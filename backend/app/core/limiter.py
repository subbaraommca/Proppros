"""Fixed-window rate limiting.

Uses Upstash Redis (REST) when configured so limits hold across serverless
instances; falls back to an in-process dict for local dev and tests.
"""
import logging
import time

import httpx
from fastapi import HTTPException, Request

from app.core.config import settings

logger = logging.getLogger(__name__)

_memory: dict[str, tuple[int, float]] = {}


def reset() -> None:
    _memory.clear()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hit_upstash(key: str, window: int) -> int:
    resp = httpx.post(
        f"{settings.upstash_redis_rest_url}/pipeline",
        json=[["INCR", key], ["EXPIRE", key, str(window), "NX"]],
        headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
        timeout=3,
    )
    resp.raise_for_status()
    return int(resp.json()[0]["result"])


def _hit_memory(key: str, window: int) -> int:
    now = time.time()
    count, reset_at = _memory.get(key, (0, now + window))
    if now > reset_at:
        count, reset_at = 0, now + window
    count += 1
    _memory[key] = (count, reset_at)
    return count


def rate_limit(name: str, limit: int, window_seconds: int):
    """FastAPI dependency: `Depends(rate_limit("login", 10, 60))`."""

    def dependency(request: Request) -> None:
        key = f"rl:{name}:{_client_ip(request)}:{int(time.time() // window_seconds)}"
        try:
            if settings.upstash_redis_rest_url:
                count = _hit_upstash(key, window_seconds)
            else:
                count = _hit_memory(key, window_seconds)
        except Exception as exc:  # noqa: BLE001 — fail open if Redis is unreachable
            logger.warning("Rate limiter unavailable: %s", exc)
            return
        if count > limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please wait and try again.")

    return dependency
