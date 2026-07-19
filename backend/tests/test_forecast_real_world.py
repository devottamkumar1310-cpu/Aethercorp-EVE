import uuid
import asyncio
from unittest.mock import MagicMock
from app.services.intelligence.forecast_engine import ForecastEngine
from app.core.orchestrator.base_engine import EngineContext

def test_forecast_handles_returns_and_outliers():
    async def run_test():
        # Setup mock data mimicking the UCI Retail Dataset
        # 5 normal days (10 units), 1 return day (-5 units), 1 bulk B2B order (1000 units), 3 normal days (12 units)
        # Total 10 days. 
        # Returns should be floored to 0.
        # The 1000 unit spike should be smoothed by IQR.
        
        # Raw series: 10, 10, 10, 10, 10, -5, 1000, 12, 12, 12
        # Floored: 10, 10, 10, 10, 10, 0, 1000, 12, 12, 12
        # Sorted: 0, 10, 10, 10, 10, 10, 12, 12, 12, 1000
        # Q1 (idx 2) = 10
        # Q3 (idx 7) = 12
        # IQR = 2
        # Upper fence = 12 + (1.5 * 2) = 15
        # So the 1000 should be capped at 15.
        # Resulting series passed to forecast: 10, 10, 10, 10, 10, 0, 15, 12, 12, 12
        
        engine = ForecastEngine()
        
        # We will mock the db query to return this data
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        
        # Mocking Product query
        mock_product = MagicMock()
        mock_product.id = uuid.uuid4()
        mock_query.filter.return_value.first.return_value = mock_product
        
        # Mocking SalesRecord query
        from datetime import date, timedelta
        start_date = date(2026, 1, 1)
        
        mock_records = [
            (start_date + timedelta(days=0), 10),
            (start_date + timedelta(days=1), 10),
            (start_date + timedelta(days=2), 10),
            (start_date + timedelta(days=3), 10),
            (start_date + timedelta(days=4), 10),
            (start_date + timedelta(days=5), -5),
            (start_date + timedelta(days=6), 1000),
            (start_date + timedelta(days=7), 12),
            (start_date + timedelta(days=8), 12),
            (start_date + timedelta(days=9), 12),
        ]
        
        # Needs to handle .filter().order_by().all() chaining
        mock_filter = MagicMock()
        mock_order_by = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.order_by.return_value = mock_order_by
        
        def query_side_effect(*args):
            mock_q = MagicMock()
            if len(args) == 1 and args[0].__name__ == "Product":
                mock_q.filter.return_value.first.return_value = mock_product
            else:
                mock_q.filter.return_value.order_by.return_value.all.return_value = mock_records
            return mock_q
            
        mock_db.query.side_effect = query_side_effect
        
        context = EngineContext(
            sku="TEST_SHIRT",
            stock_on_hand=50,
            lead_time_days=14,
            avg_daily_sales=10.0,
            db=mock_db,
            organization_id=uuid.uuid4(),
            parameters={}
        )
        
        result = await engine.execute(context)
        
        assert result.success is True
        
        # The max demand should be the smoothed max (15.0)
        assert result.data["supporting_metrics"]["max_demand"] == 15.0
        
        # The min demand should be 0 (the floored -5)
        assert result.data["supporting_metrics"]["min_demand"] == 0.0

    asyncio.run(run_test())

def test_forecast_viral_trend_bypass():
    async def run_test():
        # Setup mock data simulating a viral trend (e.g. TikTok spike)
        # Normal baseline ~10, suddenly spikes to 500 for 3 consecutive days.
        # It should bypass IQR capping.
        
        engine = ForecastEngine()
        
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        
        mock_product = MagicMock()
        mock_product.id = uuid.uuid4()
        mock_query.filter.return_value.first.return_value = mock_product
        
        from datetime import date, timedelta
        start_date = date(2026, 1, 1)
        
        # 7 days of 10, then 3 days of 500
        mock_records = [
            (start_date + timedelta(days=0), 10),
            (start_date + timedelta(days=1), 10),
            (start_date + timedelta(days=2), 10),
            (start_date + timedelta(days=3), 10),
            (start_date + timedelta(days=4), 10),
            (start_date + timedelta(days=5), 10),
            (start_date + timedelta(days=6), 10),
            (start_date + timedelta(days=7), 500),
            (start_date + timedelta(days=8), 500),
            (start_date + timedelta(days=9), 500),
        ]
        
        def query_side_effect(*args):
            mock_q = MagicMock()
            if len(args) == 1 and args[0].__name__ == "Product":
                mock_q.filter.return_value.first.return_value = mock_product
            else:
                mock_q.filter.return_value.order_by.return_value.all.return_value = mock_records
            return mock_q
            
        mock_db.query.side_effect = query_side_effect
        
        context = EngineContext(
            sku="TEST_VIRAL",
            stock_on_hand=50,
            lead_time_days=14,
            avg_daily_sales=10.0,
            db=mock_db,
            organization_id=uuid.uuid4(),
            parameters={}
        )
        
        result = await engine.execute(context)
        
        assert result.success is True
        
        # The max demand should remain 500 (bypassed IQR capping)
        assert result.data["supporting_metrics"]["max_demand"] == 500.0

    asyncio.run(run_test())
