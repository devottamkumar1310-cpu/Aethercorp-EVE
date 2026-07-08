# ==============================================================================
# PURPOSE: Fashion/Inventory Intelligence - Stockout Prediction (Orchestrated).
# DATA FLOW: Uses EVE Backend Intelligence Orchestrator to predict stockout risk.
# ==============================================================================

import logging
import asyncio
import concurrent.futures
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.orchestrator.base_engine import EngineContext
from app.core.orchestrator.orchestrator import IntelligenceOrchestrator
from app.services.intelligence.forecast_engine import ForecastEngine
from app.services.intelligence.optimization_engine import OptimizationEngine
from app.services.intelligence.confidence_engine import ConfidenceEngine

logger = logging.getLogger("eve.fashion.stockout_prediction")

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

def predict_stockout(
    sku: str,
    stock_on_hand: int,
    avg_daily_sales: float,
    db: Optional[Session] = None,
    organization_id: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Predicts stockout timeline using EVE's multi-engine orchestrator.
    Returns backward-compatible dictionary with advanced orchestrator metadata.
    """
    # 1. Initialize Orchestrator and Engines
    orchestrator = IntelligenceOrchestrator()
    orchestrator.register_engine(ForecastEngine())
    orchestrator.register_engine(OptimizationEngine())
    orchestrator.register_engine(ConfidenceEngine())

    # 2. Build Context
    context = EngineContext(
        sku=sku,
        stock_on_hand=stock_on_hand,
        lead_time_days=14, # default
        avg_daily_sales=avg_daily_sales,
        db=db,
        organization_id=organization_id
    )

    # 3. Execute Pipeline
    try:
        pipeline_res = run_async_as_sync(orchestrator.run_pipeline(context))
        
        # Pull forecast values
        forecast_out = pipeline_res.get("engine_outputs", {}).get("forecast_engine", {})
        forecast_val = forecast_out.get("data", {}).get("forecast_value", avg_daily_sales)
        
        # 4. Calculate days until stockout
        if forecast_val <= 0.001:
            days_until_stockout = 999.0
        else:
            days_until_stockout = max(0.0, float(stock_on_hand) / forecast_val)

        return {
            "sku": sku,
            "days_until_stockout": round(days_until_stockout, 1),
            "confidence_score": pipeline_res.get("confidence_score"),
            "supporting_signals": pipeline_res.get("supporting_signals"),
            "reasoning": pipeline_res.get("reasoning"),
            "recommendation": pipeline_res.get("recommendation")
        }
    except Exception as e:
        logger.error(f"Failed stockout prediction pipeline execution: {str(e)}")
        # Fallback to legacy behavior
        if avg_daily_sales <= 0.001:
            days_until_stockout = 999.0
        else:
            days_until_stockout = max(0.0, float(stock_on_hand) / avg_daily_sales)
        return {
            "sku": sku,
            "days_until_stockout": round(days_until_stockout, 1),
            "confidence_score": 50.0,
            "errors": [str(e)]
        }
