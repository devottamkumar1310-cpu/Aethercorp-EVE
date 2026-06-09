# ==============================================================================
# PURPOSE: Fashion Intelligence - Seasonality Detection.
# DATA FLOW: Monthly sales history inputs -> seasonal indices output.
# EXTENSION POINTS: Add weather API linkages, regional adjustments, or fashion calendar cycles.
# EDUCATIONAL COMMENTS:
# - Seasonal index represents how much sales in a specific month deviate from average monthly sales.
# - Index of 1.0 means average, 1.25 means +25% above average, 0.8 means -20% below average.
# ==============================================================================

import logging
from typing import List, Dict

logger = logging.getLogger("eve.fashion.seasonality")


def calculate_seasonality_indices(monthly_sales: List[float]) -> Dict[int, float]:
    """
    Given a list of sales for 12 months, calculates the seasonal index for each month.
    """
    if len(monthly_sales) != 12:
        # If less than 12 months, return flat indices (no seasonality detectable)
        return {month: 1.0 for month in range(1, 13)}
        
    avg_sales = sum(monthly_sales) / 12.0
    if avg_sales <= 0:
        return {month: 1.0 for month in range(1, 13)}
        
    # Index = Monthly Sales / Average Monthly Sales
    indices = {}
    for index, sales in enumerate(monthly_sales):
        month = index + 1
        indices[month] = round(sales / avg_sales, 2)
        
    return indices
