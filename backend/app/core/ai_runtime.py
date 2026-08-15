# ==============================================================================
# PURPOSE: The single execution pipeline for every AI provider call in EVE.
#
# WHY THIS SHAPE:
#   The runtime OWNS invocation rather than wrapping it. A context manager could
#   observe a call but never retry it, time it out, or skip it — which rules out
#   retry, timeout, caching, model routing and provider fallback. Passing the
#   provider call in as `invoke` keeps all of those available as future edits to
#   ai_execute() alone, with no change to any business logic.
#
# PROVIDER-AGNOSTIC:
#   Everything here is neutral except PRICING. Adding OpenAI/Anthropic/OCR means
#   a pricing entry plus a thin invoke+extract pair — not a new pipeline.
#
# NOT BUILT YET (deliberate — see the marked insertion points below):
#   caching, model routing, fallback providers, prompt versioning, A/B testing.
#   The shape admits them; none are speculatively implemented.
# ==============================================================================

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Awaitable, Callable, Optional, Tuple

from app.config import settings

logger = logging.getLogger("eve.core.ai_runtime")


# ---------------------------------------------------------------------------
# Pricing — the ONLY provider-specific concern in this module.
# USD per 1,000,000 tokens. Keep in code (version-controlled, auditable, no
# admin UI needed); promote to a table only when prices must change without a
# deploy.
# ---------------------------------------------------------------------------
PRICING: dict[Tuple[str, str], Tuple[Decimal, Decimal, Decimal]] = {
    # (provider, model): (input_per_mtok, output_per_mtok, cached_input_per_mtok)
    #
    # Rates are the published paid-tier prices at ai.google.dev/gemini-api/docs/pricing.
    #
    # gemini-3.6-flash is EVE's current model. Its price RISES on 2027-01-01 to
    # $1.50 / $7.50 — see PRICING_2027 below. That is a 2x step, so anything that
    # reasons about margin must model both.
    ("google", "gemini-3.6-flash"):      (Decimal("0.75"), Decimal("3.75"), Decimal("0.075")),
    ("google", "gemini-3.5-flash"):      (Decimal("1.50"), Decimal("9.00"), Decimal("0.15")),
    ("google", "gemini-3.1-flash-lite"): (Decimal("0.10"), Decimal("0.40"), Decimal("0.025")),
    # Retired 2026-10-16, kept ONLY so historical AIUsageLog rows written before
    # the migration still cost out correctly in reports. Do not call these.
    ("google", "gemini-2.5-flash"):      (Decimal("0.30"), Decimal("2.50"), Decimal("0.075")),
    ("google", "gemini-2.5-flash-lite"): (Decimal("0.10"), Decimal("0.40"), Decimal("0.025")),
    ("google", "gemini-2.5-pro"):        (Decimal("1.25"), Decimal("10.00"), Decimal("0.31")),
    ("google", "gemini-2.0-flash"):      (Decimal("0.10"), Decimal("0.40"), Decimal("0.025")),
}

# Announced price change effective 2027-01-01. Held separately rather than
# swapped in on the date, because billing history must keep costing out at the
# rate that actually applied when the call was made.
PRICING_2027: dict[Tuple[str, str], Tuple[Decimal, Decimal, Decimal]] = {
    ("google", "gemini-3.6-flash"): (Decimal("1.50"), Decimal("7.50"), Decimal("0.15")),
}

# An unknown model must NOT cost zero. Silent $0 for a model someone added last
# week is precisely how a surprise bill happens — so price it pessimistically
# and shout about it.
FALLBACK_PRICE = (Decimal("2.00"), Decimal("15.00"), Decimal("0.50"))


class AIBudgetExceededError(Exception):
    """Raised when a call is refused by the kill switch or the spend cap."""
    def __init__(self, message: str, reason: str):
        super().__init__(message)
        self.reason = reason  # "kill_switch" | "daily_cap"


@dataclass
class AIRequest:
    """Provider-neutral description of one AI call."""
    provider: str
    model: str
    feature: str
    prompt: str = ""
    timeout: float = 30.0
    retries: int = 3
    # Escape hatch so callers never need this dataclass widened for one-offs.
    metadata: dict = field(default_factory=dict)
    request_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0


@dataclass
class AIResult:
    raw: Any
    usage: Usage
    cost_usd: Decimal
    latency_ms: int
    retry_count: int = 0
    cache_hit: bool = False
    status: str = "success"


