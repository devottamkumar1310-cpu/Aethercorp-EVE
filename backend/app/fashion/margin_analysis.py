# ==============================================================================
# PURPOSE: Fashion Intelligence - Margin Analysis.
# DATA FLOW: Selling Price and Unit Cost -> Margin Percent.
# ==============================================================================

import logging
from typing import Dict, Any

logger = logging.getLogger("eve.fashion.margin_analysis")

def calculate_margin(
    selling_price: float,
    unit_cost: float
) -> Dict[str, Any]:
    """
    Calculates current gross margin percent.
    Formula: (Selling Price - Unit Cost) / Selling Price
    """
    if selling_price <= 0:
        margin_percent = 0.0
    else:
        margin_percent = ((selling_price - unit_cost) / selling_price) * 100.0
        
    return {
        "margin_percent": round(margin_percent, 2)
    }
