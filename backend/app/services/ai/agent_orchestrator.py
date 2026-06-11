import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.schemas.executive import ExecutiveSynthesisResult
from app.services.ai.executive_board import ExecutiveBoard
from app.core.dependency_container import container

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
        user_id: Optional[uuid.UUID] = None
    ) -> ExecutiveMessage:
        import datetime
        import time
        import logging
        from fastapi import HTTPException
        from app.core.telemetry import init_telemetry, get_telemetry, clear_telemetry
        logger = logging.getLogger("eve.services.ai.agent_orchestrator")

        telemetry_token = init_telemetry()
        start_time = time.time()
        coo_result = None
        
        try:
            # Delegate to multi-agent ExecutiveBoard execution
            coo_result = await self.board.run_board(
                db=db,
                org_id=org_id,
                question=question,
                mode=mode,
                user_id=user_id
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
                
            timestamp = datetime.datetime.utcnow().isoformat()
            
            logger.error(
                f"[AI COO ERROR] workspace_id={org_id} user_id={user_id} model=gemini-2.5-flash "
                f"error_type={error_type} timestamp={timestamp} error_msg={err_str}"
            )
            
            # Try falling back to local deterministic board analysis
            try:
                logger.info(f"Triggering deterministic board fallback analysis for workspace {org_id}")
                coo_result = self.board.generate_deterministic_fallback(db, org_id, question)
            except Exception as fallback_err:
                logger.critical(f"Deterministic fallback failed: {fallback_err}", exc_info=True)
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

        try:
            # 4. Resolve or create ExecutiveConversation
            if conversation_id:
                conversation = db.query(ExecutiveConversation).filter(
                    ExecutiveConversation.organization_id == org_id,
                    ExecutiveConversation.id == conversation_id
                ).first()
                if not conversation:
                    conversation = ExecutiveConversation(
                        organization_id=org_id,
                        title=question[:50] or "Executive Consultation"
                    )
                    db.add(conversation)
                    db.flush()
            else:
                conversation = ExecutiveConversation(
                    organization_id=org_id,
                    title=question[:50] or "Executive Consultation"
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
            clear_telemetry(telemetry_token)