def estimate_cost(provider: str, model: str, usage: Usage) -> Decimal:
    """Cost in USD for a completed call, computed at write time."""
    key = (provider, model)
    price = PRICING.get(key)
    if price is None:
        logger.warning(
            f"No pricing for {provider}/{model} — charging fallback rate. "
            f"Add it to PRICING in ai_runtime.py."
        )
        price = FALLBACK_PRICE

    input_rate, output_rate, cached_rate = price
    million = Decimal("1000000")
    # Cached tokens are billed at the cheaper rate and are a subset of nothing —
    # providers report them separately from input_tokens.
    return (
        (Decimal(usage.input_tokens) * input_rate / million)
        + (Decimal(usage.output_tokens) * output_rate / million)
        + (Decimal(usage.cached_tokens) * cached_rate / million)
    ).quantize(Decimal("0.000001"))


# ---------------------------------------------------------------------------
# Budget enforcement
# ---------------------------------------------------------------------------

def _today_start():
    import datetime
    now = datetime.datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _is_missing_table_error(e: Exception) -> bool:
    """
    Distinguishes 'the usage table does not exist yet' from 'the database is
    unreachable'. These look similar but mean opposite things: a missing table
    means no usage has been recorded (spend really is zero), whereas an
    unreachable database means spend is genuinely unknown.
    """
    msg = str(e).lower()
    return (
        "no such table" in msg              # SQLite
        or "undefinedtable" in msg          # psycopg
        or "does not exist" in msg          # Postgres "relation ... does not exist"
        or "doesn't exist" in msg           # MySQL
    )


def get_global_daily_spend() -> Optional[Decimal]:
    """
    Total spend across all organizations since UTC midnight.

    Returns None if spend cannot be determined — the caller treats that as a
    reason to BLOCK (fail closed), because an unknown spend is exactly the
    situation the cap exists to protect against.

    Exception: a missing table returns Decimal(0), not None. On a first deploy
    the table is created by init_db() at startup, and failing closed there
    would block every AI call across the whole product because of a table that
    is empty by definition.
    """
    try:
        from app.database import SessionLocal
        from app.models.ai_usage import AIUsageLog
        from sqlalchemy import func

        db = SessionLocal()
        try:
            total = db.query(func.coalesce(func.sum(AIUsageLog.cost_usd), 0)).filter(
                AIUsageLog.created_at >= _today_start()
            ).scalar()
            return Decimal(str(total or 0))
        finally:
            db.close()
    except Exception as e:
        if _is_missing_table_error(e):
            logger.warning(
                "ai_usage_logs is not present yet — treating today's spend as $0. "
                "It is created by init_db() at startup."
            )
            return Decimal("0")
        logger.error(f"Could not determine daily AI spend: {e}")
        return None


def check_budget(req: AIRequest) -> None:
    """
    Pre-flight gate. Raises AIBudgetExceededError to refuse the call.

    Split out from ai_execute so streaming responses — which cannot be wrapped
    by a single invoke() — can still be gated.
    """
    if settings.AI_KILL_SWITCH:
        logger.critical(f"AI kill switch is ON — refusing {req.feature} ({req.provider}/{req.model})")
        _record_blocked(req, "blocked_kill")
        raise AIBudgetExceededError("AI processing is currently disabled.", reason="kill_switch")

    cap = Decimal(str(settings.AI_DAILY_CAP_USD))
    if cap <= 0:
        return  # cap disabled deliberately

    spend = get_global_daily_spend()
    if spend is None:
        # Fail CLOSED. We would rather degrade than risk an unbounded bill.
        _record_blocked(req, "blocked_quota")
        raise AIBudgetExceededError(
            "AI processing is paused while usage is verified.", reason="daily_cap"
        )

    if spend >= cap:
        logger.critical(f"Daily AI cap reached: ${spend} >= ${cap}. Refusing {req.feature}.")
        _record_blocked(req, "blocked_quota")
        raise AIBudgetExceededError(
            "Today's AI budget has been reached. Analysis resumes tomorrow.", reason="daily_cap"
        )


def _record_blocked(req: AIRequest, status: str) -> None:
    """Refusals are logged too — a silent block is an invisible outage."""
    record_usage(
        req,
        AIResult(raw=None, usage=Usage(), cost_usd=Decimal("0"),
                 latency_ms=0, status=status),
    )


# ---------------------------------------------------------------------------
# Usage recording
# ---------------------------------------------------------------------------

