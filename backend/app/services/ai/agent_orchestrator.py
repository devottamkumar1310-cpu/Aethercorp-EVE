import uuid
import re
import time
from typing import Optional
from sqlalchemy.orm import Session
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.schemas.executive import ExecutiveSynthesisResult
from app.services.ai.executive_board import ExecutiveBoard
from app.core.dependency_container import container
from app.services.ai.conversation_layer import ConversationLayer
from app.services.ai.executive_formatter import ExecutiveFormatter
from app.services.localization.translator import LocalizationService
from app.services.audit_logger import AuditLogger

class AgentOrchestrator:
    def __init__(self, gemini_service=None):
        self.gemini_service = gemini_service or container.get("gemini_service")
        self.board = ExecutiveBoard(self.gemini_service)

    async def orchestrate(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str,
        mode: str = "smart",
        conversation_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
        language: Optional[str] = "en",
        developer_mode: Optional[bool] = None
    ) -> ExecutiveMessage:
        import datetime
        import time
        import logging
        from fastapi import HTTPException
        from app.core.telemetry import init_telemetry, get_telemetry, clear_telemetry
        from app.services.cost_governance_service import CostGovernanceService
        from app.config import settings
        
        logger = logging.getLogger("eve.services.ai.agent_orchestrator")

        # 1. Route intent deterministically
        intent = ConversationLayer.classify_intent(question)
        is_static = ConversationLayer.is_static_intent(intent)

        # Detect language
        target_lang = "en"
        # We can extract language if passed in request or auto-detect if Devanagari characters are present
        if re.search(r"[\u0900-\u097f]", question):
            target_lang = "hi"

        start_time = time.time()
        coo_result = None
        telemetry_token = None
        
        if is_static:
            # Bypass LLM and return static response instantly (<100ms greeting latency!)
            coo_result = ConversationLayer.handle_static_intent(intent, target_lang, question)
            # Log rewrite and intent detection with commit=False to batch transactions
            AuditLogger.log(
                db=db,
                event_type="conversation_intent_detected",
                status="success",
                organization_id=org_id,
                message=f"Intent detected: {intent}",
                metadata_json={"intent": intent, "question": question},
                commit=False
            )
            AuditLogger.log(
                db=db,
                event_type="response_rewrite_applied",
                status="success",
                organization_id=org_id,
                message=f"Static intent template response applied for: {intent} in {target_lang}",
                commit=False
            )
        else:
            # Runaway usage budget safeguard limit check (only for non-static LLM execution)
            daily_limit = getattr(settings, "DAILY_ORG_AI_BUDGET", 2.0)
            daily_spent = CostGovernanceService.get_daily_cost(db, org_id)
            if daily_spent >= daily_limit:
                logger.warning(f"AI execution blocked for org {org_id}: spent ${daily_spent:.2f} >= limit ${daily_limit:.2f}")
                raise HTTPException(
                    status_code=402,
                    detail=f"Runaway usage safeguard: Organization daily AI budget limit of ${daily_limit:.2f} exceeded (spent today: ${daily_spent:.2f})."
                )

            AuditLogger.log(
                db=db,
                event_type="conversation_intent_detected",
                status="success",
                organization_id=org_id,
                message=f"Intent detected: {intent}",
                metadata_json={"intent": intent, "question": question},
                commit=False
            )

            conversation_history = []
            if conversation_id:
                history_msgs = db.query(ExecutiveMessage).filter(
                    ExecutiveMessage.conversation_id == conversation_id
                ).order_by(ExecutiveMessage.created_at.desc()).limit(6).all()
                history_msgs.reverse()
                conversation_history = [
                    {"role": m.role, "content": m.content} for m in history_msgs
                ]

            telemetry_token = init_telemetry()
            try:
                # Delegate to multi-agent ExecutiveBoard execution
                coo_result = await self.board.run_board(
                    db=db,
                    org_id=org_id,
                    question=question,
                    mode=mode,
                    user_id=user_id,
                    conversation_history=conversation_history
                )
            except Exception as e:
                err_str = str(e)
                error_type = "GENERIC_ERROR"
                status_code = 500
                
                # Map exception strings to clear governance error categories
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "rate limit" in err_str.lower():
                    error_type = "RESOURCE_EXHAUSTED"
                    status_code = 429
                elif "Timeout" in err_str or "timed out" in err_str or "deadline exceeded" in err_str.lower():
                    error_type = "TIMEOUT"
                    status_code = 504
                elif "Gemini" in err_str or "API_KEY" in err_str or "API key" in err_str:
                    error_type = "GEMINI_ERROR"
                    status_code = 503
                elif "network" in err_str.lower() or "connection" in err_str.lower() or "http" in err_str.lower():
                    error_type = "NETWORK_ERROR"
                    status_code = 502
                    
                timestamp = datetime.datetime.utcnow().isoformat()
                
                logger.error(
                    f"[AI COO ERROR] workspace_id={org_id} user_id={user_id} model=gemini-2.5-flash "
                    f"error_type={error_type} timestamp={timestamp} error_msg={err_str}"
                )
                
                # Log AI failure to the Database SystemError table for governance transparency
                from app.services.error_monitoring_service import ErrorMonitoringService
                ErrorMonitoringService.log_error(
                    db=db,
                    component="agent_orchestrator",
                    error_type=error_type,
                    message=f"Gemini agent board invocation failed: {err_str}",
                    org_id=org_id,
                    metadata_json={"user_id": str(user_id) if user_id else None, "mode": mode, "question": question}
                )
                
                # Log conversation fallback triggered to AuditLog
                AuditLogger.log(
                    db=db,
                    event_type="conversation_fallback_triggered",
                    status="success",
                    organization_id=org_id,
                    message=f"Gemini board failed, triggered local deterministic fallback logic: {err_str}"
                )

                # Try falling back to local deterministic board analysis
                try:
                    logger.info(f"Triggering deterministic board fallback analysis for workspace {org_id}")
                    coo_result = self.board.generate_deterministic_fallback(db, org_id, question)
                except Exception as fallback_err:
                    logger.critical(f"Deterministic fallback failed: {fallback_err}", exc_info=True)
                    ErrorMonitoringService.log_error(
                        db=db,
                        component="agent_orchestrator",
                        error_type="FALLBACK_ERROR",
                        message=f"Deterministic governance fallback failed: {str(fallback_err)}",
                        org_id=org_id
                    )
                    detail_msg = "An unexpected error occurred."
                    if error_type == "RESOURCE_EXHAUSTED":
                        detail_msg = "EVE is temporarily busy. Please retry in a few moments."
                    elif error_type == "TIMEOUT":
                        detail_msg = "Request timed out. Please try again."
                    elif error_type == "GEMINI_ERROR":
                        detail_msg = "AI analysis is temporarily unavailable."
                    elif error_type == "NETWORK_ERROR":
                        detail_msg = "Network connectivity issue. Please check connection."
                    
                    raise HTTPException(
                        status_code=status_code,
                        detail=detail_msg
                    )

        # --- POST-PROCESS & REWRITE LAYER ---
        # 1. Audit logs for data sufficiency / hallucination blocks
        if not is_static:
            if "insufficient" in coo_result.summary.lower() or "no business data" in coo_result.summary.lower():
                AuditLogger.log(
                    db=db,
                    event_type="data_sufficiency_failure",
                    status="success",
                    organization_id=org_id,
                    message=f"Data sufficiency check failed: {coo_result.summary}"
                )
            elif "hallucination" in coo_result.summary.lower() or "could not be verified" in coo_result.summary.lower():
                AuditLogger.log(
                    db=db,
                    event_type="hallucination_guardrail_triggered",
                    status="success",
                    organization_id=org_id,
                    message=f"Hallucination guardrail triggered: {coo_result.summary}"
                )

        # 2. Build structured recommendation details model
        rec_details = ExecutiveFormatter.build_executive_recommendation(coo_result, question)
        coo_result.recommendation_details = rec_details

        # 3. Format output to follow the 4-part Executive Communication Order
        if not is_static:
            coo_result.summary = ExecutiveFormatter.format_executive_response(coo_result, question)

        # 4. Handle language translation ( Hindi / Spanish / French / German )
        if target_lang != "en":
            # Translate summary
            coo_result.summary = await LocalizationService.translate_explanation(
                coo_result.summary, target_lang, self.gemini_service
            )
            # Translate expected impact
            coo_result.expected_impact = await LocalizationService.translate_explanation(
                coo_result.expected_impact, target_lang, self.gemini_service
            )
            # Translate recommendation details
            rec_details.recommendation = await LocalizationService.translate_explanation(
                rec_details.recommendation, target_lang, self.gemini_service
            )
            rec_details.expected_impact = await LocalizationService.translate_explanation(
                rec_details.expected_impact, target_lang, self.gemini_service
            )
            for idx in range(len(rec_details.evidence)):
                rec_details.evidence[idx] = await LocalizationService.translate_explanation(
                    rec_details.evidence[idx], target_lang, self.gemini_service
                )
            for idx in range(len(rec_details.assumptions)):
                rec_details.assumptions[idx] = await LocalizationService.translate_explanation(
                    rec_details.assumptions[idx], target_lang, self.gemini_service
                )
                
            # Translate priorities
            for p in coo_result.priorities:
                p.title = await LocalizationService.translate_explanation(p.title, target_lang, self.gemini_service)
                p.description = await LocalizationService.translate_explanation(p.description, target_lang, self.gemini_service)
            
            # Log translation applied
            AuditLogger.log(
                db=db,
                event_type="response_rewrite_applied",
                status="success",
                organization_id=org_id,
                message=f"Applied translation rewrite to dynamic analysis fields for lang: {target_lang}"
            )

        try:
            # 4. Resolve or create ExecutiveConversation
            if conversation_id:
                conversation = db.query(ExecutiveConversation).filter(
                    ExecutiveConversation.organization_id == org_id,
                    ExecutiveConversation.id == conversation_id
                ).first()
            else:
                conversation = None

            if not conversation:
                # Generate a lightweight title from the first user message
                cleaned = re.sub(r'[^\w\s]', '', question)
                words = cleaned.split()
                if words:
                    title_words = [w.capitalize() for w in words[:5]]
                    title = " ".join(title_words)
                    if len(words) > 5:
                        title += "..."
                else:
                    title = "Executive Consultation"

                conversation = ExecutiveConversation(
                    organization_id=org_id,
                    title=title
                )
                db.add(conversation)
                db.flush()

            # 5. Persist messages history
            user_message = ExecutiveMessage(
                conversation_id=conversation.id,
                role="user",
                content=question
            )
            db.add(user_message)
            
            # Compile telemetry details
            latency_ms = int((time.time() - start_time) * 1000)
            telemetry = get_telemetry()
            
            agent_data = coo_result.model_dump()
            agent_data["telemetry"] = {
                "prompt_tokens": telemetry.get("prompt_tokens", 0),
                "completion_tokens": telemetry.get("completion_tokens", 0),
                "total_tokens": telemetry.get("prompt_tokens", 0) + telemetry.get("completion_tokens", 0),
                "estimated_cost": round(telemetry.get("token_cost", 0.0), 6),
                "latency_ms": latency_ms,
                "agents": telemetry.get("agents", {})
            }
            
            assistant_message = ExecutiveMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=coo_result.summary,
                agent_data=agent_data
            )
            db.add(assistant_message)
            
            db.commit()
            db.refresh(assistant_message)
            
            return assistant_message
        finally:
            if telemetry_token is not None:
                clear_telemetry(telemetry_token)
