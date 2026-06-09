# ==============================================================================
# PURPOSE: Fashion Intelligence - Stockout Prediction.
# DATA FLOW: Current inventory and sales velocity -> Days until stockout.
# ==============================================================================

import logging
from typing import Dict, Any

logger = logging.getLogger("eve.fashion.stockout_prediction")

def predict_stockout(
    sku: str,
    stock_on_hand: int,
    avg_daily_sales: float
) -> Dict[str, Any]:
    """
    Estimates the number of days until the product runs out of stock.
    Formula: Current Inventory / Average Daily Sales
    """
    if avg_daily_sales <= 0.001:
        days_until_stockout = 999.0  # Safe or dead stock
    else:
        days_until_stockout = max(0.0, float(stock_on_hand) / avg_daily_sales)
        
    return {
        "sku": sku,
        "days_until_stockout": round(days_until_stockout, 1)
    }
