import uuid
from sqlalchemy.orm import Session
from app.services.ai.prompt_templates import INVENTORY_SYSTEM_PROMPT
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container
from app.services.analytics_service import AnalyticsService

class InventoryAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(self, db: Session, org_id: uuid.UUID, question: str = "") -> AgentAnalysisResult:
        # Run full inventory analysis using the AnalyticsService
        analysis = AnalyticsService.get_inventory_analysis(db, org_id)
        inventory_data = analysis.get("items_at_risk", [])
            
        prompt = f"""
        User Question/Goal: {question or "Analyze inventory health, overstock risks, and reorder alerts."}
        
        Current Warehouse/Catalog Inventory:
        {inventory_data if inventory_data else "No inventory items are currently defined in the database."}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=INVENTORY_SYSTEM_PROMPT
        )
        return result
