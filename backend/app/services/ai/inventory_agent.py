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
        health_score = analysis.get("business_health_score", 80)
        health_grade = analysis.get("business_health_grade", "B")
        top_risks = analysis.get("top_risks", [])
        top_opportunities = analysis.get("top_opportunities", [])
        top_actions = analysis.get("top_actions", [])
            
        prompt = f"""
        User Question/Goal: {question or "Analyze inventory health, risks, and prioritize recommendations."}
        
        Executive Prioritization Summary:
        - Business Health Score: {health_score}/100 (Grade: {health_grade})
        - Top Risks: {top_risks}
        - Top Opportunities: {top_opportunities}
        - Top Actions: {top_actions}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=INVENTORY_SYSTEM_PROMPT
        )
        return result
