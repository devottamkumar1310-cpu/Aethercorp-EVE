import contextvars
from typing import Dict, Any

# Context variable to store telemetry of the current request/run
telemetry_context = contextvars.ContextVar("telemetry_context", default=None)

def init_telemetry():
    """Initializes the telemetry data structure in the current context."""
    data = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "token_cost": 0.0,
        "agents": {},  # {agent_name: {status: str, latency_ms: int}}
    }
    token = telemetry_context.set(data)
    return token

def record_tokens(prompt: int, completion: int, cost: float):
    """Records token usage and cost in the current telemetry context if active."""
    ctx = telemetry_context.get()
    if ctx is not None:
        ctx["prompt_tokens"] += prompt
        ctx["completion_tokens"] += completion
        ctx["token_cost"] += cost

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
