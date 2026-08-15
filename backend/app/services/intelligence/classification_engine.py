import uuid
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.product import Product

class ClassificationEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "classification_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            sales_series = context.parameters.get("sales_series_override", [])
            context.parameters.get("unit_cost_override", 20.0)
            
            selling_price = 40.0
            recency_days = 365
            frequency = 0
            monetary_value = 0.0

            # Batch analysis (analytics_service.get_inventory_analysis) already has
            # this in memory and passes it here, sparing a per-SKU query; any other
            # caller that omits the override gets the original query, unchanged.
            if "selling_price_override" in context.parameters:
                selling_price = context.parameters["selling_price_override"] or 40.0
            elif context.db and context.organization_id:
                org_id = context.organization_id
                if isinstance(org_id, str):
                    org_id = uuid.UUID(org_id)
                product = context.db.query(Product).filter(
                    Product.organization_id == org_id,
                    Product.sku == context.sku
                ).first()
                if product:
                    selling_price = product.selling_price or 40.0
            
            # Recency calculation
            if "recency_override" in context.parameters:
                recency_days = context.parameters["recency_override"]
            elif sales_series:
                non_zero_indices = [i for i, x in enumerate(sales_series) if x > 0]
                if non_zero_indices:
                    recency_days = len(sales_series) - 1 - non_zero_indices[-1]
                else:
                    recency_days = 365
            
            # Frequency calculation (past 30 days active sales count)
            if "frequency_override" in context.parameters:
                frequency = context.parameters["frequency_override"]
            else:
                frequency = sum(1 for x in sales_series[-30:] if x > 0.0) if sales_series else 0
                
            # Monetary calculation (past 30 days revenue)
            if "monetary_override" in context.parameters:
                monetary_value = context.parameters["monetary_override"]
            else:
                sales_qty_30 = sum(sales_series[-30:]) if sales_series else 0.0
                monetary_value = sales_qty_30 * selling_price

            # Assign RFM scores (1 to 5)
            if recency_days <= 7:
                r_score = 5
            elif recency_days <= 30:
                r_score = 4
            elif recency_days <= 90:
                r_score = 3
            elif recency_days <= 180:
                r_score = 2
            else:
                r_score = 1

            if frequency >= 25:
                f_score = 5
            elif frequency >= 10:
                f_score = 4
            elif frequency >= 3:
                f_score = 3
            elif frequency >= 1:
                f_score = 2
            else:
                f_score = 1

            if monetary_value >= 5000.0:
                m_score = 5
            elif monetary_value >= 1500.0:
                m_score = 4
            elif monetary_value >= 300.0:
                m_score = 3
            elif monetary_value >= 50.0:
                m_score = 2
            else:
                m_score = 1

            rfm_score = r_score + f_score + m_score

            abc_map = context.parameters.get("abc_classifications", {})
            abc_class = abc_map.get(context.sku, "B") 

            # Determine final inventory class
            is_dead_stock = False
            avg_daily_sales = context.parameters.get("forecast_value", context.avg_daily_sales or 0.0)
            if avg_daily_sales > 0:
                days_supply = context.stock_on_hand / avg_daily_sales
            else:
                days_supply = 999.0

            if days_supply >= 180.0 and r_score == 1:
                is_dead_stock = True
            elif rfm_score <= 5:
                is_dead_stock = True

            reorder_point = context.parameters.get("reorder_point", int(avg_daily_sales * context.lead_time_days * 1.5))
            
            if is_dead_stock:
                inv_class = "DEAD_STOCK"
                risk_level = "LOW"
            elif rfm_score <= 8:
                inv_class = "SLOW_MOVING"
                risk_level = "LOW"
            elif context.stock_on_hand < reorder_point:
                inv_class = "AT_RISK"
                risk_level = "CRITICAL" if abc_class == "A" else "HIGH"
            else:
                inv_class = "HEALTHY"
                risk_level = "LOW"

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "inventory_class": inv_class,
                    "abc_class": abc_class,
                    "rfm_score": int(rfm_score),
                    "r_score": r_score,
                    "f_score": f_score,
                    "m_score": m_score,
                    "risk_level": risk_level
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
