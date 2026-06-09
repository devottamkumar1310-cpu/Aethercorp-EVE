# ==============================================================================
# PURPOSE: Pricing Agent Tools.
# DATA FLOW: Takes tenant ID -> calls analytics service pricing model -> returns SKU adjustments.
# EXTENSION POINTS: Add batch price updates to remote stores (Shopify sync tool).
# ==============================================================================

import logging
from typing import Dict, Any
from app.core.tool_registry import register_tool
from app.core.dependency_container import container
from app.database import SessionLocal

logger = logging.getLogger("eve.agents.pricing.tools")


@register_tool(name="run_pricing_analysis")
def run_pricing_analysis(organization_id: int) -> Dict[str, Any]:
    """
    Evaluates gross margins, calculates price elasticity of demand, and suggests optimizations.
    """
    logger.info(f"Pricing Tool: Running price optimizer for Org: {organization_id}")
    analytics_service = container.get("analytics_service")
    
    db = SessionLocal()
    try:
        results = analytics_service.get_pricing_analysis(db, organization_id)
        return results
    finally:
        db.close()
