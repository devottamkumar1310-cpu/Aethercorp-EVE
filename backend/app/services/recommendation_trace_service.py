import uuid
from sqlalchemy.orm import Session
from app.models.recommendation_trace import RecommendationTrace
from app.models.recommendation_audit_event import RecommendationAuditEvent
from app.services.ai.prompt_injection_guard import PromptInjectionGuard
from app.services.ai.recommendation_validator import RecommendationValidator
from app.services.ai.recommendation_evidence_validator import RecommendationEvidenceValidator


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
        status: str = "GENERATED",
        evidence_snapshot: dict = None,
        # Provenance & Origin kwargs
        triggered_by_user_id: uuid.UUID = None,
        triggered_by_email: str = None,
        trigger_type: str = "SYSTEM_GENERATED",
        source_agent: str = None,
        created_from_query: bool = False,
        llm_provider: str = None,
        llm_model: str = None,
        llm_model_version: str = None,
        temperature: float = None,
        top_p: float = None,
        top_k: int = None,
        system_prompt_hash: str = None,
        raw_prompt: str = None,
        raw_response: str = None,
        response_timestamp=None,
        input_metrics: dict = None,
        business_rules: list = None,
        calculations: list = None,
        estimated_financial_impact: float = None,
    ) -> RecommendationTrace:
        """
        Creates and persists a detailed decision recommendation trace in the database.
        Phase 2 additions: confidence governance, evidence consistency validation, trust score.
        """
        snapshot = evidence_snapshot if evidence_snapshot is not None else metrics
        val_reason = None

        # 1. Prompt Injection Check
        if raw_prompt:
            is_injected, injection_reason = PromptInjectionGuard.detect(raw_prompt)
            if is_injected:
                status = "REJECTED"

        # 2. Trace Integrity Validation
        if status != "REJECTED":
            val_status, val_reason = RecommendationValidator.validate(
                confidence_score=confidence,
                evidence_snapshot=snapshot,
                action=action,
                reasoning_chain=reasoning,
                source_datasets=sources,
                input_metrics=input_metrics,
            )

            # If user generated, never default to VERIFIED/VALIDATED automatically without rules.
            # If it passed validation, we mark it VALIDATED.
            # If created from query and passes, maybe USER_PROMPTED but we'll use VALIDATED if true.
            if val_status == "REJECTED":
                status = "REJECTED"
            else:
                if created_from_query:
                    status = "USER_PROMPTED"
                else:
                    status = "VALIDATED"
        else:
            val_reason = injection_reason

        # 3. Confidence Governance
        evidence_count = len(evidence_snapshot or {})
        confidence_flag = "OK"
        if confidence > 0.85 and evidence_count < 2:
            confidence_flag = "HIGH_CONFIDENCE_WEAK_EVIDENCE"
        elif confidence < 0.4:
            confidence_flag = "LOW_CONFIDENCE"

        # 4. Evidence Consistency
        evidence_status, evidence_reason = RecommendationEvidenceValidator.validate(
            action=action,
            evidence_snapshot=snapshot,
            input_metrics=input_metrics,
        )

        # 5. (reserved for future pipeline step)

        # 6. Trust Score — composite 0-100 float
        evidence_quality = (
            30 if evidence_status == "SUPPORTED"
            else (15 if evidence_status == "PARTIALLY_SUPPORTED" else 0)
        )
        validation_pts = (
            25 if status == "VALIDATED"
            else (10 if status == "USER_PROMPTED" else 0)
        )
        confidence_pts = (
            20 if confidence_flag == "OK"
            else (5 if confidence_flag == "HIGH_CONFIDENCE_WEAK_EVIDENCE" else 10)
        )
        data_pts = (
            15 if evidence_count >= 5
            else (10 if evidence_count >= 3 else (5 if evidence_count >= 1 else 0))
        )
        prompt_pts = (
            10 if not created_from_query
            else (5 if status != "REJECTED" else 0)
        )
        trust_score = float(evidence_quality + validation_pts + confidence_pts + data_pts + prompt_pts)

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
            evidence_snapshot=snapshot,
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_email=triggered_by_email,
            trigger_type=trigger_type,
            source_agent=source_agent,
            created_from_query=created_from_query,
            llm_provider=llm_provider,
            llm_model=llm_model,
            llm_model_version=llm_model_version,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            system_prompt_hash=system_prompt_hash,
            raw_prompt=raw_prompt,
            raw_response=raw_response,
            response_timestamp=response_timestamp,
            input_metrics=input_metrics,
            business_rules=business_rules,
            calculations=calculations,
            estimated_financial_impact=estimated_financial_impact,
            # Phase 2 Hardening
            evidence_validation_status=evidence_status,
            evidence_validation_reason=evidence_reason,
            confidence_governance_flag=confidence_flag,
            trust_score=trust_score,
        )
        db.add(trace)
        db.flush()  # flush to get trace.id

        # Audit Events
        created_event = RecommendationAuditEvent(
            trace_id=trace.id,
            event_type="CREATED",
            user_id=triggered_by_user_id,
            details={"trigger_type": trigger_type},
        )
        db.add(created_event)

        status_event = RecommendationAuditEvent(
            trace_id=trace.id,
            event_type=status,
            user_id=triggered_by_user_id,
            details={"reason": val_reason} if val_reason else {},
        )
        db.add(status_event)

        db.commit()
        db.refresh(trace)
        return trace

