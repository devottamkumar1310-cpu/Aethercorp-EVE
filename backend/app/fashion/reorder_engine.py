# ==============================================================================
# PURPOSE: Fashion Intelligence - Reorder Quantity Calculations.
# DATA FLOW: Lead time demand and safety stock -> Recommended reorder quantity.
# ==============================================================================

import math
import logging
from typing import Dict, Any

logger = logging.getLogger("eve.fashion.reorder_engine")

def calculate_reorder_quantity(
    sku: str,
    avg_daily_sales: float,
    lead_time_days: int,
    safety_stock: int
) -> Dict[str, Any]:
    """
    Calculates recommended reorder quantity based on Safety Stock + Lead Time Demand.
    Formula: Safety Stock + (Average Daily Sales * Lead Time Days)
    """
    lead_time_demand = avg_daily_sales * lead_time_days
    recommended_reorder = math.ceil(safety_stock + lead_time_demand)
    
    # Ensure a sensible minimum reorder
    if recommended_reorder < 10 and avg_daily_sales > 0:
        recommended_reorder = 50  # Default minimum order quantity if there's any velocity

    return {
        "sku": sku,
        "recommended_reorder": int(recommended_reorder)
    }
