import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.intelligence import (
    HealthScoreResponse,
    ExecutiveSummaryResponse,
    RiskResponse,
    OpportunityResponse,
    TrendsResponse,
    ActionResponse,
    IntelligenceSnapshotResponse
)

from app.services.business_health_service import get_health_score
from app.services.executive_summary_service import generate_summary
from app.services.risk_detection_service import detect_risks
from app.services.opportunity_service import detect_opportunities
from app.services.trend_service import calculate_trends
from app.services.action_engine import generate_actions
from app.services.intelligence_snapshot_service import create_snapshot, get_recent_snapshots

from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])

@router.get("/health", response_model=HealthScoreResponse)
def get_health(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return get_health_score(db, workspace_id)

@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
def get_executive_summary(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return generate_summary(db, workspace_id)

@router.get("/risks", response_model=RiskResponse)
def get_risks(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return detect_risks(db, workspace_id)

@router.get("/opportunities", response_model=OpportunityResponse)
def get_opportunities(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return detect_opportunities(db, workspace_id)

@router.get("/trends", response_model=TrendsResponse)
def get_trends(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return calculate_trends(db, workspace_id)

@router.get("/actions", response_model=ActionResponse)
def get_actions(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return generate_actions(db, workspace_id)

@router.post("/snapshot", response_model=IntelligenceSnapshotResponse)
def create_intelligence_snapshot(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return create_snapshot(db, workspace_id)

@router.get("/history", response_model=list[IntelligenceSnapshotResponse])
def get_snapshot_history(db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return get_recent_snapshots(db, workspace_id)
