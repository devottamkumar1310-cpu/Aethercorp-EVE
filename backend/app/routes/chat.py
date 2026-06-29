import uuid
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.agent_registry import AgentRegistry
from app.core.event_bus import event_bus, Event
from app.orchestration.planner import Planner
from app.orchestration.orchestrator import Orchestrator
from app.agents.executive_orchestrator import ExecutiveOrchestrator
from app.core.security import get_current_user, get_required_workspace_id, require_workspace_role
from app.models.profile import Profile

# Import specialized agents to trigger registration
from app.agents.market.market_agent import MarketAgent
from app.agents.inventory.inventory_agent import InventoryAgent
from app.agents.pricing.pricing_agent import PricingAgent
from app.agents.sourcing.sourcing_agent import SourcingAgent
from app.agents.analytics.analytics_agent import AnalyticsAgent
from app.agents.forecasting.forecasting_agent import ForecastingAgent

logger = logging.getLogger("eve.routes.chat")
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., json_schema_extra={"example": "Analyze my inventory health"})


class ChatResponse(BaseModel):
    executive_summary: str
    participating_agents: List[str]
    recommendations: List[str]
    discovered_agents: List[str]
    executed_agents: List[str]
    event_bus_messages: List[Dict[str, Any]]
    orchestrator_aggregation: Dict[str, Any]
    # Hardened single source of truth metrics
    inventory_risk_score: float = 0.0
    stockout_predictions: List[Dict[str, Any]] = Field(default_factory=list)
    reorder_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    pricing_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    estimated_profit_impact: float = 0.0


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest, 
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role = Depends(require_workspace_role("manager"))
):
    """
    [DEPRECATED] Phase 2 inventory-focused verification endpoint.
    Use POST /executive/chat for production AI COO interactions (Phase 3.1+).
    """
    logger.info(f"Received verification chat request: '{request.message}'")

    # 1. Capture Event Bus messages
    captured_events = []
    
    async def capture_event(event: Event):
        captured_events.append({
            "topic": event.topic,
            "sender": event.sender,
            "data": event.data
        })
        
    event_bus.subscribe("*", capture_event)

    try:
        # 2. Get list of discovered agents
        discovered_agents = [agent["role"] for agent in AgentRegistry.list_agents()]

        # 3. Use Planner to parse request into Task Graph
        planner = Planner()
        graph = await planner.create_plan(request.message, organization_id=workspace_id)

        # 4. Use Orchestrator to execute the graph
        orchestrator = Orchestrator(db=db)
        context = await orchestrator.execute(graph)

        # 5. Compile Executive Report using ExecutiveOrchestrator
        ceo = ExecutiveOrchestrator(db=db)
        executive_summary = await ceo.compile_report(context.results, organization_id=workspace_id)

        # Determine executed agents
        executed_agents = []
        for node in graph.nodes.values():
            if node.status == "completed":
                executed_agents.append(node.agent_role)

        # Synthesize recommendations from agent results
        recommendations = []
        for node_id, res in context.results.items():
            # If the result has any recommendation fields, collect them
            if "recommendation" in res:
                recommendations.append(res["recommendation"])
            elif "recommendations" in res and isinstance(res["recommendations"], list):
                for rec in res["recommendations"]:
                    if isinstance(rec, dict) and "recommended_price" in rec:
                        recommendations.append(f"Adjust SKU {rec.get('sku')} price to {rec.get('recommended_price')}")
                    elif isinstance(rec, str):
                        recommendations.append(rec)
            elif "items_at_risk" in res and isinstance(res["items_at_risk"], list):
                for item in res["items_at_risk"]:
                    recommendations.append(f"Reorder SKU: {item.get('sku')} due to stockout risk.")

        # Default recommendation if none collected
        if not recommendations:
            recommendations.append("Ensure regular review of inventory health parameters.")

        from app.services.analytics_service import AnalyticsService
        try:
            metrics = AnalyticsService.get_dashboard_metrics(db, workspace_id)
        except Exception as e:
            logger.error(f"Error fetching dashboard metrics for chat alignment: {e}")
            metrics = {}

        return ChatResponse(
            executive_summary=executive_summary.get("strategic_recommendation", "Analysis complete."),
            participating_agents=executed_agents,
            recommendations=recommendations,
            discovered_agents=discovered_agents,
            executed_agents=executed_agents,
            event_bus_messages=captured_events,
            orchestrator_aggregation=executive_summary,
            inventory_risk_score=metrics.get("inventory_risk_score", 0.0),
            stockout_predictions=metrics.get("stockout_predictions", []),
            reorder_recommendations=metrics.get("reorder_recommendations", []),
            pricing_recommendations=metrics.get("pricing_recommendations", []),
            estimated_profit_impact=metrics.get("estimated_profit_impact", 0.0)
        )

    except Exception as e:
        logger.error(f"Error executing chat end-to-end flow: {e}", exc_info=e)
        raise HTTPException(status_code=500, detail=f"Flow execution failed: {str(e)}")

    finally:
        # Unsubscribe wildcard listener to prevent memory leaks
        if "*" in event_bus._listeners:
            if capture_event in event_bus._listeners["*"]:
                event_bus._listeners["*"].remove(capture_event)
