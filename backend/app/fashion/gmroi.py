# ==============================================================================
# PURPOSE: Fashion Intelligence - GMROI (Gross Margin Return on Inventory Investment).
# DATA FLOW: Gross margin dollar value and average inventory cost -> GMROI ratio.
# EXTENSION POINTS: Multi-tier margin calculations or markdown deduction overlays.
# EDUCATIONAL COMMENTS:
# - GMROI = Gross Margin Dollars / Average Inventory Cost
# - Represents how many dollars of gross profit are made for every dollar invested in stock.
# - A GMROI > 1.5 is generally solid for fashion retail, indicating positive return.
# ==============================================================================

import logging

logger = logging.getLogger("eve.fashion.gmroi")


def calculate_gmroi(
    gross_margin_dollars: float,
    average_inventory_cost: float
) -> float:
    """
    Computes Gross Margin Return on Investment.
    """
    if average_inventory_cost <= 0:
        return 0.0
        
    gmroi_ratio = gross_margin_dollars / average_inventory_cost
    return round(gmroi_ratio, 2)
