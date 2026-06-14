import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.services.business_health_service import get_health_score
from app.services.ai.memory_service import get_memory_context
from app.services.ai.prompt_templates import COO_SYSTEM_PROMPT, build_context_block
from app.schemas.executive import AgentAnalysisResult, ExecutiveSynthesisResult, GeminiExecutiveSynthesisResult
from app.core.dependency_container import container

class COOAgent:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")

    async def analyze(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str,
        finance_result: Optional[AgentAnalysisResult] = None,
        operations_result: Optional[AgentAnalysisResult] = None,
        inventory_result: Optional[AgentAnalysisResult] = None,
        client_result: Optional[AgentAnalysisResult] = None,
        growth_result: Optional[AgentAnalysisResult] = None,
        forecasting_result: Optional[AgentAnalysisResult] = None,
        health: Optional[dict] = None,
        goals: Optional[list] = None,
        conversation_history: Optional[list] = None
    ) -> ExecutiveSynthesisResult:
        # Retrieve overall health score and goals if not passed as cached params
        if health is None:
            health = get_health_score(db, org_id)
        if goals is None:
            goals = get_memory_context(db, org_id)
        
        context_block = build_context_block(
            health=health,
            goals=goals
        )
        
        sub_agent_reports = []
        
        def format_report(name: str, res: Optional[AgentAnalysisResult]):
            if not res:
                return ""
            return f"""
            === {name.upper()} ANALYSIS ===
            Summary: {res.summary}
            Findings: {res.findings}
            Recommendations: {res.recommendations}
            Confidence: {res.confidence}
            """
            
        if finance_result:
            sub_agent_reports.append(format_report("Finance Agent", finance_result))
        if operations_result:
            sub_agent_reports.append(format_report("Operations Agent", operations_result))
        if inventory_result:
            sub_agent_reports.append(format_report("Inventory Agent", inventory_result))
        if client_result:
            sub_agent_reports.append(format_report("Client Intelligence Agent", client_result))
        if growth_result:
            sub_agent_reports.append(format_report("Growth Agent", growth_result))
        if forecasting_result:
            sub_agent_reports.append(format_report("Forecasting Agent", forecasting_result))
            
        reports_block = "\n".join([r for r in sub_agent_reports if r])
        
        history_block = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history:
                role_label = "Founder" if msg.get("role") == "user" else "EVE COO"
                history_lines.append(f"{role_label}: {msg.get('content')}")
            history_block = "\n=== RECENT CONVERSATION HISTORY ===\n" + "\n".join(history_lines) + "\n====================================\n"

        prompt = f"""
        {history_block}
        User Question/Goal: {question}
        
        Current Overall Business Health & Goals:
        {context_block}
        
        Reports from Specialized Sub-Agents:
        {reports_block or "No specialized sub-agent analysis executed for this query."}
        """
        
        gemini_result: GeminiExecutiveSynthesisResult = await self.gemini_service.generate_structured_response(
            prompt=prompt,
            response_schema=GeminiExecutiveSynthesisResult,
            system_instruction=COO_SYSTEM_PROMPT,
            agent_name="coo"
        )
        
        result = ExecutiveSynthesisResult(
            agent=gemini_result.agent,
            summary=gemini_result.summary,
            priorities=gemini_result.priorities,
            expected_impact=gemini_result.expected_impact,
            findings_by_agent={},
            recommendations_by_agent={},
            confidence_scores={}
        )
        return result
