from typing import Optional, Dict, List, Any
import uuid
from sqlalchemy.orm import Session
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.trend_service import calculate_trends
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities
from app.services.ai.memory_service import get_memory_context
from app.services.ai.prompt_templates import OPERATIONS_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class OperationsAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str = "",
        overview: Optional[Dict[str, Any]] = None,
        trends: Optional[Dict[str, Any]] = None,
        risks: Optional[Dict[str, Any]] = None,
        opportunities: Optional[Dict[str, Any]] = None,
        goals: Optional[List[Any]] = None
    ) -> AgentAnalysisResult:
        # Retrieve verified analytical metrics only from existing services
        if overview is None:
            overview = BusinessAnalyticsService.get_overview(db, org_id)
        if trends is None:
            trends = calculate_trends(db, org_id)
        if risks is None:
            risks = detect_risks(db, org_id)
        if opportunities is None:
            opportunities = detect_opportunities(db, org_id)
        if goals is None:
            goals = get_memory_context(db, org_id)
        
        operational_summary = {
            "total_clients": overview.get("clients", 0),
            "active_clients": overview.get("active_clients", 0),
            "total_projects": overview.get("projects", 0),
            "active_projects": overview.get("active_projects", 0),
            "total_tasks": overview.get("tasks", 0),
            "completed_tasks": overview.get("completed_tasks", 0)
        }
        
        context_block = build_context_block(
            risks=risks,
            opportunities=opportunities,
            trends=trends,
            goals=goals
        )
        
        prompt = f"""
        User Question/Goal: {question or "Analyze operational performance and identify bottlenecks."}
        
        Current Operational Summary:
        - Clients: {operational_summary['total_clients']} (Active: {operational_summary['active_clients']})
        - Projects: {operational_summary['total_projects']} (Active: {operational_summary['active_projects']})
        - Tasks: {operational_summary['total_tasks']} (Completed: {operational_summary['completed_tasks']})
        
        Additional Context:
        {context_block}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=OPERATIONS_SYSTEM_PROMPT
        )
        return result
