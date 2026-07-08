import logging
import uuid
from typing import List, Dict, Any, Optional
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.product import Product
from app.models.inventory import SalesRecord

logger = logging.getLogger("eve.intelligence.confidence_engine")

class ConfidenceEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "confidence_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            db = context.db
            org_id = context.organization_id
            sku = context.sku

            sales_series: List[float] = []
            
            # 1. Check for parameter override first
            if "sales_series_override" in context.parameters:
                sales_series = [float(x) for x in context.parameters["sales_series_override"]]
            # 2. Fetch data from DB
            elif db and org_id:
                if isinstance(org_id, str):
                    org_id = uuid.UUID(org_id)
                product = db.query(Product).filter(
                    Product.organization_id == org_id,
                    Product.sku == sku
                ).first()
                
                if product:
                    records = db.query(SalesRecord.quantity).filter(
                        SalesRecord.organization_id == org_id,
                        SalesRecord.product_id == product.id
                    ).order_by(SalesRecord.date.asc()).all()
                    sales_series = [float(r[0]) for r in records if r[0] is not None]

            # 2. Defaults if database is empty/not provided
            n = len(sales_series)
            if not sales_series:
                daily_vel = context.avg_daily_sales if context.avg_daily_sales > 0 else 5.0
                sales_series = [daily_vel] * 10
                n = 10

            score = 0.50
            factors = []
            
            # evaluate data length
            if n >= 100:
                score += 0.20
                factors.append("Excellent historical data depth (>100 periods).")
                data_quality = "excellent"
            elif n >= 20:
                score += 0.10
                factors.append("Sufficient historical data depth (>=20 periods).")
                data_quality = "good"
            elif n >= 5:
                score += 0.05
                factors.append("Moderate data depth.")
                data_quality = "fair"
            else:
                score -= 0.15
                factors.append("Critically short dataset size (<5 periods).")
                data_quality = "poor"

            # evaluate variance stability (Coefficient of Variation)
            mean_val = sum(sales_series) / n if n > 0 else 0.0
            if mean_val > 0:
                variance = sum((x - mean_val) ** 2 for x in sales_series) / n
                std_dev = variance ** 0.5
                cv = std_dev / mean_val
                
                if cv < 0.3:
                    score += 0.15
                    factors.append("High demand stability (low coefficient of variation).")
                elif cv > 1.2:
                    score -= 0.10
                    factors.append("High demand volatility / sales variance.")
            else:
                factors.append("No active demand history.")
                data_quality = "poor"

            # evaluate model agreement (if Forecast Engine values are available in parameters)
            forecast_val = context.parameters.get("forecast_value")
            if forecast_val is not None:
                # Compare WMA, ES, and Croston to check model agreement
                from app.services.intelligence.forecast_engine import ForecastEngine
                wma = ForecastEngine.weighted_moving_average(sales_series, 3)
                es = ForecastEngine.exponential_smoothing(sales_series, 0.3)
                croston = ForecastEngine.croston_method(sales_series, 0.1)

                predictions = [wma, es, croston]
                valid_preds = [p for p in predictions if p > 0.0]
                
                if len(valid_preds) >= 2:
                    max_p = max(valid_preds)
                    min_p = min(valid_preds)
                    deviation = (max_p - min_p) / min_p if min_p > 0 else 0.0
                    
                    if deviation <= 0.25:
                        score += 0.15
                        factors.append("High model convergence (various algorithms agree).")
                    elif deviation > 0.60:
                        score -= 0.10
                        factors.append("Low model consensus (high variance across models).")

            # Constrain confidence score between 0.10 and 1.00
            final_score = round(max(0.10, min(1.00, score)), 2)

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "confidence_score": float(final_score),
                    "data_quality": data_quality,
                    "confidence_factors": factors
                },
                confidence_weight=final_score
            )

        except Exception as e:
            logger.error(f"Error in ConfidenceEngine: {str(e)}")
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)],
                confidence_weight=0.0
            )
