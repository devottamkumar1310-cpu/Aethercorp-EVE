from typing import List, Dict, Any
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput

class ActionEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "action_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            inventory_class = context.parameters.get("inventory_class", "HEALTHY")
            stockout_risk_score = context.parameters.get("stockout_risk_score", 0.0)
            anomalies = context.parameters.get("anomalies", [])
            sku = context.sku

            actions = []

            # 1. Check for stockout risk reorders
            if inventory_class == "AT_RISK" or stockout_risk_score >= 70.0:
                actions.append(f"Reorder {sku} within 5 days")

            # 2. Check for dead stock clearance
            if inventory_class == "DEAD_STOCK":
                actions.append(f"Reduce inventory exposure for {sku}")

            # 3. Check for supplier cost anomalies
            has_supplier_anomaly = any(a.get("type") == "SUPPLIER_COST_INCREASE" for a in anomalies) if isinstance(anomalies, list) else False
            if has_supplier_anomaly:
                actions.append(f"Review supplier pricing for {sku}")

            # 4. Fallback if no specific action is needed
            if not actions:
                actions.append(f"Monitor sales velocity for {sku}")

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "actions": actions
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
