from typing import Optional, Dict, List, Any
import uuid
import datetime
from sqlalchemy.orm import Session
from app.models.project import Project
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.trend_service import calculate_trends
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities
from app.services.ai.memory_service import get_memory_context
from app.services.ai.prompt_templates import OPERATIONS_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

def to_utc(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)

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
        
        # 1. Fetch delayed / at-risk projects
        projects = db.query(Project).filter(Project.organization_id == org_id).all()
        delayed_projects = []
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        
        for p in projects:
            if p.status == "completed":
                continue
            overdue_tasks = sum(1 for t in p.tasks if t.status != "completed" and t.due_date and to_utc(t.due_date) < now_utc)
            days_rem = (to_utc(p.deadline) - now_utc).days if p.deadline else None
            
            risk_lvl = "Low"
            if (days_rem is not None and days_rem < 0) or overdue_tasks >= 3:
                risk_lvl = "High"
            elif (days_rem is not None and days_rem <= 14) or overdue_tasks > 0 or p.completion_percentage < 50:
                risk_lvl = "Medium"
                
            if risk_lvl in ["High", "Medium"]:
                delayed_projects.append({
                    "name": p.name,
                    "progress": p.completion_percentage,
                    "deadline": p.deadline.strftime("%Y-%m-%d") if p.deadline else "None",
                    "overdue_tasks": overdue_tasks,
                    "risk_level": risk_lvl
                })

        delayed_projects.sort(key=lambda x: (0 if x["risk_level"] == "High" else 1, -x["overdue_tasks"]))

        ops_intel = {
            "total_clients": overview.get("clients", 0),
            "active_clients": overview.get("active_clients", 0),
            "total_projects": overview.get("projects", 0),
            "active_projects": overview.get("active_projects", 0),
            "total_tasks": overview.get("tasks", 0),
            "completed_tasks": overview.get("completed_tasks", 0),
            "delayed_projects": delayed_projects[:5]
        }
        
        context_block = build_context_block(
            risks=risks,
            opportunities=opportunities,
            trends=trends,
            goals=goals,
            operations_intel=ops_intel
        )
        
        prompt = f"""
        User Question/Goal: {question or "Analyze operational performance, delayed projects, and bottlenecks."}
        
        {context_block}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=OPERATIONS_SYSTEM_PROMPT
        )
        return result

