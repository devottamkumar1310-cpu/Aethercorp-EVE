# ==============================================================================
# PURPOSE: Fashion Intelligence - Inventory Turnover Ratio calculations.
# DATA FLOW: COGS and inventory values flow in -> turnover ratio flows out.
# EXTENSION POINTS: Add seasonal adjustments or category-level aggregates.
# EDUCATIONAL COMMENTS:
# - Inventory Turnover = Cost of Goods Sold (COGS) / Average Inventory Value
# - High turnover ratios (e.g., 4.0 - 6.0 in apparel) indicate efficient logistics.
# - Low turnover indicates excess inventory or slow sales.
# ==============================================================================

import logging

logger = logging.getLogger("eve.fashion.inventory_turnover")


def calculate_inventory_turnover(
    cost_of_goods_sold: float,
    average_inventory_value: float
) -> float:
    """
    Computes the inventory turnover ratio.
    """
    if average_inventory_value <= 0:
        return 0.0
    
    turnover = cost_of_goods_sold / average_inventory_value
    return round(turnover, 2)
