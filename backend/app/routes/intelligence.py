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

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

@router.get("/health", response_model=HealthScoreResponse)
def get_health(db: Session = Depends(get_db)):
    return get_health_score(db)

@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
def get_executive_summary(db: Session = Depends(get_db)):
    return generate_summary(db)

@router.get("/risks", response_model=RiskResponse)
def get_risks(db: Session = Depends(get_db)):
    return detect_risks(db)

@router.get("/opportunities", response_model=OpportunityResponse)
def get_opportunities(db: Session = Depends(get_db)):
    return detect_opportunities(db)

@router.get("/trends", response_model=TrendsResponse)
def get_trends(db: Session = Depends(get_db)):
    return calculate_trends(db)

@router.get("/actions", response_model=ActionResponse)
def get_actions(db: Session = Depends(get_db)):
    return generate_actions(db)

@router.post("/snapshot", response_model=IntelligenceSnapshotResponse)
def create_intelligence_snapshot(db: Session = Depends(get_db)):
    return create_snapshot(db)

@router.get("/history", response_model=list[IntelligenceSnapshotResponse])
def get_snapshot_history(db: Session = Depends(get_db)):
    return get_recent_snapshots(db)
