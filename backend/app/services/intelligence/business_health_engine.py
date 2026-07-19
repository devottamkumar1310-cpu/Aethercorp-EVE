from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput

class BusinessHealthEngine(BaseEngine):
    @property
    def name(self) -> str:
        return "business_health_engine"

    async def execute(self, context: EngineContext) -> EngineOutput:
        try:
            # 1. Fetch catalog-wide metrics if available in parameters
            total_skus = context.parameters.get("catalog_total_skus")
            healthy_skus = context.parameters.get("catalog_healthy_skus")
            avg_stockout_risk = context.parameters.get("catalog_avg_stockout_risk")
            dead_capital = context.parameters.get("catalog_dead_capital")
            total_capital = context.parameters.get("catalog_total_capital")
            anomalous_skus = context.parameters.get("catalog_anomalous_skus")

            if None not in (total_skus, healthy_skus, avg_stockout_risk, dead_capital, total_capital, anomalous_skus):
                # Catalog-wide Batch Execution Path
                # Inventory Health (25%)
                inv_health = (healthy_skus / total_skus * 100.0) if total_skus > 0 else 100.0
                
                # Stockout Risk (25%)
                stockout_health = max(0.0, 100.0 - avg_stockout_risk)
                
                # Working Capital Efficiency (25%)
                cap_efficiency = (100.0 - (dead_capital / total_capital * 100.0)) if total_capital > 0 else 100.0
                
                # Demand Stability (25%)
                stability = (100.0 - (anomalous_skus / total_skus * 100.0)) if total_skus > 0 else 100.0
            else:
                # Standalone SKU Execution Path (used in tests or fallback)
                # Pull values from context & parameters
                inventory_class = context.parameters.get("inventory_class", "HEALTHY")
                stockout_risk_score = context.parameters.get("stockout_risk_score", 10.0)
                anomalies = context.parameters.get("anomalies", [])
                
                inv_health = 100.0 if inventory_class in ["HEALTHY", "SLOW_MOVING"] else 0.0
                stockout_health = max(0.0, 100.0 - stockout_risk_score)
                cap_efficiency = 0.0 if inventory_class == "DEAD_STOCK" else 100.0
                stability = 0.0 if anomalies else 100.0

            # Calculate composite health score
            health_score = 0.25 * inv_health + 0.25 * stockout_health + 0.25 * cap_efficiency + 0.25 * stability
            health_score = max(0, min(100, int(health_score)))

            # Determine Health Grade
            if health_score >= 90:
                grade = "A"
            elif health_score >= 80:
                grade = "B"
            elif health_score >= 70:
                grade = "C"
            elif health_score >= 60:
                grade = "D"
            else:
                grade = "F"

            return EngineOutput(
                engine_name=self.name,
                success=True,
                data={
                    "health_score": int(health_score),
                    "health_grade": grade,
                    "breakdown": {
                        "inventory_health": round(inv_health, 1),
                        "stockout_health": round(stockout_health, 1),
                        "capital_efficiency": round(cap_efficiency, 1),
                        "demand_stability": round(stability, 1)
                    }
                }
            )
        except Exception as e:
            return EngineOutput(
                engine_name=self.name,
                success=False,
                errors=[str(e)]
            )
