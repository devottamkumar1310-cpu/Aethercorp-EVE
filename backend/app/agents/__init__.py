"""Import agent modules so their registry decorators run on package import."""

from app.agents.analytics import analytics_agent  # noqa: F401
from app.agents.executive_orchestrator import ExecutiveOrchestrator  # noqa: F401
from app.agents.inventory import inventory_agent  # noqa: F401
from app.agents.market import market_agent  # noqa: F401
from app.agents.pricing import pricing_agent  # noqa: F401
from app.agents.sourcing import sourcing_agent  # noqa: F401