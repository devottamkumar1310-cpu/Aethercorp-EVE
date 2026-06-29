import uuid
from sqlalchemy.orm import Session
from app.models.recommendation_trace import RecommendationTrace


class RecommendationTraceService:
    @staticmethod
    def create_trace(
        db: Session,
        org_id: uuid.UUID,
        rec_type: str,
        action: str,
        confidence: float,
        sources: list,
        metrics: dict,
        reasoning: list,
        status: str = "verified",
        evidence_snapshot: dict = None
    ) -> RecommendationTrace:
        """
        Creates and persists a detailed decision recommendation trace in the database.
        """
        snapshot = evidence_snapshot if evidence_snapshot is not None else metrics
        trace = RecommendationTrace(
            id=uuid.uuid4(),
            organization_id=org_id,
            recommendation_type=rec_type,
            action=action,
            confidence_score=confidence,
            validation_status=status,
            source_datasets=sources,
            supporting_metrics=metrics,
            reasoning_chain=reasoning,
            evidence_snapshot=snapshot
        )
        db.add(trace)
        db.commit()
        db.refresh(trace)
        return trace
