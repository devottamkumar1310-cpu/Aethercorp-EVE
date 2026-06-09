# ==============================================================================
# PURPOSE: Inventory Agent Tools.
# DATA FLOW: Queries database inventory levels and velocities, returning reorder suggestions.
# EXTENSION POINTS: Add automatic email alerts for suppliers when ROP is violated.
# ==============================================================================

import logging
from typing import Dict, Any
from app.core.tool_registry import register_tool
from app.core.dependency_container import container
from app.database import SessionLocal

logger = logging.getLogger("eve.agents.inventory.tools")


@register_tool(name="run_inventory_analysis")
def run_inventory_analysis(organization_id: int) -> Dict[str, Any]:
    """
    Analyzes stockout risks, safety stock limits, and flags dead stock for the brand.
    """
    logger.info(f"Inventory Tool: Running stock check for Org: {organization_id}")
    analytics_service = container.get("analytics_service")
    
    # Open transactional session
    db = SessionLocal()
    try:
        results = analytics_service.get_inventory_analysis(db, organization_id)
        return results
    finally:
        db.close()
