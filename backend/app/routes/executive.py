import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile
from app.schemas.executive import (
    ExecutiveChatRequest,
    ExecutiveChatResponse,
    MessageResponse,
    BusinessGoalCreate,
    BusinessGoalResponse,
    DailyBriefResponse,
    AIRecommendationResponse
)
from app.services.ai.agent_orchestrator import AgentOrchestrator
from app.services.ai.finance_agent import FinanceAgent
from app.services.ai.operations_agent import OperationsAgent
from app.services.ai.coo_agent import COOAgent
from app.services.ai.memory_service import (
    save_goal,
    list_goals,
    delete_goal,
    get_recent_recommendations,
    save_recommendation
)
from app.services.business_health_service import get_health_score
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities

import logging
logger = logging.getLogger("eve.routes.executive")

router = APIRouter(prefix="/api/executive", tags=["Executive"])

@router.post("/chat", response_model=ExecutiveChatResponse)
async def chat(
    body: ExecutiveChatRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    orchestrator = AgentOrchestrator()
    try:
        message = await orchestrator.orchestrate(
            db=db,
            org_id=workspace_id,
            question=body.question,
            mode=body.mode or "smart",
            conversation_id=body.conversation_id,
            user_id=current_user.id
        )
        return ExecutiveChatResponse(
            conversation_id=message.conversation_id,
            title=message.conversation.title,
            message=MessageResponse.model_validate(message)
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Chat execution unhandled error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

@router.get("/daily-brief", response_model=DailyBriefResponse)
async def daily_brief(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id)
):
    finance_agent = FinanceAgent()
    operations_agent = OperationsAgent()
    coo_agent = COOAgent()
    
    try:
        # Compile sub-agent analyses asynchronously
        finance_result = await finance_agent.analyze(db, workspace_id, "Analyze financial health for daily brief.")
        operations_result = await operations_agent.analyze(db, workspace_id, "Analyze operational performance for daily brief.")
        
        # Run COO master synthesizer
        coo_result = await coo_agent.analyze(
            db=db,
            org_id=workspace_id,
            question="Generate a daily brief summarizing company operations, risks, and opportunities.",
            finance_result=finance_result,
            operations_result=operations_result
        )
        
        # Save recommendations
        save_recommendation(db, workspace_id, "coo", coo_result)
        
        # Gathers health score, risks, opportunities
        health = get_health_score(db, workspace_id)
        risks_data = detect_risks(db, workspace_id)
        opportunities_data = detect_opportunities(db, workspace_id)
        
        return DailyBriefResponse(
            health_score=health.get("score", 50.0),
            health_status=health.get("status", "warning"),
            risks=risks_data.get("risks", []),
            opportunities=opportunities_data.get("opportunities", []),
            summary=coo_result.summary,
            recommendations=health.get("recommendations", [])
        )
    except Exception as e:
        err_str = str(e)
        error_type = "GENERIC_ERROR"
        status_code = 500
        
        if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
            error_type = "RESOURCE_EXHAUSTED"
            status_code = 429
        elif "Timeout" in err_str or "timed out" in err_str:
            error_type = "TIMEOUT"
            status_code = 504
        elif "Gemini" in err_str or "API_KEY" in err_str or "API key" in err_str:
            error_type = "GEMINI_ERROR"
            status_code = 503
            
        import datetime
        timestamp = datetime.datetime.utcnow().isoformat()
        logger.error(
            f"[AI COO DAILY BRIEF ERROR] workspace_id={workspace_id} user_id={current_user.id} model=gemini-2.5-flash "
            f"error_type={error_type} timestamp={timestamp} error_msg={err_str}"
        )
        
        # Fallback daily brief compiled deterministically
        try:
            logger.info(f"Triggering daily-brief deterministic fallback analysis for workspace {workspace_id}")
            health = get_health_score(db, workspace_id)
            risks_data = detect_risks(db, workspace_id)
            opportunities_data = detect_opportunities(db, workspace_id)
            
            risks = risks_data.get("risks", [])
            opportunities = opportunities_data.get("opportunities", [])
            recommendations = health.get("recommendations", [])
            
            summary = (
                f"EVE Daily Brief (Fallback Mode): Your current business health score is {health.get('score', 50.0)} ({health.get('status', 'warning')}). "
                f"Operational metrics have been processed locally. Please review the listed risks and opportunities for active items."
            )
            
            return DailyBriefResponse(
                health_score=health.get("score", 50.0),
                health_status=health.get("status", "warning"),
                risks=risks,
                opportunities=opportunities,
                summary=summary,
                recommendations=recommendations
            )
        except Exception as fallback_err:
            logger.critical(f"Daily brief fallback failed: {fallback_err}", exc_info=True)
            detail_msg = "An unexpected error occurred."
            if error_type == "RESOURCE_EXHAUSTED":
                detail_msg = "EVE is temporarily busy. Please retry in a few moments."
            elif error_type == "TIMEOUT":
                detail_msg = "Request timed out. Please try again."
            elif error_type == "GEMINI_ERROR":
                detail_msg = "AI analysis is temporarily unavailable."
                
            raise HTTPException(
                status_code=status_code,
                detail=detail_msg
            )

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
    return get_recent_recommendations(db, workspace_id, limit)
