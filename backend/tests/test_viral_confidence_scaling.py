import pytest
import math
import asyncio
from app.services.intelligence.optimization_engine import OptimizationEngine
from app.core.orchestrator.base_engine import EngineContext

def test_confidence_adjusted_forecast():
    async def run_test():
        # Simulate OptimizationEngine receiving a context from ForecastEngine
        engine = OptimizationEngine()
        
        # 3-day viral trend. Confidence = 3/14 = 0.21428...
        # Baseline = 10, Viral Forecast = 331.0
        context = EngineContext(
            sku="TEST_VIRAL_CONFIDENCE",
            stock_on_hand=50,
            lead_time_days=14,
            avg_daily_sales=10.0,
            parameters={
                "forecast_value": 331.0,
                "trend_duration_days": 3,
                "baseline_demand": 10.0
            }
        )
        
        # Run the engine
        result = await engine.execute(context)
        
        data = result.data
        
        assert "trend_confidence" in data
        assert "adjusted_forecast" in data
        
        conf = data["trend_confidence"]
        adj_fcst = data["adjusted_forecast"]
        
        # Should be roughly 0.214
        assert math.isclose(conf, 3/14, rel_tol=1e-2)
        # Should be roughly 78.78
        assert math.isclose(adj_fcst, 78.78, rel_tol=1e-2)
        
        # Test 14+ day trend
        context_confirmed = EngineContext(
            sku="TEST_VIRAL_CONFIRMED",
            stock_on_hand=50,
            lead_time_days=14,
            avg_daily_sales=10.0,
            parameters={
                "forecast_value": 331.0,
                "trend_duration_days": 15,
                "baseline_demand": 10.0
            }
        )
        
        res_confirmed = await engine.execute(context_confirmed)
        data_conf = res_confirmed.data
        
        assert data_conf["trend_confidence"] == 1.0
        assert data_conf["adjusted_forecast"] == 331.0

    asyncio.run(run_test())
