import uuid
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.product import Product

class FinancialEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "financial_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            avg_daily_sales = context.parameters.get("forecast_value", context.avg_daily_sales or 0.0)
            lead_time = context.lead_time_days
            stock = context.stock_on_hand
            
            unit_cost = context.parameters.get("unit_cost_override", 20.0)
            selling_price = 40.0

            # unit_cost_override was already being read above but then
            # unconditionally overwritten by this query on every call — the
            # query's own unit_cost result was always identical to the
            # override, making it pure waste. Skip it only when BOTH overrides
            # are present, so a caller passing just one still gets the
            # original (fully correct) query for both fields.
            if "unit_cost_override" in context.parameters and "selling_price_override" in context.parameters:
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
                    unit_cost = product.unit_cost if product.unit_cost > 0 else 20.0
                    selling_price = product.selling_price if product.selling_price > 0 else 40.0

            # Revenue at Risk = daily_revenue * lead_time
            daily_revenue = avg_daily_sales * selling_price
            revenue_at_risk = daily_revenue * lead_time
            
            # Margin at Risk = daily_margin * lead_time
            margin_per_unit = max(0.0, selling_price - unit_cost)
            daily_margin = avg_daily_sales * margin_per_unit
            margin_at_risk = daily_margin * lead_time

            # Inventory Capital Locked = stock * unit_cost
            working_capital_locked = stock * unit_cost

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "revenue_at_risk": float(round(revenue_at_risk, 2)),
                    "margin_at_risk": float(round(margin_at_risk, 2)),
                    "working_capital_locked": float(round(working_capital_locked, 2))
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
