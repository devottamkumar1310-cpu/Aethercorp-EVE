import uuid
from sqlalchemy.orm import Session
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.trend_service import calculate_trends
from app.services.ai.memory_service import get_memory_context
from app.services.ai.prompt_templates import FINANCE_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class FinanceAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(self, db: Session, org_id: uuid.UUID, question: str = "") -> AgentAnalysisResult:
        # Retrieve verified analytical metrics only from existing services
        overview = BusinessAnalyticsService.get_overview(db, org_id)
        trends = calculate_trends(db, org_id)
        goals = get_memory_context(db, org_id)
        
        financial_data = {
            "total_revenue": overview.get("revenue", 0.0),
            "total_expenses": overview.get("expenses", 0.0),
            "net_profit": overview.get("profit", 0.0)
        }
        
        context_block = build_context_block(
            trends=trends,
            goals=goals
        )
        
        prompt = f"""
        User Question/Goal: {question or "Analyze financial health and align with current business goals."}
        
        Current Financial Summary:
        - Revenue: ${financial_data['total_revenue']:.2f}
        - Expenses: ${financial_data['total_expenses']:.2f}
        - Net Profit: ${financial_data['net_profit']:.2f}
        
        Additional Context:
        {context_block}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=FINANCE_SYSTEM_PROMPT
        )
        return result
