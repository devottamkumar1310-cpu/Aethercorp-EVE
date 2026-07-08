import pytest
from app.core.orchestrator.base_engine import EngineContext
from app.core.orchestrator.orchestrator import IntelligenceOrchestrator
from app.services.intelligence.forecast_engine import ForecastEngine
from app.services.intelligence.optimization_engine import OptimizationEngine
from app.services.intelligence.confidence_engine import ConfidenceEngine
from app.services.intelligence.classification_engine import ClassificationEngine
from app.services.intelligence.anomaly_engine import AnomalyEngine
from app.services.intelligence.financial_engine import FinancialEngine
from app.services.intelligence.business_health_engine import BusinessHealthEngine
from app.services.intelligence.action_engine import ActionEngine
from app.services.intelligence.executive_summary_engine import ExecutiveSummaryEngine
from app.core.orchestrator.synthesizer import RecommendationSynthesizer
from app.fashion.stockout_prediction import predict_stockout
from app.fashion.reorder_engine import calculate_reorder_quantity

@pytest.mark.anyio
async def test_forecast_engine_weighted_moving_average():
    sales = [10.0, 10.0, 10.0]
    res = ForecastEngine.weighted_moving_average(sales, window=3)
    assert res == 10.0

@pytest.mark.anyio
async def test_forecast_engine_exponential_smoothing():
    sales = [10.0, 10.0, 10.0]
    res = ForecastEngine.exponential_smoothing(sales, alpha=0.3)
    assert res == 10.0

@pytest.mark.anyio
async def test_forecast_engine_croston_method():
    sales = [0.0, 0.0, 10.0, 0.0, 0.0, 10.0]
    res = ForecastEngine.croston_method(sales, alpha=0.1)
    assert round(res, 2) == 3.33

@pytest.mark.anyio
async def test_forecast_engine_selection_rules():
    engine = ForecastEngine()
    
    # 1. Very small dataset (<5) should choose WMA
    context_wma = EngineContext(
        sku="SKU_WMA", 
        avg_daily_sales=5.0, 
        parameters={"sales_series_override": [10.0, 12.0, 11.0]}
    )
    res_wma = await engine.execute(context_wma)
    assert res_wma.success == True
    assert res_wma.data["selected_model"] == "weighted_moving_average"

    # 2. Continuous demand (zeros < 0.3) should choose Exponential Smoothing
    context_es = EngineContext(
        sku="SKU_ES", 
        avg_daily_sales=12.0,
        parameters={"sales_series_override": [10.0, 12.0, 11.0, 14.0, 13.0, 12.0]}
    )
    res_es = await engine.execute(context_es)
    assert res_es.success == True
    assert res_es.data["selected_model"] == "exponential_smoothing"

    # 3. Intermittent demand (zeros >= 0.3) should choose Croston
    context_croston = EngineContext(
        sku="SKU_CROS",
        avg_daily_sales=3.0,
        parameters={"sales_series_override": [0.0, 0.0, 10.0, 0.0, 0.0, 10.0]}
    )
    res_croston = await engine.execute(context_croston)
    assert res_croston.success == True
    assert res_croston.data["selected_model"] == "croston"

@pytest.mark.anyio
async def test_optimization_engine():
    engine = OptimizationEngine()
    context = EngineContext(sku="SKU_OPT", avg_daily_sales=10.0, lead_time_days=10)
    res = await engine.execute(context)
    assert res.success == True
    assert "reorder_quantity" in res.data
    assert "safety_stock" in res.data
    assert "reorder_point" in res.data
    assert res.data["reorder_point"] > 0

@pytest.mark.anyio
async def test_confidence_engine():
    engine = ConfidenceEngine()
    context = EngineContext(sku="SKU_CONF", avg_daily_sales=10.0)
    res = await engine.execute(context)
    assert res.success == True
    assert "confidence_score" in res.data
    assert "data_quality" in res.data
    assert "confidence_factors" in res.data
    assert 0.10 <= res.data["confidence_score"] <= 1.00

@pytest.mark.anyio
async def test_orchestrator_pipeline():
    orchestrator = IntelligenceOrchestrator()
    orchestrator.register_engine(ForecastEngine())
    orchestrator.register_engine(OptimizationEngine())
    orchestrator.register_engine(ConfidenceEngine())

    context = EngineContext(sku="SKU_PIPELINE", avg_daily_sales=10.0, stock_on_hand=5)
    pipeline_res = await orchestrator.run_pipeline(context)

    assert "recommendation" in pipeline_res
    assert "recommended_quantity" in pipeline_res
    assert "confidence_score" in pipeline_res
    assert "reasoning" in pipeline_res
    assert "supporting_signals" in pipeline_res
    assert "engine_outputs" in pipeline_res

def test_legacy_stockout_prediction_compatibility():
    # 100 items / 10 a day = 10 days
    res = predict_stockout("SKU001", 100, 10.0)
    assert res["sku"] == "SKU001"
    assert res["days_until_stockout"] == 10.0
    assert "confidence_score" in res
    assert "supporting_signals" in res

