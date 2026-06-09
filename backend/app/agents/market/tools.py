# ==============================================================================
# PURPOSE: Market Agent Tools.
# DATA FLOW: Takes product SKU -> queries competitor service -> returns competitor pricing data.
# EXTENSION POINTS: Add social media fashion search monitors, keyword trend analyzers.
# ==============================================================================

import logging
from typing import Dict, Any
from app.core.tool_registry import register_tool
from app.core.dependency_container import container

logger = logging.getLogger("eve.agents.market.tools")


@register_tool(name="monitor_competitor_prices")
def monitor_competitor_prices(sku: str) -> Dict[str, Any]:
    """
    Scrapes or pulls competitor catalog listings for the requested SKU.
    """
    logger.info(f"Market Tool: Checking pricing index for SKU: '{sku}'")
    comp_service = container.get("competitor_service")
    return comp_service.get_competitor_price(sku)
