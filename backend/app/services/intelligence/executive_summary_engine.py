from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput

class ExecutiveSummaryEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "executive_summary_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            # Pull inputs from parameters
            priority_score = context.parameters.get("priority_score", 50)
            inventory_class = context.parameters.get("inventory_class", "HEALTHY")
            revenue_at_risk = context.parameters.get("revenue_at_risk", 0.0)
            working_capital_locked = context.parameters.get("working_capital_locked", 0.0)
            anomalies = context.parameters.get("anomalies", [])
            sku = context.sku

            risk = None
            opportunities = []

            # 1. Generate Risk payload if SKU has high priority/risk
            if priority_score >= 65 and inventory_class in ["AT_RISK", "DEAD_STOCK"]:
                title = "Stockout Risk" if inventory_class == "AT_RISK" else "Dead Stock Risk"
                risk = {
                    "title": title,
                    "sku": sku,
                    "impact": float(round(revenue_at_risk, 2)),
                    "priority": int(priority_score)
                }

            # 2. Generate Opportunity payloads
            if inventory_class == "DEAD_STOCK" and working_capital_locked > 500:
                opportunities.append({
                    "type": "EXCESS_INVENTORY",
                    "description": f"₹{working_capital_locked:,.0f} capital locked in slow-moving inventory",
                    "sku": sku,
                    "value": float(round(working_capital_locked, 2))
                })

            # Reorder Optimization opportunity
            reorder_qty = context.parameters.get("reorder_quantity", 0.0)
            if inventory_class == "HEALTHY" and reorder_qty > 0:
                # Suggest optimal batch sizes
                opportunities.append({
                    "type": "REORDER_OPTIMIZATION",
                    "description": f"Optimize reorder quantities for {sku} to reduce holding costs by 15%",
                    "sku": sku,
                    "value": float(round(reorder_qty * 5.0, 2))  # simulated savings
                })

            # Supplier sourcing opportunity (placeholder logic for now)
            has_inflation = any(a.get("type") == "SUPPLIER_COST_INCREASE" for a in anomalies) if isinstance(anomalies, list) else False
            if has_inflation:
                opportunities.append({
                    "type": "SUPPLIER_OPPORTUNITY",
                    "description": f"Alternative supplier could reduce costs for {sku} by 12%",
                    "sku": sku,
                    "value": float(round(revenue_at_risk * 0.12, 2))
                })

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "risk": risk,
                    "opportunities": opportunities
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
