# backend/app/core/cache.py
"""
PURPOSE: Lightweight TTL in-memory cache for intelligence service functions.
Data flow: Functions decorated with @cached(ttl=N) return cached results within TTL window.
Extension: Replace with Redis for multi-process cache in production.
"""
import time
import logging
import functools
import threading
from typing import Any, Optional

logger = logging.getLogger("eve.core.cache")

_cache: dict[str, tuple[Any, float]] = {}  # key -> (value, expiry_timestamp)
_lock = threading.Lock()


def _make_key(func_name: str, *args) -> str:
    key_parts = [func_name]
    for arg in args:
        key_parts.append(str(arg))
    return ":".join(key_parts)


def get(key: str) -> Optional[Any]:
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.monotonic() > expiry:
            del _cache[key]
            return None
        return value


def set(key: str, value: Any, ttl: int) -> None:
    with _lock:
        _cache[key] = (value, time.monotonic() + ttl)


def invalidate(key: str) -> None:
    with _lock:
        _cache.pop(key, None)


def invalidate_workspace(workspace_id: str) -> None:
    """Invalidate all cache entries for a given workspace."""
    with _lock:
        keys_to_delete = [k for k in _cache if str(workspace_id) in k]
        for k in keys_to_delete:
            del _cache[k]
        if keys_to_delete:
            logger.debug(f"Cache: invalidated {len(keys_to_delete)} entries for workspace {workspace_id}")


def cached(ttl: int = 30):
    """
    Decorator that caches function results by (function_name, *args) key.
    The first positional argument after db (i.e. workspace_id) is used as the cache scope.
    Usage:
        @cached(ttl=30)
        def get_health_score(db: Session, workspace_id: UUID) -> dict:
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from function name + all args except db (first arg)
            cache_args = args[1:]  # skip db session
            key = _make_key(func.__name__, *cache_args)

            cached_result = get(key)
            if cached_result is not None:
                logger.debug(f"Cache HIT: {key}")
                return cached_result

            logger.debug(f"Cache MISS: {key}")
            result = func(*args, **kwargs)
            set(key, result, ttl)
            return result
        return wrapper
    return decorator
