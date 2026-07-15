import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id, require_workspace_role
from app.models.profile import Profile
from app.models.executive_conversation import ExecutiveConversation
from app.schemas.executive import (
    ExecutiveChatRequest,
    ExecutiveChatResponse,
    MessageResponse,
    BusinessGoalCreate,
    BusinessGoalUpdate,
    BusinessGoalResponse,
    DailyBriefResponse,
    AIRecommendationResponse,
    ExecutiveConversationResponse,
    ExecutiveConversationDetailResponse,
    ExecutiveConversationUpdate
)
from app.services.ai.agent_orchestrator import AgentOrchestrator
from app.services.ai.finance_agent import FinanceAgent
from app.services.ai.operations_agent import OperationsAgent
from app.services.ai.coo_agent import COOAgent
from app.services.ai.memory_service import (
    save_goal,
    list_goals,
    delete_goal,
    update_goal,
    get_influencing_goals,
    get_recent_recommendations,
    save_recommendation
)
from app.services.business_health_service import get_health_score
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities

import logging
logger = logging.getLogger("eve.routes.executive")

from app.core.rate_limiter import rate_limit

router = APIRouter(
    prefix="/api/executive",
    tags=["Executive"],
    dependencies=[Depends(require_workspace_role("manager"))]
)

@router.post("/chat", response_model=ExecutiveChatResponse)
async def chat(
    body: ExecutiveChatRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _: None = Depends(rate_limit(requests=15, window_seconds=60))
):
    from app.config import settings
    orchestrator = AgentOrchestrator()
    try:
        message = await orchestrator.orchestrate(
            db=db,
            org_id=workspace_id,
            question=body.question,
            mode=body.mode or "smart",
            conversation_id=body.conversation_id,
            user_id=current_user.id,
            language=body.language,
            developer_mode=body.developer_mode,
            document_id=body.document_id
        )
        
        # Check if we should enforce founder mode filtering
        is_founder = settings.FOUNDER_MODE
        if body.developer_mode is not None:
            is_founder = not body.developer_mode
            
        message_data = MessageResponse.model_validate(message)
        if is_founder and message_data.agent_data:
            filtered_data = message_data.agent_data.copy()
            # Do NOT strip audit, confidence, and governance metrics in founder mode to ensure explainability and trust
            filtered_data.pop("telemetry", None)
            message_data.agent_data = filtered_data
            
        return ExecutiveChatResponse(
            conversation_id=message.conversation_id,
            title=message.conversation.title,
            message=message_data
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Chat execution unhandled error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@router.post("/chat/stream")
async def chat_stream(
    body: ExecutiveChatRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _: None = Depends(rate_limit(requests=15, window_seconds=60))
):
    from fastapi.responses import StreamingResponse
    orchestrator = AgentOrchestrator()
    
    async def event_generator():
        try:
            async for chunk in orchestrator.orchestrate_stream(
                db=db,
                org_id=workspace_id,
                question=body.question,
                mode=body.mode or "smart",
                conversation_id=body.conversation_id,
                user_id=current_user.id,
                language=body.language,
                developer_mode=body.developer_mode,
                document_id=body.document_id
            ):
                yield chunk
        except Exception as e:
            logger.error(f"Streaming error occurred: {e}", exc_info=True)
            import json
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/daily-brief", response_model=DailyBriefResponse)
async def daily_brief(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _: None = Depends(rate_limit(requests=5, window_seconds=60))
):
    from app.services.analytics_service import AnalyticsService
    
    try:
        inv_analysis = AnalyticsService.get_inventory_analysis(db, workspace_id)
        pricing_analysis = AnalyticsService.get_pricing_analysis(db, workspace_id)
        
        revenue_risks = []
        capital_risks = []
        opportunities = []
        
        # 1. Map Revenue Risks (Stockouts)
        for item in inv_analysis.get("items_at_risk", []):
            if item.get("stockout_risk_score", 0) >= 50 and not item.get("is_dead_stock"):
                revenue_risks.append({
                    "title": f"Reorder {item.get('name', item.get('sku'))}",
                    "why": f"Stockout predicted in {item.get('days_until_stockout', 0)} days.",
                    "impact": f"₹{item.get('revenue_at_risk', 0):,.0f} revenue at risk.",
                    "action": f"Order {item.get('reorder_quantity', 0)} units today.",
                    "size_run": item.get("size_distribution"),
                    "reasoning": item.get("reasoning", []),
                    "trace_data": item.get("trace_data")
                })
        
        # 2. Map Capital Risks (Dead Stock / Low Margin)
        for item in inv_analysis.get("dead_stock", []):
            if len(capital_risks) < 3:
                capital_risks.append({
                    "title": f"Liquidate {item.get('name', item.get('sku'))}",
                    "why": f"Sell Through {item.get('sell_through_rate', 0)}%",
                    "impact": f"₹{item.get('working_capital_locked', 0):,.0f} trapped in inventory.",
                    "action": "Apply 20% markdown.",
                    "size_run": item.get("size_distribution"),
                    "reasoning": item.get("reasoning", []),
                    "trace_data": item.get("trace_data")
                })

        # 3. Map Opportunities (High Sell Through, Price adjustments that increase profit)
        for item in inv_analysis.get("opportunities", []):
            if len(opportunities) < 3:
                opportunities.append({
                    "title": f"Double Down On {item.get('name', item.get('sku'))}",
                    "why": f"Sell Through {item.get('sell_through_rate', 0)}%",
                    "impact": "Potential revenue expansion.",
                    "action": "Prioritize replenishment.",
                    "size_run": item.get("size_distribution"),
                    "reasoning": item.get("reasoning", []),
                    "trace_data": item.get("trace_data")
                })
                
        for rec in pricing_analysis.get("recommendations", []):
            if rec.get("projected_profit_impact", 0) > 0 and rec.get("price_change_percentage", 0) > 0:
                opportunities.append({
                    "title": f"Optimize Price for {rec.get('name', rec.get('sku'))}",
                    "why": f"High elasticity.",
                    "impact": f"Potential ₹{rec.get('projected_profit_impact', 0):,.0f} additional profit.",
                    "action": f"Increase price by {rec.get('price_change_percentage', 0)}%."
                })
            
        # Sort and limit
        # Sort by impact numerically if possible, else just take top 5
        revenue_risks = revenue_risks[:5]
        capital_risks = capital_risks[:5]
        opportunities = opportunities[:5]
        
        return DailyBriefResponse(
            revenue_risks=revenue_risks,
            capital_risks=capital_risks,
            opportunities=opportunities
        )
    except Exception as e:
        logger.error(f"Daily brief error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to compile daily brief.")

@router.get("/goals", response_model=List[BusinessGoalResponse])
def get_goals(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return list_goals(db, workspace_id)

@router.post("/goals", response_model=BusinessGoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    body: BusinessGoalCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return save_goal(
        db=db,
        org_id=workspace_id,
        goal_type=body.goal_type,
        description=body.description,
        target_value=body.target_value
    )

@router.put("/goals/{goal_id}", response_model=BusinessGoalResponse)
def edit_business_goal(
    goal_id: uuid.UUID,
    body: BusinessGoalUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    updated = update_goal(
        db=db,
        org_id=workspace_id,
        goal_id=goal_id,
        update_data=body.model_dump(exclude_none=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Goal not found")
    return updated

@router.delete("/goals/{goal_id}")
def delete_business_goal(
    goal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    deleted = delete_goal(db, workspace_id, goal_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"status": "success", "message": "Business goal successfully deleted"}

@router.get("/recommendations", response_model=List[AIRecommendationResponse])
def get_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    recs = get_recent_recommendations(db, workspace_id, limit)
    for r in recs:
        r.influenced_by_goals = get_influencing_goals(db, workspace_id, r.recommendation, r.agent_source)
    return recs

@router.get("/scenarios", response_model=List[Dict[str, Any]])
def get_scenarios(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    """
    Returns the list of previously executed forecast and simulation scenarios.
    """
    from app.models.future import Forecast
    forecasts = db.query(Forecast).filter(Forecast.organization_id == workspace_id).order_by(Forecast.created_at.desc()).all()
    
    import datetime
    results = []
    for f in forecasts:
        results.append({
            "id": str(f.id),
            "created_at": (f.created_at.replace(tzinfo=datetime.timezone.utc) if f.created_at.tzinfo is None else f.created_at).isoformat(),
            "scenario_type": f.metrics.get("scenario_type"),
            "parameter": f.metrics.get("parameter"),
            "results": f.metrics.get("results")
        })
    return results


@router.get("/conversations", response_model=List[ExecutiveConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    return db.query(ExecutiveConversation).filter(
        ExecutiveConversation.organization_id == workspace_id
    ).order_by(ExecutiveConversation.created_at.desc()).all()


@router.get("/conversations/{conversation_id}", response_model=ExecutiveConversationDetailResponse)
def get_conversation_detail(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    conversation = db.query(ExecutiveConversation).filter(
        ExecutiveConversation.id == conversation_id,
        ExecutiveConversation.organization_id == workspace_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.patch("/conversations/{conversation_id}", response_model=ExecutiveConversationResponse)
def rename_conversation(
    conversation_id: uuid.UUID,
    body: ExecutiveConversationUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    conversation = db.query(ExecutiveConversation).filter(
        ExecutiveConversation.id == conversation_id,
        ExecutiveConversation.organization_id == workspace_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.title = body.title
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    conversation = db.query(ExecutiveConversation).filter(
        ExecutiveConversation.id == conversation_id,
        ExecutiveConversation.organization_id == workspace_id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conversation)
    db.commit()
    return {"status": "success", "message": "Conversation successfully deleted"}


@router.get("/suggested-questions")
def get_suggested_questions(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    """
    Returns suggested questions for the AI COO chat, dynamically customized 
    based on the state of the active workspace.
    """
    from app.services.analytics_service import AnalyticsService
    
    finance_questions = [
        "How profitable is this business?",
        "What expenses are hurting margins?"
    ]
    inventory_questions = [
        "Which products should I reorder?",
        "What inventory is becoming dead stock?"
    ]
    growth_questions = [
        "How can revenue be increased?",
        "Which customers are most valuable?"
    ]
    founder_questions = [
        "Give me an executive summary.",
        "What should I focus on this week?"
    ]

    try:
        metrics = AnalyticsService.get_dashboard_metrics(db, workspace_id)
        
        # Check stockout risks
        stockout_recs = metrics.get("reorder_recommendations", [])
        stockout_preds = metrics.get("stockout_predictions", [])
        has_stockout_risk = len(stockout_recs) > 0 or any(p.get("days_until_stockout", 99) <= 15 for p in stockout_preds)
        
        # Check dead stock
        inv_analysis = metrics.get("inventory_analysis", {})
        has_dead_stock = inv_analysis.get("dead_stock_skus", 0) > 0 or any(
            item.get("is_dead_stock") for item in inv_analysis.get("items_at_risk", [])
        )

        # Check margins
        pricing_recs = metrics.get("pricing_recommendations", [])
        has_margin_decline = len(pricing_recs) > 0 or metrics.get("margin_risk_score", 0.0) > 0.0
        
        # Inject dynamic context questions
        if has_dead_stock:
            inventory_questions.insert(0, "Why do we have dead inventory?")
            inventory_questions.insert(1, "Which products are causing it?")
            
        if has_margin_decline:
            finance_questions.insert(0, "Why are margins decreasing?")
            finance_questions.insert(1, "What costs increased recently?")
            
        if has_stockout_risk:
            inventory_questions.insert(0, "Which products need immediate replenishment?")
            inventory_questions.insert(1, "What is the financial impact of stockouts?")
            
    except Exception as e:
        logger.error(f"Error compiling dynamic suggested questions: {e}")
        
    return {
        "Finance": list(dict.fromkeys(finance_questions)),
        "Inventory": list(dict.fromkeys(inventory_questions)),
        "Growth": list(dict.fromkeys(growth_questions)),
        "Founder": list(dict.fromkeys(founder_questions))
    }


