# ==============================================================================
# PURPOSE: Sourcing Agent Tools.
# DATA FLOW: Takes category name -> queries supplier service -> returns manufacturers quotes.
# EXTENSION POINTS: Add automatic PDF RFQ template builders.
# ==============================================================================

import logging
from typing import Dict, Any
from app.core.tool_registry import register_tool
from app.core.dependency_container import container

logger = logging.getLogger("eve.agents.sourcing.tools")


@register_tool(name="find_suppliers")
def find_suppliers(category: str) -> Dict[str, Any]:
    """
    Queries catalog database to search for manufacturers matching the product category.
    """
    logger.info(f"Sourcing Tool: Querying suppliers catalog for category: '{category}'")
    supplier_service = container.get("supplier_service")
    vendors = supplier_service.search_suppliers(category)
    return {"suppliers": vendors}
