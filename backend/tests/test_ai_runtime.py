"""
Tests for the AI runtime — the single execution pipeline for every provider
call. These cover the properties that actually prevent a surprise bill:
correct pricing, fail-closed budget enforcement, bounded retries, and
fail-open accounting.
"""
import asyncio
from decimal import Decimal
from unittest.mock import patch

import pytest

from app.core.ai_runtime import (
    AIRequest,
    AIBudgetExceededError,
    Usage,
    ai_execute,
    check_budget,
    estimate_cost,
    PRICING,
    FALLBACK_PRICE,
)


def _req(**kw):
    defaults = dict(provider="google", model="gemini-2.5-flash",
                    feature="test", timeout=5.0, retries=3)
    defaults.update(kw)
    return AIRequest(**defaults)


# --------------------------------------------------------------------------
# Pricing
# --------------------------------------------------------------------------

def test_pricing_matches_published_rates():
    """1M input + 1M output on Flash = $0.30 + $2.50."""
    cost = estimate_cost("google", "gemini-2.5-flash",
                         Usage(input_tokens=1_000_000, output_tokens=1_000_000))
    assert cost == Decimal("2.800000")


def test_pro_is_priced_far_above_flash():
    """Guards the routing incentive: Pro must never be cheap by accident."""
    u = Usage(input_tokens=1_000_000, output_tokens=1_000_000)
    assert estimate_cost("google", "gemini-2.5-pro", u) > \
           estimate_cost("google", "gemini-2.5-flash", u) * 3


def test_unknown_model_fails_expensive_not_free():
    """
    The critical property: a model nobody added to PRICING must NOT cost zero.
    Silent $0 for an unrecognised model is how a surprise bill happens.
    """
    u = Usage(input_tokens=1_000_000, output_tokens=1_000_000)
    cost = estimate_cost("google", "totally-new-model", u)
    assert cost == FALLBACK_PRICE[0] + FALLBACK_PRICE[1]
    assert cost > estimate_cost("google", "gemini-2.5-pro", u)


def test_cached_tokens_billed_at_cheaper_rate():
    cached = estimate_cost("google", "gemini-2.5-flash", Usage(cached_tokens=1_000_000))
    fresh = estimate_cost("google", "gemini-2.5-flash", Usage(input_tokens=1_000_000))
    assert 0 < cached < fresh


def test_zero_usage_is_zero_cost():
    assert estimate_cost("google", "gemini-2.5-flash", Usage()) == Decimal("0.000000")


def test_pricing_uses_decimal_not_float():
    """Float accumulates error across millions of summed rows."""
    for rates in PRICING.values():
        assert all(isinstance(r, Decimal) for r in rates)


# --------------------------------------------------------------------------
# Budget enforcement
# --------------------------------------------------------------------------

def test_kill_switch_blocks_all_calls():
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime._record_blocked"):
        s.AI_KILL_SWITCH = True
        s.AI_DAILY_CAP_USD = 1000.0
        with pytest.raises(AIBudgetExceededError) as exc:
            check_budget(_req())
        assert exc.value.reason == "kill_switch"


def test_cap_blocks_when_spend_reaches_limit():
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("25.00")), \
         patch("app.core.ai_runtime._record_blocked"):
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        with pytest.raises(AIBudgetExceededError) as exc:
            check_budget(_req())
        assert exc.value.reason == "daily_cap"


def test_cap_allows_when_under_limit():
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("4.00")):
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        check_budget(_req())  # must not raise


def test_unknown_spend_fails_closed():
    """
    If we cannot determine today's spend, we BLOCK. An unknown spend is exactly
    the situation the cap exists to protect against.
    """
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime.get_global_daily_spend", return_value=None), \
         patch("app.core.ai_runtime._record_blocked"):
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        with pytest.raises(AIBudgetExceededError):
            check_budget(_req())


def test_cap_of_zero_disables_enforcement():
    with patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 0
        check_budget(_req())  # explicit opt-out must not raise


def test_blocked_calls_are_recorded():
    """A silent block is an invisible outage."""
    recorded = []
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime.record_usage", side_effect=lambda r, res: recorded.append(res)):
        s.AI_KILL_SWITCH = True
        s.AI_DAILY_CAP_USD = 25.0
        with pytest.raises(AIBudgetExceededError):
            check_budget(_req())
    assert len(recorded) == 1
    assert recorded[0].status == "blocked_kill"


# --------------------------------------------------------------------------
# Execution pipeline
# --------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, prompt_tokens=100, output_tokens=50):
        class _Meta:
            prompt_token_count = prompt_tokens
            candidates_token_count = output_tokens
            cached_content_token_count = 0
        self.usage_metadata = _Meta()


def _usage_from(resp):
    m = resp.usage_metadata
    return Usage(input_tokens=m.prompt_token_count,
                 output_tokens=m.candidates_token_count,
                 cached_tokens=m.cached_content_token_count)


