import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import datetime

from app.database import get_db
from app.models.recommendation_trace import RecommendationTrace
from app.models.recommendation_audit_event import RecommendationAuditEvent
from app.core.security import get_required_workspace_id, require_workspace_role
from app.models.organization import Membership

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

    # Origin
    triggered_by_user_id: Optional[uuid.UUID] = None
    triggered_by_email: Optional[str] = None
    trigger_type: Optional[str] = None
    source_agent: Optional[str] = None
    created_from_query: Optional[bool] = None

    # Provenance
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    llm_model_version: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    # PROTECTED FIELDS — admin/owner only
    system_prompt_hash: Optional[str] = None
    raw_prompt: Optional[str] = None
    raw_response: Optional[str] = None
    response_timestamp: Optional[datetime.datetime] = None

    # Structural
    input_metrics: Optional[dict] = None
    business_rules: Optional[List[str]] = None
    calculations: Optional[List[str]] = None
    priority: Optional[str] = None
    related_skus: Optional[List[str]] = None
    estimated_financial_impact: Optional[float] = None

    # Phase 2 Hardening
    evidence_validation_status: Optional[str] = None
    evidence_validation_reason: Optional[str] = None
    confidence_governance_flag: Optional[str] = None
    trust_score: Optional[float] = None

    class Config:
        from_attributes = True



def is_privileged_role(membership: Membership) -> bool:
    """Return True for roles that may view protected LLM provenance fields."""
    return membership.role in ("admin", "owner")


@router.get("", response_model=List[RecommendationTraceResponse])
def list_recommendation_traces(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    membership: Membership = Depends(require_workspace_role("employee"))
):
    """
    List all recommendation audit traces for the active organization workspace.
    """
    traces = db.query(RecommendationTrace).filter(
        RecommendationTrace.organization_id == workspace_id
    ).order_by(RecommendationTrace.created_at.desc()).offset(offset).limit(limit).all()

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
            created_at=t.created_at.strftime("%Y-%m-%d"),
            triggered_by_user_id=t.triggered_by_user_id,
            triggered_by_email=t.triggered_by_email,
            trigger_type=t.trigger_type,
            source_agent=t.source_agent,
            created_from_query=t.created_from_query,
            llm_provider=t.llm_provider,
            llm_model=t.llm_model,
            llm_model_version=t.llm_model_version,
            temperature=t.temperature,
            top_p=t.top_p,
            top_k=t.top_k,
            system_prompt_hash=t.system_prompt_hash if is_privileged_role(membership) else None,
            raw_prompt=t.raw_prompt if is_privileged_role(membership) else None,
            raw_response=t.raw_response if is_privileged_role(membership) else None,
            response_timestamp=t.response_timestamp,
            input_metrics=t.input_metrics,
            business_rules=t.business_rules,
            calculations=t.calculations,
            priority=t.priority,
            related_skus=t.related_skus,
            estimated_financial_impact=t.estimated_financial_impact,
            evidence_validation_status=t.evidence_validation_status,
            evidence_validation_reason=t.evidence_validation_reason,
            confidence_governance_flag=t.confidence_governance_flag,
            trust_score=t.trust_score,
        ))
    return res


@router.get("/{trace_id}", response_model=RecommendationTraceResponse)
def get_recommendation_trace(
    trace_id: uuid.UUID,
    db: Session = Depends(get_db),
    workspace_id: uuid.UUID = Depends(get_required_workspace_id),
    membership: Membership = Depends(require_workspace_role("employee"))
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

    # Emit view audit event
    view_event = RecommendationAuditEvent(
        trace_id=trace.id,
        event_type="VIEWED"
    )
    db.add(view_event)
    db.commit()

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
        created_at=trace.created_at.strftime("%Y-%m-%d"),
        triggered_by_user_id=trace.triggered_by_user_id,
        triggered_by_email=trace.triggered_by_email,
        trigger_type=trace.trigger_type,
        source_agent=trace.source_agent,
        created_from_query=trace.created_from_query,
        llm_provider=trace.llm_provider,
        llm_model=trace.llm_model,
        llm_model_version=trace.llm_model_version,
        temperature=trace.temperature,
        top_p=trace.top_p,
        top_k=trace.top_k,
        system_prompt_hash=trace.system_prompt_hash if is_privileged_role(membership) else None,
        raw_prompt=trace.raw_prompt if is_privileged_role(membership) else None,
        raw_response=trace.raw_response if is_privileged_role(membership) else None,
        response_timestamp=trace.response_timestamp,
        input_metrics=trace.input_metrics,
        business_rules=trace.business_rules,
        calculations=trace.calculations,
        priority=trace.priority,
        related_skus=trace.related_skus,
        estimated_financial_impact=trace.estimated_financial_impact,
        evidence_validation_status=trace.evidence_validation_status,
        evidence_validation_reason=trace.evidence_validation_reason,
        confidence_governance_flag=trace.confidence_governance_flag,
        trust_score=trace.trust_score,
    )
