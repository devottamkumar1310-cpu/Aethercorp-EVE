# ==============================================================================
# PURPOSE: Fashion Intelligence - Size Curve Analysis.
# DATA FLOW: Current manufacturing size curve and actual sales by size -> recommended size curve.
# EXTENSION POINTS: Add numeric waist sizes or shoe sizing curves.
# EDUCATIONAL COMMENTS:
# - A size curve represents the ratios (percentage) of stock to produce per size (e.g. S, M, L).
# - Producing the wrong ratio results in stockouts of popular sizes and markdown dead stock in others.
# ==============================================================================

import logging
from typing import Dict, Any

logger = logging.getLogger("eve.fashion.size_curve")


def analyze_size_curve_deviation(
    current_curve: Dict[str, float],
    sales_by_size: Dict[str, int]
) -> Dict[str, Any]:
    """
    Compares the current production size curve against actual sales density.
    Returns recommendations for future purchase orders.
    """
    total_sales = sum(sales_by_size.values())
    if total_sales <= 0:
        return {
            "deviation_detected": False,
            "recommended_curve": current_curve,
            "reasons": "No sales data available to compute deviation."
        }

    # Calculate actual sales distribution curve
    sales_curve = {size: count / total_sales for size, count in sales_by_size.items()}
    
    # Calculate absolute differences/deviations
    deviations = {}
    total_dev = 0.0
    for size, target_pct in current_curve.items():
        actual_pct = sales_curve.get(size, 0.0)
        dev = actual_pct - target_pct
        deviations[size] = round(dev, 3)
        total_dev += abs(dev)
        
    # Standard threshold: if cumulative deviation exceeds 10%, recommend adjustment
    deviation_detected = total_dev >= 0.10
    
    # Recommended curve is a blend of current target and actual sales curve (70% actual, 30% target)
    recommended_curve = {}
    for size in current_curve.keys():
        actual = sales_curve.get(size, current_curve[size])
        blended = (0.7 * actual) + (0.3 * current_curve[size])
        recommended_curve[size] = round(blended, 3)

    # Normalize recommended curve to sum to 1.0
    total_recommended = sum(recommended_curve.values())
    if total_recommended > 0:
        recommended_curve = {size: round(val / total_recommended, 3) for size, val in recommended_curve.items()}

    return {
        "deviation_detected": deviation_detected,
        "current_curve": current_curve,
        "actual_sales_curve": {k: round(v, 3) for k, v in sales_curve.items()},
        "deviations": deviations,
        "recommended_curve": recommended_curve,
        "recommendation_text": (
            "Adjust size run ratios: produce more "
            f"{', '.join([sz for sz, dev in deviations.items() if dev > 0.02])}."
            if deviation_detected else "Current size production curves align with demand."
        )
    }
