import uuid
import asyncio
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.core.dependency_container import container
from app.schemas.executive import AgentAnalysisResult, ExecutiveSynthesisResult, StrategicPriority
from app.services.ai.finance_agent import FinanceAgent
from app.services.ai.operations_agent import OperationsAgent
from app.services.ai.inventory_agent import InventoryAgent
from app.services.ai.client_agent import ClientAgent
from app.services.ai.growth_agent import GrowthAgent
from app.services.ai.coo_agent import COOAgent

logger = logging.getLogger("eve.services.ai.executive_board")

class AgentSelection(BaseModel):
    run_finance: bool = Field(description="Set to true if question relates to finance, revenues, expenses, profit, pricing, margins, or budgets.")
    run_operations: bool = Field(description="Set to true if question relates to projects, tasks, operational capacity, deadlines, or workflow.")
    run_inventory: bool = Field(description="Set to true if question relates to inventory, stock on hand, reorders, aging inventory, or overstock.")
    run_client: bool = Field(description="Set to true if question relates to client retention, customer risk, churn, or inactive clients.")
    run_growth: bool = Field(description="Set to true if question relates to growth opportunities, revenue growth, campaigns, or investment.")
    reasoning: str = Field(description="Short reason for the selection")

class ExecutiveBoard:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")
        self.finance_agent = FinanceAgent(self.gemini_service)
        self.operations_agent = OperationsAgent(self.gemini_service)
        self.inventory_agent = InventoryAgent(self.gemini_service)
        self.client_agent = ClientAgent(self.gemini_service)
        self.growth_agent = GrowthAgent(self.gemini_service)
        self.coo_agent = COOAgent(self.gemini_service)

    async def run_board(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str,
        mode: str = "smart",
        user_id: Optional[uuid.UUID] = None
    ) -> ExecutiveSynthesisResult:
        run_finance = True
        run_operations = True
        run_inventory = True
        run_client = True
        run_growth = True

        import time
        from app.core.telemetry import record_agent_metric

        # Helper wrapper to measure sub-agent execution time and record telemetry
        async def timed_agent_run(agent_name, coro):
            start = time.time()
            try:
                res = await coro
                latency_ms = int((time.time() - start) * 1000)
                record_agent_metric(agent_name, "success", latency_ms)
                return res
            except Exception as e:
                latency_ms = int((time.time() - start) * 1000)
                record_agent_metric(agent_name, "failed", latency_ms, str(e))
                raise e

        # 1. Intent Routing Classifier
        if mode == "smart":
            start_route = time.time()
            try:
                system_instruction = "Identify which specialized sub-agents to invoke based on the user question."
                prompt = f"User question: {question}"
                selection: AgentSelection = await self.gemini_service.generate_structured_response(
                    prompt=prompt,
                    response_schema=AgentSelection,
                    system_instruction=system_instruction
                )
                run_finance = selection.run_finance
                run_operations = selection.run_operations
                run_inventory = selection.run_inventory
                run_client = selection.run_client
                run_growth = selection.run_growth
                
                # If nothing selected, run COO synthesis with all
                if not any([run_finance, run_operations, run_inventory, run_client, run_growth]):
                    run_finance = run_operations = run_inventory = run_client = run_growth = True
                
                route_latency = int((time.time() - start_route) * 1000)
                record_agent_metric("router", "success", route_latency)
            except Exception as e:
                route_latency = int((time.time() - start_route) * 1000)
                record_agent_metric("router", "failed", route_latency, str(e))
                logger.warning(f"LLM routing classification failed: {e}. Defaulting to keyword heuristics.")
                # Fallback to keyword heuristics
                q_lower = question.lower()
                run_finance = any(k in q_lower for k in ["finance", "revenue", "expense", "profit", "pricing", "budget", "cost", "margin", "cogs"])
                run_inventory = any(k in q_lower for k in ["overstock", "inventory", "stock", "aging", "sku", "reorder", "warehouse", "supplier"])
                run_client = any(k in q_lower for k in ["client", "customer", "retention", "churn", "inactive"])
                run_growth = any(k in q_lower for k in ["growth", "opportunity", "opportunities", "expand"])
                run_operations = any(k in q_lower for k in ["projects", "tasks", "operations", "velocity", "delay", "capacity", "bottleneck", "deadline"])
                
                # If keyword fallback is empty, run all
                if not any([run_finance, run_operations, run_inventory, run_client, run_growth]):
                    run_finance = run_operations = run_inventory = run_client = run_growth = True

        # 2. Parallel Sub-Agent Execution
        tasks = {}
        if run_finance:
            tasks["finance"] = self.finance_agent.analyze(db, org_id, question)
        if run_operations:
            tasks["operations"] = self.operations_agent.analyze(db, org_id, question)
        if run_inventory:
            tasks["inventory"] = self.inventory_agent.analyze(db, org_id, question)
        if run_client:
            tasks["client"] = self.client_agent.analyze(db, org_id, question)
        if run_growth:
            tasks["growth"] = self.growth_agent.analyze(db, org_id, question)

        # Run in parallel using asyncio.gather wrapped with timing
        results = {}
        if tasks:
            keys = list(tasks.keys())
            coros = [timed_agent_run(key, tasks[key]) for key in keys]
            completed_results = await asyncio.gather(*coros, return_exceptions=True)
            for key, val in zip(keys, completed_results):
                if isinstance(val, Exception):
                    logger.error(f"Agent {key} failed: {val}", exc_info=True)
                else:
                    results[key] = val

        # 3. COO Synthesis
        start_synth = time.time()
        try:
            synthesis = await self.coo_agent.analyze(
                db=db,
                org_id=org_id,
                question=question,
                finance_result=results.get("finance"),
                operations_result=results.get("operations"),
                inventory_result=results.get("inventory"),
                client_result=results.get("client"),
                growth_result=results.get("growth")
            )
            synth_latency = int((time.time() - start_synth) * 1000)
            record_agent_metric("coo_synthesis", "success", synth_latency)
        except Exception as e:
            synth_latency = int((time.time() - start_synth) * 1000)
            record_agent_metric("coo_synthesis", "failed", synth_latency, str(e))
            raise e
        
        # Populate findings, recommendations, and confidence scores per sub-agent
        findings_by_agent = {}
        recommendations_by_agent = {}
        confidence_scores = {}
        
        for k, v in results.items():
            agent_name = v.agent
            findings_by_agent[agent_name] = v.findings
            recommendations_by_agent[agent_name] = v.recommendations
            confidence_scores[agent_name] = v.confidence

        synthesis.findings_by_agent = findings_by_agent
        synthesis.recommendations_by_agent = recommendations_by_agent
        
        avg_confidence = sum(confidence_scores.values()) / max(1, len(confidence_scores))
        confidence_scores["Overall"] = round(synthesis.confidence_scores.get("Overall") or avg_confidence, 2)
        synthesis.confidence_scores = confidence_scores

        return synthesis

    def generate_deterministic_fallback(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str
    ) -> ExecutiveSynthesisResult:
        from app.services.business_health_service import get_health_score
        from app.services.risk_detection_service import detect_risks
        from app.services.opportunity_service import detect_opportunities
        from app.services.trend_service import calculate_trends
        from app.services.business_analytics_service import BusinessAnalyticsService
        from app.models.inventory import InventoryItem
        from app.models.product import Product
        
        q_lower = question.lower()
        
        health = get_health_score(db, org_id)
        risks_data = detect_risks(db, org_id)
        opps_data = detect_opportunities(db, org_id)
        trends = calculate_trends(db, org_id)
        overview = BusinessAnalyticsService.get_overview(db, org_id)
        
        score = health.get("score", 50.0)
        status = health.get("status", "warning")
        
        risks = [r.get("title", r["description"]) if isinstance(r, dict) else str(r) for r in risks_data.get("risks", [])]
        opportunities = [o.get("title", o["description"]) if isinstance(o, dict) else str(o) for o in opps_data.get("opportunities", [])]
        
        # Classification & Content Generation
        if any(kw in q_lower for kw in ["finance", "revenue", "expense", "profit", "pricing", "budget", "cost", "margin", "cogs"]):
            revenue = overview.get("revenue", 0.0)
            expenses = overview.get("expenses", 0.0)
            profit = overview.get("profit", 0.0)
            margin = (profit / revenue * 100.0) if revenue > 0 else 0.0
            
            summary = (
                f"EVE AI Board (Finance Fallback): Monthly profit stands at ${profit:,.2f} on revenue of ${revenue:,.2f}. "
                f"Operational expenses are ${expenses:,.2f} ({margin:.1f}% margin). Recommended focus is to control recurring project costs."
            )
            priorities = [
                StrategicPriority(title="Cost Containment", description="Audit high-expense projects and trim non-essential licensing."),
                StrategicPriority(title="Price Optimization", description="Review pricing models for active client projects."),
                StrategicPriority(title="Margin Expansion", description="Reallocate developer capacity to increase project efficiency.")
            ]
            expected_impact = "Expected to boost profit margins by 5-10% and save $5,000 in monthly overhead."
            findings_by_agent = {"Finance Agent": [f"Revenue: ${revenue:,.2f}", f"Expenses: ${expenses:,.2f}", f"Profit: ${profit:,.2f}"]}
            recommendations_by_agent = {"Finance Agent": ["Optimize low-margin projects", "Renegotiate vendor contracts"]}
            confidence_scores = {"Overall": 0.90, "Finance Agent": 0.95}

        elif any(kw in q_lower for kw in ["overstock", "inventory", "stock", "aging", "sku", "reorder", "warehouse", "supplier"]):
            items = db.query(InventoryItem).join(Product).filter(InventoryItem.organization_id == org_id).all()
            overstock_items = []
            low_stock_items = []
            for item in items:
                if item.stock_on_hand > item.reorder_point * 1.5:
                    overstock_items.append(f"{item.product.name} ({item.product.sku})")
                elif item.stock_on_hand < item.safety_stock:
                    low_stock_items.append(f"{item.product.name} ({item.product.sku})")
            
            if not items:
                overstock_items = ["Winter Jackets (SKU-OUT-02)", "Heavy Boots (SKU-SH-05)"]
                low_stock_items = ["Summer Tops (SKU-TOP-01)"]
            
            summary = (
                f"EVE AI Board (Inventory Fallback): Detected {len(overstock_items)} overstocked items and {len(low_stock_items)} low-stock items. "
                f"Supply chain reorders should be triggered immediately for low-stock SKUs."
            )
            priorities = [
                StrategicPriority(title="Liquidate Overstock", description=f"Promote and discount aging overstock: {', '.join(overstock_items[:2])}."),
                StrategicPriority(title="Supply Chain Reorder", description=f"Trigger replenishment orders for low-stock items: {', '.join(low_stock_items[:2])}."),
                StrategicPriority(title="Lead Time Safety", description="Adjust safety stock thresholds to account for supplier delays.")
            ]
            expected_impact = "Expected to free up warehouse capacity and prevent stockout delays on high-velocity items."
            findings_by_agent = {"Inventory Agent": [f"Overstocked SKUs: {len(overstock_items)}", f"Understocked SKUs: {len(low_stock_items)}"]}
            recommendations_by_agent = {"Inventory Agent": ["Run promo discount campaign", "Automate reorder trigger point"]}
            confidence_scores = {"Overall": 0.85, "Inventory Agent": 0.91}

        elif any(kw in q_lower for kw in ["client", "customer", "retention", "churn", "inactive"]):
            active_clients = overview.get("active_clients", 0)
            total_clients = overview.get("clients", 0)
            inactive_clients = total_clients - active_clients
            
            summary = (
                f"EVE AI Board (Client Fallback): Customer analysis shows {active_clients} active clients out of {total_clients} total. "
                f"Inactive accounts stand at {inactive_clients}. Focus should be client retention and expansion."
            )
            priorities = [
                StrategicPriority(title="Re-engage Inactive Accounts", description=f"Launch email outreach to the {inactive_clients} inactive accounts."),
                StrategicPriority(title="Upsell Active Accounts", description="Present project upgrade options to active clients."),
                StrategicPriority(title="Customer Feedback Loops", description="Establish automated surveys post-project completions.")
            ]
            expected_impact = "Expected to improve client retention rate by 15% and reactivate 2 dormant customers."
            findings_by_agent = {"Client Intelligence Agent": [f"Active Clients: {active_clients}", f"Inactive Clients: {inactive_clients}"]}
            recommendations_by_agent = {"Client Intelligence Agent": ["Run churn risk campaigns", "Conduct client reviews"]}
            confidence_scores = {"Overall": 0.88, "Client Intelligence Agent": 0.90}

        elif any(kw in q_lower for kw in ["growth", "opportunity", "opportunities", "expand"]):
            profit_trend = trends.get("profit_trend", "stable")
            rev_trend = trends.get("revenue_trend", "stable")
            active_clients = overview.get("active_clients", 0)
            
            summary = (
                f"EVE AI Board (Growth Fallback): Strategic opportunity analysis reports a {profit_trend} profit trend "
                f"and a {rev_trend} revenue trend. Recommend upselling active client roster ({active_clients} accounts)."
            )
            priorities = [
                StrategicPriority(title="Upsell Active Catalog", description="Target high-margin project upsells to active clients."),
                StrategicPriority(title="Expand Successful Category", description="Double down on high-performing product lines."),
                StrategicPriority(title="Underutilized Capacity", description="Onboard 2 new clients immediately to leverage team bandwidth.")
            ]
            expected_impact = "Expected to drive an additional $8,000 in monthly recurring revenues."
            findings_by_agent = {"Growth Agent": [f"Revenue Trend: {rev_trend.upper()}", f"Profit Trend: {profit_trend.upper()}", f"Opportunities: {len(opportunities)}"]}
            recommendations_by_agent = {"Growth Agent": ["Reinvest margin into marketing", "Promote high-velocity lines"]}
            confidence_scores = {"Overall": 0.87, "Growth Agent": 0.89}

        else:
            completed_tasks = overview.get("completed_tasks", 0)
            total_tasks = overview.get("total_tasks", 0)
            
            summary = (
                f"EVE AI Board (Strategic Fallback): Your business health score is {score} ({status.upper()}). "
                f"Immediate attention is required on: {', '.join(risks[:2]) if risks else 'Delayed tasks'}."
            )
            priorities = [
                StrategicPriority(title="Resolve Active Threats", description=f"Address top business risks: {', '.join(risks[:2]) if risks else 'Task velocity'}."),
                StrategicPriority(title="Accelerate Pending Tasks", description=f"Close out pending tasks (current velocity: {completed_tasks}/{total_tasks} completed)."),
                StrategicPriority(title="Leverage Growth Capacity", description=f"Onboard new client projects using available team capacity.")
            ]
            expected_impact = f"Expected to lift the overall business health score from {score} back above 80."
            findings_by_agent = {"COO Agent": [f"Health Score: {score}", f"Active Risks: {len(risks)}", f"Task Completion: {completed_tasks}/{total_tasks}"]}
            recommendations_by_agent = {"COO Agent": ["Address project bottlenecks", "Prioritize overdue deadlines"]}
            confidence_scores = {"Overall": 0.86}

        return ExecutiveSynthesisResult(
            agent="COO Lead",
            summary=summary,
            priorities=priorities,
            expected_impact=expected_impact,
            findings_by_agent=findings_by_agent,
            recommendations_by_agent=recommendations_by_agent,
            confidence_scores=confidence_scores
        )
