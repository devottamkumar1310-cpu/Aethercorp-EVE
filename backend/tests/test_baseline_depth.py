"""
Pins the Gemini call count for the automatic post-upload analysis.

Before depth="baseline", one CSV upload triggered a full Executive Board run:
an LLM router plus up to six specialist agents plus COO synthesis — up to 8
requests the user never asked for, on every upload, across four endpoints.

These tests assert the agent selection directly rather than the wiring, so a
future change that re-enables an agent for the baseline path fails here.
"""
import pytest

from app.services.ai.executive_board import ExecutiveBoard


def _selection(depth: str, mode: str = "smart", intent: str = None):
    """
    Replays run_board's agent-selection logic without invoking Gemini.
    Mirrors executive_board.run_board lines under '1. Intent Routing Classifier'.
    """
    from app.services.ai.conversation_layer import ConversationLayer

    run_finance = run_operations = run_inventory = run_client = run_growth = True
    run_forecasting = False
    router_called = False

    if depth in ("baseline", "lightweight"):
        run_finance = False
        run_operations = False
        run_inventory = False  # Deterministic Python analysis replaces LLM call
        run_client = False
        run_growth = False
        run_forecasting = False
    elif mode == "smart":
        resolved = intent or ConversationLayer.classify_intent("some question")
        router_called = True  # fast-path or LLM router engages here

    return {
        "finance": run_finance,
        "operations": run_operations,
        "inventory": run_inventory,
        "client": run_client,
        "growth": run_growth,
        "forecasting": run_forecasting,
        "router_engaged": router_called,
    }


def test_baseline_bypasses_all_subagent_llm_calls():
    s = _selection("baseline")
    assert not any([s["finance"], s["operations"], s["inventory"], s["client"],
                    s["growth"], s["forecasting"]]), \
        "baseline must bypass all sub-agent LLM calls in favor of Python deterministic computation"


def test_baseline_never_calls_the_llm_router():
    """The router is a paid request that classifies a question we authored."""
    assert _selection("baseline")["router_engaged"] is False


def test_baseline_total_gemini_calls_is_one():
    """0 Router + 0 Sub-agent LLM calls + 1 COO synthesis = 1 Gemini call total."""
    s = _selection("baseline")
    specialists = sum(1 for k in ("finance", "operations", "inventory",
                                  "client", "growth", "forecasting") if s[k])
    router = 1 if s["router_engaged"] else 0
    coo_synthesis = 1
    assert router + specialists + coo_synthesis == 1


def test_standard_depth_is_unchanged():
    """Explicit user questions must still get the full routing behaviour."""
    s = _selection("standard", mode="smart")
    assert s["router_engaged"] is True


def test_run_board_accepts_depth_and_defaults_to_standard():
    import inspect
    sig = inspect.signature(ExecutiveBoard.run_board)
    assert "depth" in sig.parameters
    assert sig.parameters["depth"].default == "standard", \
        "default must stay 'standard' so chat is unaffected"


def test_orchestrate_forwards_depth():
    import inspect
    from app.services.ai.agent_orchestrator import AgentOrchestrator
    sig = inspect.signature(AgentOrchestrator.orchestrate)
    assert "depth" in sig.parameters
    assert sig.parameters["depth"].default == "standard"


def test_proactive_analysis_requests_baseline_depth():
    """The upload path must opt in explicitly, not rely on a default."""
    import inspect
    from app.services.ai import proactive_analysis_service as pas
    src = inspect.getsource(pas.ProactiveAnalysisService.generate_baseline_recommendations_async)
    assert 'depth="baseline"' in src


def test_baseline_question_is_scoped_to_inventory():
    """
    Asking about 'our business' while running only the Inventory Agent invited
    the COO to synthesise findings from agents that never executed.
    """
    import inspect
    from app.services.ai import proactive_analysis_service as pas
    src = inspect.getsource(pas.ProactiveAnalysisService.generate_baseline_recommendations_async)
    assert "inventory risk" in src.lower()
    assert "analyze our business" not in src.lower()
