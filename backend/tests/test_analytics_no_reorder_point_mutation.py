# ==============================================================================
# PURPOSE: Regression test for a release blocker — AnalyticsService.get_inventory_analysis
#          used to silently overwrite InventoryItem.reorder_point / .safety_stock with its
#          own forecasting formula and commit it, on every AI chat call or daily brief.
#          Those two fields are the founder-configured thresholds that
#          /api/inventory/alerts (the canonical source Dashboard, Inventory Intelligence,
#          and Finance all read) uses to decide what counts as "low stock" — so simply
#          asking EVE a question could silently change those numbers elsewhere in the app.
#          This locks in that the write-back is gone while the function's own read-only
#          analysis still works.
# ==============================================================================

import uuid
from unittest.mock import MagicMock
from app.services.analytics_service import AnalyticsService


def _fake_pipeline_results():
    return [{
        "confidence_score": 90,
        "recommended_quantity": 40,
        "priority_score": 70,
        "inventory_class": "STOCKOUT",
        "abc_class": "A",
        "revenue_at_risk": 300.0,
        "margin_at_risk": 150.0,
        "working_capital_locked": 0.0,
        "engine_outputs": {
            "forecast_engine": {"data": {"forecast_value": 4.0}},
            # The orchestrator's own formula would compute reorder_point = 4.0 * 14 * 1.5 = 84,
            # far above the founder-configured value seeded on the item below (30).
            "optimization_engine": {"data": {"safety_stock": 28, "reorder_point": 84}},
        },
    }]


def test_get_inventory_analysis_does_not_overwrite_founder_configured_thresholds():
    class MockProduct:
        def __init__(self):
            self.id = uuid.uuid4()
            self.sku = "SKU-GUARD-1"
            self.parent_product_id = None
            self.name = "Guarded Widget"
            self.selling_price = 60.0
            self.unit_cost = 25.0
            self.category = "Test"

    class MockInventoryItem:
        def __init__(self, product):
            self.product = product
            self.stock_on_hand = 10
            self.lead_time_days = 14
            # Sentinel distinct from whatever the (empty, mocked) sales query resolves
            # to — used only to prove the avg_daily_sales write actually still runs.
            self.avg_daily_sales = 999.0
            # Founder/seed-configured thresholds — must survive the call untouched.
            self.reorder_point = 30
            self.safety_stock = 12

    product = MockProduct()
    item = MockInventoryItem(product)
    org_id = uuid.uuid4()
    mock_db = MagicMock()

    import app.services.analytics_service as target_module
    original_run = target_module.run_async_as_sync
    target_module.run_async_as_sync = lambda *a, **k: _fake_pipeline_results()

    def db_query_side_effect(*args):
        mock_q = MagicMock()
        if len(args) == 1 and getattr(args[0], "__name__", None) == "InventoryItem":
            mock_q.options.return_value.filter.return_value.all.return_value = [item]
        else:
            mock_q.filter.return_value.filter.return_value.group_by.return_value.all.return_value = []
            mock_q.join.return_value.filter.return_value.group_by.return_value.all.return_value = []
            mock_q.filter.return_value.order_by.return_value.all.return_value = []
        return mock_q

    mock_db.query.side_effect = db_query_side_effect

    try:
        from app.services.data_quality_service import DataQualityService
        DataQualityService.check_and_block_if_corrupted = MagicMock()

        AnalyticsService.get_inventory_analysis(mock_db, org_id)

        # The regression: these must be untouched by the call, even though the
        # orchestrator internally computed different values (84 / 28) for its own
        # analysis. Only the canonical alerts endpoint's stored values should govern
        # what /api/inventory/alerts (and therefore the whole app) treats as "low stock".
        assert item.reorder_point == 30, "reorder_point must not be silently rewritten by analytics"
        assert item.safety_stock == 12, "safety_stock must not be silently rewritten by analytics"

        # Recording the observed sales velocity is fine — that's metadata, not a
        # founder-set threshold. Confirms the fix removed only the two lines it
        # should have, not the whole write-back block.
        assert item.avg_daily_sales != 999.0
    finally:
        target_module.run_async_as_sync = original_run
