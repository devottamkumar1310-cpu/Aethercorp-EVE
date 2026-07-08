import logging
import math
import uuid
from typing import Optional, Any
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.models.product import Product
from app.models.inventory import SalesRecord

logger = logging.getLogger("eve.intelligence.optimization_engine")

class OptimizationEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "optimization_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            avg_sales = context.parameters.get("forecast_value", context.avg_daily_sales)
            if avg_sales is None:
                avg_sales = context.avg_daily_sales

            lead_time = context.lead_time_days
            stock = context.stock_on_hand
            
            # 1. Estimate demand standard deviation
            sales_std_dev = 0.0
            unit_cost = 20.0
            
            if "sales_series_override" in context.parameters:
                sales_series = [float(x) for x in context.parameters["sales_series_override"]]
                unit_cost = context.parameters.get("unit_cost_override", 20.0)
                n = len(sales_series)
                if n > 1:
                    mean = sum(sales_series) / n
                    variance = sum((x - mean) ** 2 for x in sales_series) / n
                    sales_std_dev = variance ** 0.5
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
                    
                    # Compute actual std_dev
                    records = context.db.query(SalesRecord.quantity).filter(
                        SalesRecord.organization_id == org_id,
                        SalesRecord.product_id == product.id
                    ).all()
                    
                    quantities = [float(r[0]) for r in records if r[0] is not None]
                    if len(quantities) > 1:
                        mean = sum(quantities) / len(quantities)
                        variance = sum((x - mean) ** 2 for x in quantities) / len(quantities)
                        sales_std_dev = variance ** 0.5

            # 2. Safety Stock = Z * std_dev * sqrt(lead_time)
            # Service level factor Z = 1.65 (95% service level)
            lead_time_demand = avg_sales * lead_time
            if sales_std_dev <= 0.001:
                # Fallback: 50% of lead time demand
                safety_stock = math.ceil(lead_time_demand * 0.5)
            else:
                safety_stock = math.ceil(1.65 * sales_std_dev * math.sqrt(lead_time))
            
            # 3. Reorder Point = Lead Time Demand + Safety Stock
            reorder_point = math.ceil(lead_time_demand + safety_stock)
            
            # 4. Economic Order Quantity (EOQ)
            # EOQ = sqrt(2 * D * S / H)
            # D = annual demand, S = setup cost ($50), H = holding cost (20% of unit cost)
            annual_demand = avg_sales * 365.0
            setup_cost = 50.0
            holding_cost = max(1.0, unit_cost * 0.20)
            
            if annual_demand > 0:
                eoq = math.ceil(math.sqrt((2.0 * annual_demand * setup_cost) / holding_cost))
            else:
                eoq = 0
                
            # Establish operational minimum ordering levels
            reorder_quantity = max(10, eoq) if avg_sales > 0 else 0

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "reorder_quantity": float(reorder_quantity),
                    "safety_stock": float(safety_stock),
                    "reorder_point": float(reorder_point)
                },
                confidence_weight=0.95
            )
            
        except Exception as e:
            logger.error(f"Error in OptimizationEngine: {str(e)}")
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)],
                confidence_weight=0.0
            )
