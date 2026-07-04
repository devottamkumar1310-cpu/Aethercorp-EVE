import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.recommendation_trace import RecommendationTrace
from app.core.security import get_required_workspace_id, require_workspace_role

router = APIRouter(prefix="/api/recommendations", tags=["Recommendation Traceability"])


# Pydantic Schemas
class RecommendationTraceResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    recommendation_type: str
    action: str
    confidence_score: float
    validation_status: str
    source_datasets: List[str]
    supporting_metrics: dict
    reasoning_chain: List[str]
    evidence_snapshot: dict
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[RecommendationTraceResponse])
def list_recommendation_traces(
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role = Depends(require_workspace_role("employee"))
):
    """
    List all recommendation audit traces for the active organization workspace.
    """
    traces = db.query(RecommendationTrace).filter(
        RecommendationTrace.organization_id == workspace_id
    ).order_by(RecommendationTrace.created_at.desc()).all()

    # Format created_at to string for clean JSON serialization
    res = []
    for t in traces:
        res.append(RecommendationTraceResponse(
            id=t.id,
            organization_id=t.organization_id,
            recommendation_type=t.recommendation_type,
            action=t.action,
            confidence_score=t.confidence_score,
            validation_status=t.validation_status,
            source_datasets=t.source_datasets,
            supporting_metrics=t.supporting_metrics,
            reasoning_chain=t.reasoning_chain,
            evidence_snapshot=t.evidence_snapshot if t.evidence_snapshot is not None else {},
            created_at=t.created_at.strftime("%Y-%m-%d")
        ))
    return res


@router.get("/{trace_id}", response_model=RecommendationTraceResponse)
def get_recommendation_trace(
    trace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    _role = Depends(require_workspace_role("employee"))
):
    """
    Get detailed audit trace for a specific decision recommendation.
    """
    trace = db.query(RecommendationTrace).filter(
        RecommendationTrace.id == trace_id,
        RecommendationTrace.organization_id == workspace_id
    ).first()

    if not trace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation trace not found inside this workspace."
        )

    return RecommendationTraceResponse(
        id=trace.id,
        organization_id=trace.organization_id,
        recommendation_type=trace.recommendation_type,
        action=trace.action,
        confidence_score=trace.confidence_score,
        validation_status=trace.validation_status,
        source_datasets=trace.source_datasets,
        supporting_metrics=trace.supporting_metrics,
        reasoning_chain=trace.reasoning_chain,
        evidence_snapshot=trace.evidence_snapshot if trace.evidence_snapshot is not None else {},
        created_at=trace.created_at.strftime("%Y-%m-%d")
    )
