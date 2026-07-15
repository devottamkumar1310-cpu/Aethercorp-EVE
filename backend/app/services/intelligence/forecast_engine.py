import logging
import uuid
from typing import List, Dict, Any, Optional
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.inventory import SalesRecord
from app.models.product import Product

logger = logging.getLogger("eve.intelligence.forecast_engine")

class ForecastEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "forecast_engine"

    @staticmethod
    def weighted_moving_average(sales: List[float], window: int = 3) -> float:
        """Weighted Moving Average favoring recent periods."""
        if not sales:
            return 0.0
        n = len(sales)
        actual_window = min(n, window)
        subset = sales[-actual_window:]
        
        weights = [float(i) for i in range(1, actual_window + 1)]
        total_weight = sum(weights)
        
        weighted_sum = sum(s * w for s, w in zip(subset, weights))
        return weighted_sum / total_weight

    @staticmethod
    def exponential_smoothing(sales: List[float], alpha: float = 0.3) -> float:
        """Standard Exponential Smoothing forecast for the next period."""
        if not sales:
            return 0.0
        forecast = sales[0]
        for s in sales[1:]:
            forecast = alpha * s + (1.0 - alpha) * forecast
        return forecast

    @staticmethod
    def croston_method(sales: List[float], alpha: float = 0.1) -> float:
        """Croston's Method for intermittent/sparse demand forecasting."""
        first_pos_idx = -1
        for idx, s in enumerate(sales):
            if s > 0:
                first_pos_idx = idx
                break
        
        if first_pos_idx == -1:
            return 0.0

        z = float(sales[first_pos_idx])  # Estimated demand level
        p = float(first_pos_idx + 1)     # Estimated demand interval
        q = 1                            # Periods since last positive demand

        for s in sales[first_pos_idx + 1:]:
            if s > 0:
                z = alpha * s + (1.0 - alpha) * z
                p = alpha * q + (1.0 - alpha) * p
                q = 1
            else:
                q += 1
        
        if p == 0:
            return 0.0
        return z / p

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            sales_series: List[float] = []
            
            # Check for direct parameter override (useful for tests)
            if "sales_series_override" in context.parameters:
                sales_series = [float(x) for x in context.parameters["sales_series_override"]]
            # 1. Retrieve data from database if session is provided
            elif context.db and context.organization_id:
                org_id = context.organization_id
                if isinstance(org_id, str):
                    org_id = uuid.UUID(org_id)
                
                # Fetch product
                product = context.db.query(Product).filter(
                    Product.organization_id == org_id,
                    Product.sku == context.sku
                ).first()
                
                if product:
                    # Query sales records ordered by date
                    records = context.db.query(SalesRecord.date, SalesRecord.quantity).filter(
                        SalesRecord.organization_id == org_id,
                        SalesRecord.product_id == product.id
                    ).order_by(SalesRecord.date.asc()).all()
                    
                    # 1. Aggregate by date and floor at 0 (Returns Handling)
                    daily_sales = {}
                    for date_val, qty in records:
                        if qty is None: continue
                        dt_str = date_val.strftime("%Y-%m-%d") if hasattr(date_val, "strftime") else str(date_val)
                        daily_sales[dt_str] = daily_sales.get(dt_str, 0.0) + float(qty)
                    
                    sorted_dates = sorted(daily_sales.keys())
                    raw_series = [max(0.0, daily_sales[dt]) for dt in sorted_dates]
                    
                    # 2. IQR Outlier Smoothing with Viral Trend Bypass
                    baseline_demand = 0.0
                    trend_duration_days = 0
                    if len(raw_series) >= 4:
                        sorted_vals = sorted(raw_series)
                        q1 = sorted_vals[len(sorted_vals) // 4]
                        q3 = sorted_vals[(len(sorted_vals) * 3) // 4]
                        iqr = q3 - q1
                        upper_fence = q3 + 1.5 * iqr
                        
                        baseline_demand = float(q3)
                        
                        # Calculate active trend at the end of the series
                        n_len = len(raw_series)
                        active_trend_days = 0
                        for i in range(n_len - 1, -1, -1):
                            if raw_series[i] > upper_fence:
                                active_trend_days += 1
                            else:
                                break
                        trend_duration_days = active_trend_days if active_trend_days >= 2 else 0
                        
                        sales_series = []
                        for i, val in enumerate(raw_series):
                            if val > upper_fence:
                                # Check adjacent chronological days for sustained trend
                                prev_is_high = (i > 0 and raw_series[i-1] > upper_fence)
                                next_is_high = (i < n_len - 1 and raw_series[i+1] > upper_fence)
                                
                                if prev_is_high or next_is_high:
                                    # It's part of a consecutive trend (viral/seasonal), DO NOT CAP
                                    sales_series.append(val)
                                else:
                                    # Isolated wholesale spike, CAP IT
                                    sales_series.append(upper_fence)
                            else:
                                sales_series.append(val)
                    else:
                        sales_series = raw_series
                        baseline_demand = context.avg_daily_sales or 0.0
                        trend_duration_days = 0

            # 2. Fallback to simulated data if database series is insufficient
            if not sales_series:
                if context.avg_daily_sales is None or context.avg_daily_sales == 0.0:
                    return EngineOutput(
                        engine_name=self.name,
                        success=False,
                        errors=["Insufficient sales data to generate forecast."],
                        confidence_weight=0.0
                    )
                # Reconstruct a basic historical sequence from context's avg_daily_sales
                daily_vel = context.avg_daily_sales
                # Generate a 10-period sequence
                sales_series = [daily_vel] * 10
            
            n = len(sales_series)
            zeros_ratio = sales_series.count(0.0) / n if n > 0 else 0.0
            
            # Selection Rules
            if n < 5:
                selected_model = "weighted_moving_average"
                forecast_val = self.weighted_moving_average(sales_series, window=3)
                confidence = 0.50
            elif zeros_ratio >= 0.3:
                selected_model = "croston"
                forecast_val = self.croston_method(sales_series, alpha=0.1)
                confidence = 0.85
            else:
                selected_model = "exponential_smoothing"
                forecast_val = self.exponential_smoothing(sales_series, alpha=0.3)
                confidence = 0.90

            # Compute supporting metrics
            supporting_metrics = {
                "dataset_length": n,
                "zeros_ratio": round(zeros_ratio, 2),
                "mean_demand": round(sum(sales_series) / n, 2) if n > 0 else 0.0,
                "max_demand": max(sales_series) if sales_series else 0.0,
                "min_demand": min(sales_series) if sales_series else 0.0,
                "baseline_demand": baseline_demand if 'baseline_demand' in locals() else (context.avg_daily_sales or 0.0),
                "trend_duration_days": trend_duration_days if 'trend_duration_days' in locals() else 0
            }

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "forecast_value": float(round(forecast_val, 3)),
                    "forecast_confidence": confidence,
                    "selected_model": selected_model,
                    "supporting_metrics": supporting_metrics
                },
                confidence_weight=confidence
            )
            
        except Exception as e:
            logger.error(f"Error in ForecastEngine: {str(e)}")
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)],
                confidence_weight=0.0
            )
