"""Canonical business-scenario identifier for workspaces.

This module is the SINGLE source of truth for a workspace's business narrative.
Services must read ``Organization.scenario_type`` (a value from ``ScenarioType``)
instead of parsing workspace names or slugs. Workspace names/slugs are presentation
only. Adding a future demo business is a matter of assigning it a scenario_type here
— no service code needs to change.

IMPORTANT: This is unrelated to the forecasting simulation's ``scenario_type``
(``price_change``, ``demand_growth``, ``cash_flow_forecast``, …), which is a
per-request what-if parameter of the simulation engine, not a workspace attribute.
"""
from typing import Optional


class ScenarioType:
    """Canonical, presentation-independent workspace business scenarios."""
    GROWTH = "GROWTH"          # healthy brand scaling fast; stockout risk on hero SKUs
    CASH_FLOW = "CASH_FLOW"    # working capital trapped in dead stock; recovery mode
    SEASONAL = "SEASONAL"      # caught between seasons; summer OOS + winter dead stock

    ALL = frozenset({GROWTH, CASH_FLOW, SEASONAL})


# Seed key (demo_company) -> canonical scenario_type.
DEMO_COMPANY_TO_SCENARIO = {
    "luma": ScenarioType.GROWTH,
    "drift": ScenarioType.CASH_FLOW,
    "basecamp": ScenarioType.SEASONAL,
}

# Canonical scenario_type -> AI strategic-focus directive. Describes the SCENARIO
# archetype, never a brand name, so it is reusable across any future business.
SCENARIO_STRATEGIC_FOCUS = {
    ScenarioType.GROWTH: (
        "Strategic Focus: Growth. This is a healthy premium brand growing fast. "
        "Focus on preventing stockouts on hero products, accelerating replenishment, "
        "and optimizing reorder points for the new demand curve."
    ),
    ScenarioType.CASH_FLOW: (
        "Strategic Focus: Cash-flow recovery. This brand has a dead-stock crisis from "
        "failed product drops. Focus on recovering locked working capital through "
        "markdowns, bundles, and liquidation while protecting the healthy core line."
    ),
    ScenarioType.SEASONAL: (
        "Strategic Focus: Seasonal transition. This brand is caught between seasons — "
        "summer stock is running out while winter carryover is dead. Focus on emergency "
        "summer replenishment funded by winter clearance."
    ),
}


def scenario_for_demo(demo_company: str) -> Optional[str]:
    """Map a seed/demo key to its canonical scenario_type (None if not a known demo)."""
    return DEMO_COMPANY_TO_SCENARIO.get(demo_company)


def strategic_focus(scenario_type: Optional[str]) -> Optional[str]:
    """Return the AI strategic-focus directive for a scenario_type (None if unknown)."""
    if not scenario_type:
        return None
    return SCENARIO_STRATEGIC_FOCUS.get(scenario_type)
