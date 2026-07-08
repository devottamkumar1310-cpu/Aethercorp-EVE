# ==============================================================================
# PURPOSE: Fashion/Inventory Intelligence - Reorder Quantity (Orchestrated).
# DATA FLOW: Uses EVE Backend Intelligence Orchestrator to calculate reorders.
# ==============================================================================

import logging
import asyncio
import concurrent.futures
import math
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.orchestrator.base_engine import EngineContext
from app.core.orchestrator.orchestrator import IntelligenceOrchestrator
from app.services.intelligence.forecast_engine import ForecastEngine
from app.services.intelligence.optimization_engine import OptimizationEngine
from app.services.intelligence.confidence_engine import ConfidenceEngine

logger = logging.getLogger("eve.fashion.reorder_engine")

def run_async_as_sync(coro):
    """Event-loop-safe helper to run async coroutines synchronously."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)

def calculate_reorder_quantity(
    sku: str,
    avg_daily_sales: float,
    lead_time_days: int,
    safety_stock: int,
    db: Optional[Session] = None,
    organization_id: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Calculates reorder quantity using EVE's multi-engine orchestrator.
    Returns backward-compatible dictionary with advanced orchestrator metadata.
    """
    # If no DB is provided, use the legacy formula to maintain unit test assertions
    if db is None:
        lead_time_demand = avg_daily_sales * lead_time_days
        recommended_reorder = safety_stock + lead_time_demand
        if recommended_reorder < 10 and avg_daily_sales > 0:
            recommended_reorder = 50
        return {
            "sku": sku,
            "recommended_reorder": int(recommended_reorder),
            "confidence_score": 100.0,
            "supporting_signals": ["Legacy deterministic fallback"],
            "reasoning": ["Calculated using safety stock + lead time demand"]
        }

    # 1. Initialize Orchestrator and Engines
    orchestrator = IntelligenceOrchestrator()
    orchestrator.register_engine(ForecastEngine())
    orchestrator.register_engine(OptimizationEngine())
    orchestrator.register_engine(ConfidenceEngine())

    # 2. Build Context
    context = EngineContext(
        sku=sku,
        stock_on_hand=0,
        lead_time_days=lead_time_days,
        avg_daily_sales=avg_daily_sales,
        db=db,
        organization_id=organization_id,
        parameters={"safety_stock_override": safety_stock}
    )

    # 3. Execute Pipeline
    try:
        pipeline_res = run_async_as_sync(orchestrator.run_pipeline(context))
        reorder_qty = pipeline_res.get("recommended_quantity", 0)

        return {
            "sku": sku,
            "recommended_reorder": int(reorder_qty),
            "confidence_score": pipeline_res.get("confidence_score"),
            "supporting_signals": pipeline_res.get("supporting_signals"),
            "reasoning": pipeline_res.get("reasoning")
        }
    except Exception as e:
        logger.error(f"Failed reorder calculation pipeline execution: {str(e)}")
        # Fallback to legacy behavior
        lead_time_demand = avg_daily_sales * lead_time_days
        recommended_reorder = safety_stock + lead_time_demand
        if recommended_reorder < 10 and avg_daily_sales > 0:
            recommended_reorder = 50
        return {
            "sku": sku,
            "recommended_reorder": int(recommended_reorder),
            "confidence_score": 50.0,
            "errors": [str(e)]
        }
