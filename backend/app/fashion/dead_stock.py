# ==============================================================================
# PURPOSE: Fashion Intelligence - Dead Stock and Slow-Moving Item detection.
# DATA FLOW: Takes stock levels and sales velocity -> returns risk flags and recommendations.
# EXTENSION POINTS: Add age-of-stock (warehouse entry date) filters, or markdown triggers.
# EDUCATIONAL COMMENTS:
# - Dead stock eats up working capital and warehouse space.
# - Items with zero sales over 90 days or days-of-supply exceeding 180 days are flagged.
# ==============================================================================

import logging

logger = logging.getLogger("eve.fashion.dead_stock")


def detect_dead_stock(
    stock_on_hand: int,
    avg_daily_sales: float,
    threshold_days: int = 30
) -> bool:
    """
    Flags whether a product is dead stock based on active quantity and sales rate.
    """
    if stock_on_hand <= 0:
        return False
        
    if avg_daily_sales <= 0.001:
        return True
        
    # Calculate days of supply
    days_of_supply = stock_on_hand / avg_daily_sales
    return days_of_supply >= threshold_days
