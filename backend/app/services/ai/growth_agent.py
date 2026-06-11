from typing import Optional, Dict, List, Any
import uuid
from sqlalchemy.orm import Session
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.trend_service import calculate_trends
from app.services.opportunity_service import detect_opportunities
from app.services.ai.prompt_templates import GROWTH_SYSTEM_PROMPT
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class GrowthAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str = "",
        overview: Optional[Dict[str, Any]] = None,
        trends: Optional[Dict[str, Any]] = None,
        opportunities: Optional[Dict[str, Any]] = None
    ) -> AgentAnalysisResult:
        # Load trend analysis and strategic opportunities
        if overview is None:
            overview = BusinessAnalyticsService.get_overview(db, org_id)
        if trends is None:
            trends = calculate_trends(db, org_id)
        if opportunities is None:
            opportunities = detect_opportunities(db, org_id)
        
        prompt = f"""
        User Question/Goal: {question or "Identify strategic revenue expansion paths, margins, and growth bottlenecks."}
        
        Business Context:
        - Active Clients: {overview.get('active_clients', 0)}
        - Active Projects: {overview.get('active_projects', 0)}
        - Profit Margin: ${overview.get('profit', 0.0):,.2f}
        
        Strategic Indicators:
        - Revenue Trend: {trends.get('revenue_trend', 'stable')}
        - Profit Trend: {trends.get('profit_trend', 'stable')}
        - Task velocity Trend: {trends.get('task_trend', 'stable')}
        
        Detected Heuristic Opportunities:
        {opportunities.get('opportunities', [])}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=GROWTH_SYSTEM_PROMPT
        )
        return result