def _patched(spend="0.00"):
    return (
        patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal(spend)),
        patch("app.core.ai_runtime.record_usage"),
    )


def test_successful_call_returns_priced_result():
    p1, p2 = _patched()
    with p1, p2, patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 3

        async def invoke():
            return _FakeResponse()

        result = asyncio.run(ai_execute(_req(), invoke, _usage_from))

    assert result.status == "success"
    assert result.usage.input_tokens == 100
    assert result.cost_usd > 0
    assert result.retry_count == 0


def test_transient_failure_is_retried_then_succeeds():
    calls = {"n": 0}
    p1, p2 = _patched()
    with p1, p2, patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 3

        async def invoke():
            calls["n"] += 1
            if calls["n"] < 3:
                raise RuntimeError("503 transient")
            return _FakeResponse()

        result = asyncio.run(ai_execute(_req(retries=3), invoke, _usage_from))

    assert calls["n"] == 3
    assert result.retry_count == 2


def test_fatal_error_is_not_retried():
    """Retrying an invalid API key burns time and money for a guaranteed fail."""
    calls = {"n": 0}
    p1, p2 = _patched()
    with p1, p2, patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 3

        async def invoke():
            calls["n"] += 1
            raise RuntimeError("API_KEY_INVALID")

        with pytest.raises(RuntimeError):
            asyncio.run(ai_execute(
                _req(retries=3), invoke, _usage_from,
                is_fatal=lambda e: "API_KEY_INVALID" in str(e),
            ))

    assert calls["n"] == 1, "fatal error must not be retried"


def test_retries_are_clamped_by_max_retries_setting():
    """A caller asking for 10 retries must not be able to bill 10 calls."""
    calls = {"n": 0}
    p1, p2 = _patched()
    with p1, p2, patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 2

        async def invoke():
            calls["n"] += 1
            raise RuntimeError("503 transient")

        with pytest.raises(RuntimeError):
            asyncio.run(ai_execute(_req(retries=10), invoke, _usage_from))

    assert calls["n"] == 2


def test_failed_call_is_recorded_with_error_status():
    recorded = []
    with patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("0")), \
         patch("app.core.ai_runtime.record_usage", side_effect=lambda r, res: recorded.append(res)), \
         patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 1

        async def invoke():
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError):
            asyncio.run(ai_execute(_req(retries=1), invoke, _usage_from))

    assert recorded and recorded[-1].status == "error"


def test_timeout_is_recorded_as_timeout_not_error():
    recorded = []
    with patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("0")), \
         patch("app.core.ai_runtime.record_usage", side_effect=lambda r, res: recorded.append(res)), \
         patch("app.core.ai_runtime.settings") as s:
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 1

        async def invoke():
            await asyncio.sleep(5)

        with pytest.raises(asyncio.TimeoutError):
            asyncio.run(ai_execute(_req(retries=1, timeout=0.05), invoke, _usage_from))

    assert recorded and recorded[-1].status == "timeout"


def test_budget_block_prevents_invocation_entirely():
    """The cap must stop the call before any money is spent."""
    calls = {"n": 0}
    with patch("app.core.ai_runtime.settings") as s, \
         patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("999")), \
         patch("app.core.ai_runtime.record_usage"):
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 3

        async def invoke():
            calls["n"] += 1
            return _FakeResponse()

        with pytest.raises(AIBudgetExceededError):
            asyncio.run(ai_execute(_req(), invoke, _usage_from))

    assert calls["n"] == 0, "provider must never be called once the cap is hit"


def test_accounting_failure_does_not_break_the_call():
    """
    record_usage fails OPEN — a logging outage must not break the product.

    SessionLocal is imported inside record_usage, so it must be patched at its
    source module (app.database), not on ai_runtime.
    """
    with patch("app.core.ai_runtime.get_global_daily_spend", return_value=Decimal("0")), \
         patch("app.core.ai_runtime.settings") as s, \
         patch("app.database.SessionLocal", side_effect=Exception("db down")):
        s.AI_KILL_SWITCH = False
        s.AI_DAILY_CAP_USD = 25.0
        s.AI_MAX_RETRIES = 3

        async def invoke():
            return _FakeResponse()

        # Real record_usage runs here; its DB access fails and must be swallowed.
        result = asyncio.run(ai_execute(_req(), invoke, _usage_from))

    assert result.status == "success"


def test_budget_check_fails_closed_when_db_is_down():
    """The mirror of the test above: unknown spend must BLOCK, not proceed."""
    from app.core.ai_runtime import get_global_daily_spend
    with patch("app.database.SessionLocal", side_effect=Exception("db down")):
        assert get_global_daily_spend() is None


def test_every_request_gets_a_unique_id():
    assert _req().request_id != _req().request_id
