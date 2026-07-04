from typing import Optional, Dict, Any
import uuid
from sqlalchemy.orm import Session
from app.models.client import Client
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.ai.prompt_templates import CLIENT_SYSTEM_PROMPT
from app.schemas.executive import AgentAnalysisResult
from app.core.dependency_container import container

class ClientAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str = "",
        overview: Optional[Dict[str, Any]] = None
    ) -> AgentAnalysisResult:
        # Query client lists and statuses from the database
        clients = db.query(Client).filter(Client.organization_id == org_id).all()
        
        clients_data = []
        for c in clients:
            clients_data.append({
                "name": c.company_name,
                "status": c.status,
                "email": c.email,
                "phone": c.phone
            })
            
        if overview is None:
            overview = BusinessAnalyticsService.get_overview(db, org_id)
        
        prompt = f"""
        User Question/Goal: {question or "Analyze client status, churn risks, and retention opportunities."}
        
        Overall Client Summary:
        - Total Clients: {overview.get('clients', 0)}
        - Active Clients: {overview.get('active_clients', 0)}
        
        Detailed Client Registry:
        {clients_data if clients_data else "No clients are currently registered."}
        """
        
        result = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=AgentAnalysisResult,
            system_instruction=CLIENT_SYSTEM_PROMPT
        )
        return result
