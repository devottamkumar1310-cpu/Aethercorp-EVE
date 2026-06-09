# ==============================================================================
# PURPOSE: Fashion Intelligence - Sell-Through Rate calculations.
# DATA FLOW: Takes sales units and stock levels -> computes percentage.
# EXTENSION POINTS: Add size-level or colorway-level sell-through calculations.
# EDUCATIONAL COMMENTS:
# - Sell-Through Rate (STR) = (Units Sold / (Units Sold + Ending Stock)) * 100
# - Measures stock performance; high STR (>80%) suggests high demand or under-stocking.
# - Low STR (<40%) suggests over-stocking or slow movement.
# ==============================================================================

import logging

logger = logging.getLogger("eve.fashion.sell_through")


def calculate_sell_through_rate(units_sold: int, ending_stock: int) -> float:
    """
    Computes the Sell-Through Rate percentage for a SKU.
    """
    total_stock = units_sold + ending_stock
    if total_stock <= 0:
        return 0.0
    
    str_percentage = (units_sold / total_stock) * 100.0
    return round(str_percentage, 2)
