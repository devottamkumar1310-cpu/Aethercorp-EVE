import uuid
from sqlalchemy.orm import Session
from app.services.ai.prompt_templates import INVENTORY_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container
from app.services.analytics_service import AnalyticsService

class InventoryAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(self, db: Session, org_id: uuid.UUID, question: str = "") -> AgentAnalysisResult:
        analysis = AnalyticsService.get_inventory_analysis(db, org_id)
        items_at_risk = analysis.get("items_at_risk", [])
        dead_stock = analysis.get("dead_stock", [])
        
        reorder_items = [item for item in items_at_risk if item.get("stock_on_hand", 0) < item.get("reorder_point", 0)]
        reorder_items.sort(key=lambda x: x.get("stockout_risk_score", 0), reverse=True)
        
        rev_at_risk = sum(item.get("revenue_at_risk", 0.0) for item in items_at_risk)
        capital_locked = sum(item.get("working_capital_locked", 0.0) for item in items_at_risk)

        inventory_intel = {
            "business_health_score": analysis.get("business_health_score", 80),
            "revenue_at_risk": rev_at_risk,
            "working_capital_locked": capital_locked,
            "stockout_skus": analysis.get("out_of_stock_skus", 0) + analysis.get("low_stock_skus", 0),
            "items_at_risk": items_at_risk[:5],
            "dead_stock_items": dead_stock[:5] if dead_stock else [item for item in items_at_risk if item.get("is_dead_stock")][:5],
            "reorder_recommendations": reorder_items[:5]
        }

        context_block = build_context_block(inventory_intel=inventory_intel)
            
        prompt = f"""
        User Question/Goal: {question or "Analyze inventory health, dead stock, reorders, and stockout risks."}
        
        {context_block}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=INVENTORY_SYSTEM_PROMPT
        )
        return result

