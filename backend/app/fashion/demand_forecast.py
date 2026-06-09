# ==============================================================================
# PURPOSE: Fashion Intelligence - Demand Forecasting and Reorder calculations.
# DATA FLOW: Sales histories and lead times -> safety stock, reorder point, and risk score.
# EXTENSION POINTS: Add double exponential smoothing, Holt-Winters, or Prophet ML models.
# EDUCATIONAL COMMENTS:
# - Reorder Point (ROP) = (Lead Time * Avg Daily Sales) + Safety Stock
# - Safety Stock acts as a buffer against supply chain variability and demand spikes.
# - Risk Score (0-100) measures how quickly stock will run out relative to lead time.
# ==============================================================================

import math
import logging
from typing import Dict, Any

logger = logging.getLogger("eve.fashion.demand_forecast")


def calculate_replenishment_metrics(
    avg_daily_sales: float,
    sales_std_dev: float,
    lead_time_days: int,
    stock_on_hand: int,
    service_level_factor: float = 1.65 # Corresponds to 95% service level
) -> Dict[str, Any]:
    """
    Computes Safety Stock, Reorder Point, and stockout risk metrics.
    """
    # 1. Safety Stock = Z * std_dev * sqrt(lead_time)
    # If std_dev is missing or 0, default to 50% of lead time demand as a fallback buffer
    lead_time_demand = avg_daily_sales * lead_time_days
    
    if sales_std_dev <= 0:
        safety_stock = math.ceil(lead_time_demand * 0.5)
    else:
        safety_stock = math.ceil(service_level_factor * sales_std_dev * math.sqrt(lead_time_days))
        
    # 2. Reorder Point = Lead Time Demand + Safety Stock
    reorder_point = math.ceil(lead_time_demand + safety_stock)
    
    # 3. Days until stockout
    days_until_stockout = 999.0
    if avg_daily_sales > 0:
        days_until_stockout = stock_on_hand / avg_daily_sales
        
    # 4. Stockout Risk Score (0 to 100)
    # Higher risk if days_until_stockout is less than supplier lead time
    if stock_on_hand <= 0:
        risk_score = 100.0
    elif days_until_stockout <= 0:
        risk_score = 100.0
    elif days_until_stockout >= lead_time_days * 2:
        risk_score = 10.0 # Safe
    else:
        # Scale risk score based on lead time coverage
        # If days_until_stockout == lead_time_days, risk is 50.
        # If days_until_stockout < lead_time_days, risk escalates rapidly.
        ratio = days_until_stockout / lead_time_days
        if ratio < 1.0:
            risk_score = 50.0 + (1.0 - ratio) * 50.0
        else:
            risk_score = 50.0 * (2.0 - ratio)
            
    risk_score = max(0.0, min(100.0, round(risk_score, 1)))

    # 5. Recommended Reorder Qty (Economic Order Quantity simplified)
    # Default to 30 days of supply or Supplier minimums
    recommended_reorder_qty = math.ceil(avg_daily_sales * 30)
    if recommended_reorder_qty < 10:
        recommended_reorder_qty = 50 # Default MOQ fallback

    return {
        "safety_stock": int(safety_stock),
        "reorder_point": int(reorder_point),
        "days_until_stockout": round(days_until_stockout, 1),
        "stockout_risk_score": risk_score,
        "recommended_reorder_qty": int(recommended_reorder_qty)
    }