def record_usage(req: AIRequest, result: AIResult) -> None:
    """
    Persist one row. Fails OPEN: a logging failure must never break the product.
    Scope (org/user) is read from the existing telemetry ContextVar, so callers
    do not thread organization_id through their signatures.
    """
    try:
        from app.database import SessionLocal
        from app.models.ai_usage import AIUsageLog
        from app.core.telemetry import get_telemetry, record_tokens

        ctx = get_telemetry()
        org_id = ctx.get("organization_id")
        user_id = ctx.get("user_id")
        feature = req.feature or ctx.get("feature") or "unknown"

        db = SessionLocal()
        try:
            db.add(AIUsageLog(
                organization_id=org_id,
                user_id=user_id,
                feature=feature,
                provider=req.provider,
                model=req.model,
                input_tokens=result.usage.input_tokens,
                output_tokens=result.usage.output_tokens,
                cached_tokens=result.usage.cached_tokens,
                latency_ms=result.latency_ms,
                cost_usd=result.cost_usd,
                status=result.status,
                error_code=(result.raw if isinstance(result.raw, str) and result.status != "success" else None),
                request_id=req.request_id,
                retry_count=result.retry_count,
                cache_hit=result.cache_hit,
            ))
            db.commit()
        finally:
            db.close()

        # Keep the existing in-request telemetry working — the agent response
        # schemas and /observability routes still read from it.
        record_tokens(
            result.usage.input_tokens,
            result.usage.output_tokens,
            float(result.cost_usd),
            agent_name=req.metadata.get("agent_name"),
        )
    except Exception as e:
        logger.error(f"Failed to record AI usage (continuing anyway): {e}")


# ---------------------------------------------------------------------------
# The execution pipeline
# ---------------------------------------------------------------------------

async def ai_execute(
    req: AIRequest,
    invoke: Callable[[], Awaitable[Any]],
    extract_usage: Callable[[Any], Usage],
    is_fatal: Optional[Callable[[Exception], bool]] = None,
) -> AIResult:
    """
    Execute one AI call with budget enforcement, retry, timeout and accounting.

    invoke:         async callable performing the provider request
    extract_usage:  provider-specific mapping from raw response -> Usage
    is_fatal:       optional predicate; True means do not retry (bad key, quota)
    """
    # → prompt versioning / A/B prompt selection goes here
    # → inbound safety filtering goes here
    # → model routing goes here (choose req.model before the budget check)

    check_budget(req)

    # → cache lookup goes here: on hit, record_usage(cache_hit=True) and return
    #   without ever calling invoke()

    started = time.time()
    attempts = max(1, min(req.retries, settings.AI_MAX_RETRIES))
    backoff = 1.0
    last_error: Optional[Exception] = None

    for attempt in range(attempts):
        try:
            raw = await asyncio.wait_for(invoke(), timeout=req.timeout)
            usage = extract_usage(raw)
            result = AIResult(
                raw=raw,
                usage=usage,
                cost_usd=estimate_cost(req.provider, req.model, usage),
                latency_ms=int((time.time() - started) * 1000),
                retry_count=attempt,
                status="success",
            )
            # → outbound safety filtering goes here
            # → cache write goes here
            record_usage(req, result)
            return result

        except asyncio.TimeoutError as e:
            last_error = e
            logger.error(f"[{req.feature}] {req.provider}/{req.model} timed out "
                         f"(attempt {attempt + 1}/{attempts})")
        except Exception as e:
            last_error = e
            logger.error(f"[{req.feature}] {req.provider}/{req.model} failed "
                         f"(attempt {attempt + 1}/{attempts}): {e}")
            # A bad API key or exhausted quota will fail identically on every
            # retry — retrying just burns time and, worse, money.
            if is_fatal and is_fatal(e):
                break

        if attempt < attempts - 1:
            await asyncio.sleep(backoff)
            backoff *= 2.0

    status = "timeout" if isinstance(last_error, asyncio.TimeoutError) else "error"
    failed = AIResult(
        raw=str(last_error)[:500] if last_error else None,
        usage=Usage(),
        cost_usd=Decimal("0"),
        latency_ms=int((time.time() - started) * 1000),
        retry_count=attempts - 1,
        status=status,
    )
    record_usage(req, failed)
    # → fallback provider goes here (try a different provider before raising)
    raise last_error if last_error else RuntimeError("AI call failed with no error captured")
