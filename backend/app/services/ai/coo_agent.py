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
            try:
                from app.services.analytics_service import AnalyticsService
                inv_analysis = AnalyticsService.get_inventory_analysis(db, org_id)
                health = {
                    "score": inv_analysis.get("business_health_score", 80),
                    "status": "healthy" if inv_analysis.get("business_health_score", 80) >= 80 else "warning",
                    "recommendations": inv_analysis.get("top_actions", [])
                }
            except Exception:
                health = get_health_score(db, org_id)
        if goals is None:
            goals = get_memory_context(db, org_id)
        
        # Fetch inventory intelligence context
        inventory_intel = None
        try:
            from app.services.analytics_service import AnalyticsService
            inv_analysis = AnalyticsService.get_inventory_analysis(db, org_id)
            items_at_risk = inv_analysis.get("items_at_risk", [])
            rev_at_risk = sum(item.get("revenue_at_risk", 0.0) for item in items_at_risk)
            capital_locked = sum(item.get("working_capital_locked", 0.0) for item in items_at_risk)
            inventory_intel = {
                "business_health_score": inv_analysis.get("business_health_score", 80),
                "revenue_at_risk": rev_at_risk,
                "working_capital_locked": capital_locked,
                "stockout_skus": inv_analysis.get("out_of_stock_skus", 0) + inv_analysis.get("low_stock_skus", 0),
                "top_actions": inv_analysis.get("top_actions", []),
                "risk_count": len(inv_analysis.get("top_risks", [])),
                "opportunity_count": len(inv_analysis.get("top_opportunities", []))
            }
        except Exception:
            pass

        context_block = build_context_block(
            health=health,
            goals=goals,
            inventory_intel=inventory_intel
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
        
        # Extract metadata metrics from inventory_intel
        risk_count = 0
        opportunity_count = 0
        revenue_at_risk = 0.0
        working_capital_locked = 0.0
        business_health_score = 80
        
        if inventory_intel:
            risk_count = inventory_intel["risk_count"]
            opportunity_count = inventory_intel["opportunity_count"]
            revenue_at_risk = inventory_intel["revenue_at_risk"]
            working_capital_locked = inventory_intel["working_capital_locked"]
            business_health_score = inventory_intel["business_health_score"]
        else:
            business_health_score = int(health.get("score", 80)) if health else 80

        result = ExecutiveSynthesisResult(
            agent=gemini_result.agent,
            summary=gemini_result.summary,
            priorities=gemini_result.priorities,
            expected_impact=gemini_result.expected_impact,
            findings_by_agent={},
            recommendations_by_agent={},
            confidence_scores={},
            evidence_used={
                "business_health_score": business_health_score,
                "risk_count": risk_count,
                "opportunity_count": opportunity_count,
                "revenue_at_risk": revenue_at_risk,
                "working_capital_locked": working_capital_locked
            }
        )
        return result
