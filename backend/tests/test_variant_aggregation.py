import uuid
from unittest.mock import MagicMock
from app.services.analytics_service import AnalyticsService

def test_variant_aggregation():
    # Setup 3 size variants for a single shirt
    parent_id = "SHIRT_MASTER"
    
    # Mocks
    mock_db = MagicMock()
    org_id = uuid.uuid4()
    
    class MockProduct:
        def __init__(self, sku, parent_id, name):
            self.id = uuid.uuid4()
            self.sku = sku
            self.parent_product_id = parent_id
            self.name = name
            self.selling_price = 40.0
            self.unit_cost = 20.0
            self.category = "Tops"
            
    class MockInventoryItem:
        def __init__(self, product, soh):
            self.product = product
            self.stock_on_hand = soh
            self.lead_time_days = 14
            self.avg_daily_sales = 5.0
            
    p1 = MockProduct("SHIRT-S", parent_id, "Cool Shirt - S")
    p2 = MockProduct("SHIRT-M", parent_id, "Cool Shirt - M")
    p3 = MockProduct("SHIRT-L", parent_id, "Cool Shirt - L")
    
    items = [
        MockInventoryItem(p1, 0), # Out of stock
        MockInventoryItem(p2, 2), # Low stock
        MockInventoryItem(p3, 0), # Out of stock
    ]
    
    # We will override the complex DB methods by patching or just running it through if possible.
    # Actually, mocking the entire get_inventory_analysis flow is hard due to all DB queries.
    # Let's test the aggregation logic directly if it was exposed, 
    # but since it's inline in get_inventory_analysis, we can mock the queries.
    
    # Instead of a full integration test, we can mock run_async_as_sync and the batch results
    # and focus on testing the post-processing Variant Aggregation block.
    
    import app.services.analytics_service as target_module
    original_run = target_module.run_async_as_sync
    
    def fake_run(*args, **kwargs):
        # Return 3 mock pipeline results
        return [
            {
                "confidence_score": 90,
                "recommended_quantity": 20,
                "priority_score": 80,
                "inventory_class": "STOCKOUT",
                "abc_class": "A",
                "revenue_at_risk": 500.0,
                "margin_at_risk": 250.0,
                "working_capital_locked": 0.0,
                "risk": {"priority": 80, "impact": 500},
                "engine_outputs": {
                    "forecast_engine": {"data": {"forecast_value": 5.0}},
                    "optimization_engine": {"data": {"safety_stock": 10, "reorder_point": 80}}
                }
            },
            {
                "confidence_score": 90,
                "recommended_quantity": 30,
                "priority_score": 60,
                "inventory_class": "HEALTHY",
                "abc_class": "A",
                "revenue_at_risk": 100.0,
                "margin_at_risk": 50.0,
                "working_capital_locked": 40.0,
                "engine_outputs": {
                    "forecast_engine": {"data": {"forecast_value": 5.0}},
                    "optimization_engine": {"data": {"safety_stock": 10, "reorder_point": 80}}
                }
            },
            {
                "confidence_score": 90,
                "recommended_quantity": 25,
                "priority_score": 70,
                "inventory_class": "STOCKOUT",
                "abc_class": "A",
                "revenue_at_risk": 400.0,
                "margin_at_risk": 200.0,
                "working_capital_locked": 0.0,
                "engine_outputs": {
                    "forecast_engine": {"data": {"forecast_value": 5.0}},
                    "optimization_engine": {"data": {"safety_stock": 10, "reorder_point": 80}}
                }
            }
        ]
        
    target_module.run_async_as_sync = fake_run
    
    # Mocking db queries
    def db_query_side_effect(*args):
        mock_q = MagicMock()
        if len(args) == 1 and args[0].__name__ == "InventoryItem":
            mock_q.options.return_value.filter.return_value.all.return_value = items
        else:
            mock_q.filter.return_value.filter.return_value.group_by.return_value.all.return_value = []
            mock_q.join.return_value.filter.return_value.group_by.return_value.all.return_value = []
            mock_q.filter.return_value.order_by.return_value.all.return_value = []
        return mock_q
        
    mock_db.query.side_effect = db_query_side_effect
    
    try:
        # Avoid crashing in DataQualityService
        from app.services.data_quality_service import DataQualityService
        DataQualityService.check_and_block_if_corrupted = MagicMock()
        
        result = AnalyticsService.get_inventory_analysis(mock_db, org_id)
        
        # Should be aggregated into exactly 1 item
        assert len(result["items_at_risk"]) == 1
        agg_item = result["items_at_risk"][0]
        
        assert agg_item["sku"] == parent_id
        assert agg_item["name"] == "Cool Shirt" # Suffix removed
        assert agg_item["reorder_quantity"] == 75 # 20 + 30 + 25
        assert agg_item["revenue_at_risk"] == 1000.0 # 500 + 100 + 400
        assert agg_item["stockout_risk_score"] == 100.0 # Max of the 3
        
    finally:
        target_module.run_async_as_sync = original_run
