import contextvars
from typing import Dict, Any

# Context variable to store telemetry of the current request/run
telemetry_context = contextvars.ContextVar("telemetry_context", default=None)

def init_telemetry(organization_id=None, user_id=None, feature=None):
    """
    Initializes the telemetry data structure in the current context.

    organization_id/user_id/feature are carried here so the AI runtime can
    attribute spend without every call site threading them through its
    signature. All are optional — background jobs legitimately have no owning
    org, and their usage is still recorded (against a null org) and still
    counts toward the global cap.
    """
    data = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "token_cost": 0.0,
        "agents": {},  # {agent_name: {status: str, latency_ms: int}}
        "organization_id": organization_id,
        "user_id": user_id,
        "feature": feature,
    }
    token = telemetry_context.set(data)
    return token


def set_ai_scope(organization_id=None, user_id=None, feature=None):
    """
    Attaches or updates AI attribution scope on an already-active context.
    Used where the org is resolved after telemetry has been initialised.
    """
    ctx = telemetry_context.get()
    if ctx is None:
        return
    if organization_id is not None:
        ctx["organization_id"] = organization_id
    if user_id is not None:
        ctx["user_id"] = user_id
    if feature is not None:
        ctx["feature"] = feature

def record_tokens(prompt: int, completion: int, cost: float, agent_name: str = None):
    """Records token usage and cost in the current telemetry context if active."""
    ctx = telemetry_context.get()
    if ctx is not None:
        ctx["prompt_tokens"] += prompt
        ctx["completion_tokens"] += completion
        ctx["token_cost"] += cost
        if agent_name:
            if agent_name not in ctx["agents"]:
                ctx["agents"][agent_name] = {"status": "success", "latency_ms": 0}
            agent_ctx = ctx["agents"][agent_name]
            agent_ctx["prompt_tokens"] = agent_ctx.get("prompt_tokens", 0) + prompt
            agent_ctx["completion_tokens"] = agent_ctx.get("completion_tokens", 0) + completion
            agent_ctx["cost"] = agent_ctx.get("cost", 0.0) + cost

def record_agent_metric(agent_name: str, status: str, latency_ms: int, error: str = None):
    """Records execution status and latency for an agent."""
    ctx = telemetry_context.get()
    if ctx is not None:
        metric = {"status": status, "latency_ms": latency_ms}
        if error:
            metric["error"] = error
        ctx["agents"][agent_name] = metric

def get_telemetry() -> Dict[str, Any]:
    """Retrieves current telemetry data."""
    return telemetry_context.get() or {}

def clear_telemetry(token):
    """Resets the context variable."""
    telemetry_context.reset(token)