def test_legacy_reorder_quantity_compatibility():
    # Safety stock (50) + Lead time demand (10 * 14) = 50 + 140 = 190
    res = calculate_reorder_quantity("SKU001", 10.0, 14, 50)
    assert res["sku"] == "SKU001"
    assert res["recommended_reorder"] == 190
    assert "confidence_score" in res

@pytest.mark.anyio
async def test_classification_engine():
    engine = ClassificationEngine()
    context = EngineContext(
        sku="SKU_CLASS", 
        avg_daily_sales=5.0, 
        stock_on_hand=10,
        lead_time_days=10,
        parameters={
            "sales_series_override": [10.0] * 30,
            "abc_classifications": {"SKU_CLASS": "A"}
        }
    )
    res = await engine.execute(context)
    assert res.success == True
    assert res.data["inventory_class"] in ["HEALTHY", "SLOW_MOVING", "AT_RISK", "DEAD_STOCK"]
    assert res.data["abc_class"] == "A"
    assert res.data["rfm_score"] > 0

@pytest.mark.anyio
async def test_anomaly_engine():
    engine = AnomalyEngine()
    
    # Test surge
    context_surge = EngineContext(
        sku="SKU_SURGE",
        avg_daily_sales=2.0,
        parameters={"sales_series_override": [2.0]*20 + [15.0]*3}
    )
    res_surge = await engine.execute(context_surge)
    assert res_surge.success == True
    assert any(a["type"] == "DEMAND_SURGE" for a in res_surge.data["anomalies"])
    assert res_surge.data["severity"] in ["LOW", "MEDIUM", "HIGH"]

@pytest.mark.anyio
async def test_financial_engine():
    engine = FinancialEngine()
    context = EngineContext(
        sku="SKU_FIN", 
        avg_daily_sales=2.0, 
        stock_on_hand=50,
        lead_time_days=10,
        parameters={"unit_cost_override": 10.0}
    )
    res = await engine.execute(context)
    assert res.success == True
    assert res.data["working_capital_locked"] == 500.0
    assert res.data["revenue_at_risk"] > 0.0

@pytest.mark.anyio
async def test_business_health_engine():
    from app.services.intelligence.business_health_engine import BusinessHealthEngine
    engine = BusinessHealthEngine()
    
    # Test batch parameters (healthy ratio 100%, 0 risk, 0 dead capital, 0 anomalies)
    context = EngineContext(
        sku="TEST_HEALTH",
        avg_daily_sales=0.0,
        parameters={
            "catalog_total_skus": 10,
            "catalog_healthy_skus": 10,
            "catalog_avg_stockout_risk": 0.0,
            "catalog_dead_capital": 0.0,
            "catalog_total_capital": 1000.0,
            "catalog_anomalous_skus": 0
        }
    )
    res = await engine.execute(context)
    assert res.success == True
    assert res.data["health_score"] == 100
    assert res.data["health_grade"] == "A"

@pytest.mark.anyio
async def test_action_engine():
    from app.services.intelligence.action_engine import ActionEngine
    engine = ActionEngine()
    context = EngineContext(
        sku="SKU_ALERT",
        avg_daily_sales=5.0,
        parameters={
            "inventory_class": "AT_RISK",
            "stockout_risk_score": 85.0
        }
    )
    res = await engine.execute(context)
    assert res.success == True
    assert any("Reorder SKU_ALERT" in action for action in res.data["actions"])

@pytest.mark.anyio
async def test_executive_summary_engine():
    from app.services.intelligence.executive_summary_engine import ExecutiveSummaryEngine
    engine = ExecutiveSummaryEngine()
    context = EngineContext(
        sku="SKU_RISK",
        avg_daily_sales=5.0,
        parameters={
            "priority_score": 90,
            "inventory_class": "AT_RISK",
            "revenue_at_risk": 1500.0
        }
    )
    res = await engine.execute(context)
    assert res.success == True
    assert res.data["risk"] is not None
    assert res.data["risk"]["sku"] == "SKU_RISK"
    assert res.data["risk"]["impact"] == 1500.0

@pytest.mark.anyio
async def test_orchestrator_pipeline_phase3():
    orchestrator = IntelligenceOrchestrator()
    orchestrator.register_engine(ForecastEngine())
    orchestrator.register_engine(OptimizationEngine())
    orchestrator.register_engine(ConfidenceEngine())
    orchestrator.register_engine(ClassificationEngine())
    orchestrator.register_engine(AnomalyEngine())
    orchestrator.register_engine(FinancialEngine())
    orchestrator.register_engine(ActionEngine())
    orchestrator.register_engine(ExecutiveSummaryEngine())

    context = EngineContext(
        sku="SKU_PHASE3", 
        avg_daily_sales=5.0, 
        stock_on_hand=2,
        lead_time_days=14,
        parameters={
            "sales_series_override": [5.0] * 30,
            "abc_classifications": {"SKU_PHASE3": "A"}
        }
    )
    pipeline_res = await orchestrator.run_pipeline(context)
    
    assert "priority_score" in pipeline_res
    assert "inventory_class" in pipeline_res
    assert "abc_class" in pipeline_res
    assert "revenue_at_risk" in pipeline_res
    assert "working_capital_locked" in pipeline_res
    assert "actions" in pipeline_res
    assert "opportunities" in pipeline_res
    assert 0 <= pipeline_res["priority_score"] <= 100

