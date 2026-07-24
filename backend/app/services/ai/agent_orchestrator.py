import uuid
import time
import logging
import asyncio
from typing import Optional

logger = logging.getLogger("eve.services.ai.agent_orchestrator")
from sqlalchemy.orm import Session
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.schemas.executive import ExecutiveSynthesisResult
from app.services.ai.executive_board import ExecutiveBoard
from app.core.dependency_container import container
from app.services.ai.conversation_layer import ConversationLayer
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
        developer_mode: Optional[bool] = None,
        document_id: Optional[uuid.UUID] = None
    ) -> ExecutiveMessage:
        import datetime
        import time
        import logging
        from fastapi import HTTPException
        from app.core.telemetry import init_telemetry, get_telemetry, clear_telemetry
        from app.services.cost_governance_service import CostGovernanceService
        from app.config import settings
        
        logger = logging.getLogger("eve.services.ai.agent_orchestrator")

        if document_id:
            from app.models.document import ProcessedDocument
            doc = db.query(ProcessedDocument).filter(ProcessedDocument.id == document_id).first()
            if doc and doc.status == "success":
                # Create a concise summary of the document context to inject
                quality_val = doc.quality_assessment.get("quality_score", 100.0) if doc.quality_assessment else 100.0
                context_intro = (
                    f"[CONTEXT: USER ASKED A CONTEXTUAL QUESTION REGARDING DOCUMENT '{doc.filename}' "
                    f"(Type: {doc.document_type}, Quality Score: {quality_val})]\n"
                    f"Document Extracted Content:\n{doc.extracted_data}\n"
                    f"Document COO Strategic Insights:\n{doc.coo_insights}\n\n"
                    f"User Question: "
                )
                question = context_intro + question

        # 1. Route intent deterministically
        intent = ConversationLayer.classify_intent(question)
        is_static = ConversationLayer.is_static_intent(intent)

        # DIAGNOSTIC PRINTS FOR RUNTIME TRACE
        try:
            import re
            from app.services.ai.executive_formatter import ExecutiveFormatter
            q_clean = re.sub(r'[^\w\s]', '', question).strip().lower() if question else ""
            question_type = ExecutiveFormatter.get_question_type(question)
            
            is_working_capital_query = "working capital" in q_clean or "capital is tied up" in q_clean or "capital tied up" in q_clean or "capital tied" in q_clean
            is_biggest_risk_query = "biggest operational risk" in q_clean
            is_overstock_query = "overstock" in q_clean or "hurting inventory efficiency" in q_clean or "capital is trapped in slow" in q_clean or "capital is trapped" in q_clean
            is_reorder_query = "reorder" in q_clean or "need immediate attention" in q_clean or "what should i reorder" in q_clean or "skus are at risk" in q_clean or "sku at risk" in q_clean or "skus at risk" in q_clean
            is_spending_query = "spending" in q_clean
            is_profitability_query = ("profitability" in q_clean or "hurting profitability" in q_clean) and "inventory" not in q_clean
            is_inventory_profitability_query = ("profitability" in q_clean or "hurting profitability" in q_clean) and "inventory" in q_clean
            is_finance_summary_query = "finance summary" in q_clean
            is_client_risk_query = "clients are at risk" in q_clean or "clients at risk" in q_clean
            is_client_contact_query = "who should i contact" in q_clean
            is_client_revenue_query = "generate the most revenue" in q_clean or "generate most revenue" in q_clean
            is_client_inactive_query = "clients are inactive" in q_clean or "clients inactive" in q_clean
            is_project_delayed_query = (
                "projects are delayed" in q_clean or 
                "projects delayed" in q_clean or
                ("project" in q_clean and ("deadline" in q_clean or "passed" in q_clean or "overdue" in q_clean or "mitigate" in q_clean))
            )
            is_project_attention_query = "projects need attention" in q_clean
            is_project_deadlines_query = "deadlines are at risk" in q_clean or "deadlines at risk" in q_clean
            is_project_focus_query = "team focus" in q_clean or "operational priorities" in q_clean

            formatter_name = "ExecutiveFormatter.format_executive_response (LLM synthesis fallback)"
            if is_working_capital_query:
                formatter_name = "format_working_capital"
            elif is_biggest_risk_query:
                formatter_name = "get_biggest_operational_risk"
            elif is_overstock_query or is_inventory_profitability_query:
                formatter_name = "format_sku_overstock"
            elif is_reorder_query:
                formatter_name = "format_sku_reorders"
            elif is_spending_query:
                formatter_name = "format_finance_spending"
            elif is_profitability_query:
                formatter_name = "format_finance_profitability_leaks"
            elif is_finance_summary_query:
                formatter_name = "format_finance_summary"
            elif is_client_risk_query:
                formatter_name = "format_client_at_risk"
            elif is_client_contact_query:
                formatter_name = "format_client_outreach"
            elif is_client_revenue_query:
                formatter_name = "format_client_revenue"
            elif is_client_inactive_query:
                formatter_name = "format_client_inactive"
            elif is_project_delayed_query:
                formatter_name = "format_project_delayed"
            elif is_project_attention_query:
                formatter_name = "format_project_attention"
            elif is_project_deadlines_query:
                formatter_name = "format_project_deadlines_at_risk"
            elif is_project_focus_query:
                formatter_name = "format_project_weekly_focus"

            print("INTENT =", intent, flush=True)
            print("QUESTION_TYPE =", question_type, flush=True)
            print("ORCHESTRATOR =", "orchestrate", flush=True)
            print("FORMATTER =", formatter_name, flush=True)
            print("STREAMING =", False, flush=True)
            print("MOCK_MODE =", self.gemini_service.mock_mode, flush=True)
        except Exception as e:
            print("DIAGNOSTIC ERROR:", e, flush=True)

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
                # Strictly verify conversation belongs to caller's workspace
                valid_conv = db.query(ExecutiveConversation).filter(
                    ExecutiveConversation.id == conversation_id,
                    ExecutiveConversation.organization_id == org_id
                ).first()
                if not valid_conv:
                    conversation_id = None
                
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
                from app.models.organization import Organization
                workspace = db.query(Organization).filter(Organization.id == org_id).first()
                workspace_name = workspace.name if workspace else None
                scenario_type = workspace.scenario_type if workspace else None

                # Delegate to multi-agent ExecutiveBoard execution
                coo_result = await self.board.run_board(
                    db=db,
                    org_id=org_id,
                    question=question,
                    mode=mode,
                    user_id=user_id,
                    conversation_history=conversation_history,
                    intent=intent,
                    workspace_name=workspace_name,
                    scenario_type=scenario_type
                )
                # Stamp LLM provenance onto the result so it flows through model_dump()
                coo_result.llm_provider = "google"
                coo_result.llm_model = "gemini-2.5-flash"
                coo_result.llm_model_version = "gemini-2.5-flash-latest"
                coo_result.temperature = 1.0
                coo_result.top_k = 64
                coo_result.top_p = 0.95
                coo_result.response_timestamp = datetime.datetime.utcnow()
                coo_result.user_id = str(user_id) if user_id else None
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
                    
                timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
                
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
        # Clear generic executive board properties for inventory-specific and finance-specific queries
        if not is_static:
            q_clean = re.sub(r'[^\w\s]', '', question).strip().lower() if question else ""
            is_inventory_query = (
                q_clean in ["identify overstock risks", "which products are hurting inventory efficiency",
                            "suggest reorder quantities", "which products need immediate attention"] or
                "overstock risks" in q_clean or
                "hurting inventory efficiency" in q_clean or
                "reorder quantities" in q_clean or
                "need immediate attention" in q_clean
            )
            is_finance_query = (
                q_clean in ["where am i spending the most money", "what is hurting profitability",
                            "give me a finance summary"] or
                "spending the most money" in q_clean or
                "spending most money" in q_clean or
                "hurting profitability" in q_clean or
                "finance summary" in q_clean
            )
            is_client_query = (
                q_clean in ["which clients are at risk", "who should i contact this week",
                            "which clients generate the most revenue", "which clients are inactive"] or
                "clients are at risk" in q_clean or
                "who should i contact" in q_clean or
                "clients generate the most revenue" in q_clean or
                "clients generate most revenue" in q_clean or
                "clients are inactive" in q_clean
            )
            is_project_query = (
                q_clean in ["which projects are delayed", "which projects need attention",
                            "what deadlines are at risk", "what should my team focus on this week"] or
                "projects are delayed" in q_clean or
                "projects need attention" in q_clean or
                "deadlines are at risk" in q_clean or
                "deadlines at risk" in q_clean or
                "team focus on this week" in q_clean or
                "team focus this week" in q_clean or
                "what should my team focus on" in q_clean
            )
            if is_inventory_query or is_finance_query or is_client_query or is_project_query:
                coo_result.priorities = []
                coo_result.expected_impact = "N/A"

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
            coo_result.summary = ExecutiveFormatter.format_executive_response(coo_result, question, db=db, org_id=org_id)

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
                # Generate a professional, short title using LLM
                title = "Executive Consultation"
                if question and not is_static:
                    try:
                        short_q = question[:200]
                        title_prompt = (
                            f"Generate an extremely concise, professional 2-to-4 word title "
                            f"for an executive business consultation conversation that starts with this user query: '{short_q}'. "
                            f"Do NOT use quotes, punctuation, markdown, or any introductory phrases. Return ONLY the title text."
                        )
                        title_res = await self.gemini_service.generate_text(
                            prompt=title_prompt,
                            system_instruction="You are a professional business advisor. Generate short, professional chat titles.",
                            model="gemini-2.5-flash",
                            timeout=5.0
                        )
                        generated_title = title_res.strip().strip('"').strip("'").strip()
                        generated_title = re.sub(r'\.{2,}', '', generated_title).strip('.').strip()
                        if generated_title and len(generated_title) <= 50 and not generated_title.lower().startswith("generate"):
                            title = generated_title
                    except Exception as title_err:
                        logger.warning(f"Failed to generate LLM chat title: {title_err}. Falling back to word truncation.")
                        cleaned = re.sub(r'[^\w\s]', '', question)
                        words = cleaned.split()
                        title = " ".join([w.capitalize() for w in words[:5]]) + ("..." if len(words) > 5 else "") if words else "Executive Consultation"

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
            
            agent_data = coo_result.model_dump(mode="json")
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

    async def orchestrate_stream(
        self,
        db: Session,
        org_id: uuid.UUID,
        question: str,
        mode: str = "smart",
        conversation_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
        language: Optional[str] = "en",
        developer_mode: Optional[bool] = None,
        document_id: Optional[uuid.UUID] = None
    ):
        """
        Streams synthesized response chunk by chunk for ultra-fast first token delivery.
        """
        import json
        from app.services.ai.prompt_templates import COO_STREAMING_SYSTEM_PROMPT, build_context_block
        from app.services.business_health_service import get_health_score
        from app.services.ai.memory_service import get_memory_context
        
        time.time()
        print("STEP A - request received", flush=True)
        
        # 1. Intent Classifier & Data sufficiency check
        intent = ConversationLayer.classify_intent(question)
        is_static = ConversationLayer.is_static_intent(intent)
        print("STEP B - intent classified", flush=True)

        # DIAGNOSTIC PRINTS FOR RUNTIME TRACE
        try:
            import re
            from app.services.ai.executive_formatter import ExecutiveFormatter
            q_clean = re.sub(r'[^\w\s]', '', question).strip().lower() if question else ""
            question_type = ExecutiveFormatter.get_question_type(question)
            
            is_biggest_risk_query = "biggest operational risk" in q_clean
            is_overstock_query = "overstock" in q_clean or "hurting inventory efficiency" in q_clean or "capital is trapped in slow" in q_clean or "capital is trapped" in q_clean
            is_reorder_query = "reorder" in q_clean or "need immediate attention" in q_clean or "what should i reorder" in q_clean or "skus are at risk" in q_clean or "sku at risk" in q_clean or "skus at risk" in q_clean
            is_spending_query = "spending" in q_clean
            is_profitability_query = ("profitability" in q_clean or "hurting profitability" in q_clean) and "inventory" not in q_clean
            is_inventory_profitability_query = ("profitability" in q_clean or "hurting profitability" in q_clean) and "inventory" in q_clean
            is_finance_summary_query = "finance summary" in q_clean
            is_client_risk_query = "clients are at risk" in q_clean or "clients at risk" in q_clean
            is_client_contact_query = "who should i contact" in q_clean
            is_client_revenue_query = "generate the most revenue" in q_clean or "generate most revenue" in q_clean
            is_client_inactive_query = "clients are inactive" in q_clean or "clients inactive" in q_clean
            is_project_delayed_query = (
                "projects are delayed" in q_clean or 
                "projects delayed" in q_clean or
                ("project" in q_clean and ("deadline" in q_clean or "passed" in q_clean or "overdue" in q_clean or "mitigate" in q_clean))
            )
            is_project_attention_query = "projects need attention" in q_clean
            is_project_deadlines_query = "deadlines are at risk" in q_clean or "deadlines at risk" in q_clean
            is_project_focus_query = "team focus" in q_clean or "operational priorities" in q_clean

            formatter_name = "ExecutiveFormatter.format_executive_response (LLM synthesis fallback)"
            if is_biggest_risk_query:
                formatter_name = "get_biggest_operational_risk"
            elif is_overstock_query or is_inventory_profitability_query:
                formatter_name = "format_sku_overstock"
            elif is_reorder_query:
                formatter_name = "format_sku_reorders"
            elif is_spending_query:
                formatter_name = "format_finance_spending"
            elif is_profitability_query:
                formatter_name = "format_finance_profitability_leaks"
            elif is_finance_summary_query:
                formatter_name = "format_finance_summary"
            elif is_client_risk_query:
                formatter_name = "format_client_at_risk"
            elif is_client_contact_query:
                formatter_name = "format_client_outreach"
            elif is_client_revenue_query:
                formatter_name = "format_client_revenue"
            elif is_client_inactive_query:
                formatter_name = "format_client_inactive"
            elif is_project_delayed_query:
                formatter_name = "format_project_delayed"
            elif is_project_attention_query:
                formatter_name = "format_project_attention"
            elif is_project_deadlines_query:
                formatter_name = "format_project_deadlines_at_risk"
            elif is_project_focus_query:
                formatter_name = "format_project_weekly_focus"

            print("INTENT =", intent, flush=True)
            print("QUESTION_TYPE =", question_type, flush=True)
            print("ORCHESTRATOR =", "orchestrate_stream", flush=True)
            print("FORMATTER =", formatter_name, flush=True)
            print("STREAMING =", True, flush=True)
            print("MOCK_MODE =", self.gemini_service.mock_mode, flush=True)
        except Exception as e:
            print("DIAGNOSTIC ERROR:", e, flush=True)

        # 1.5 Evaluate is_deterministic early
        from app.services.ai.executive_formatter import ExecutiveFormatter
        q_clean = re.sub(r'[^\w\s]', '', question).strip().lower() if question else ""
        is_deterministic = (
            "working capital" in q_clean or "capital is tied up" in q_clean or "capital tied up" in q_clean or "capital tied" in q_clean or
            "biggest operational risk" in q_clean or
            "overstock" in q_clean or "hurting inventory efficiency" in q_clean or
            "capital is trapped in slow" in q_clean or "capital is trapped" in q_clean or
            "profitability" in q_clean or "hurting profitability" in q_clean or
            "reorder" in q_clean or "need immediate attention" in q_clean or
            "what should i reorder" in q_clean or "skus are at risk" in q_clean or
            "sku at risk" in q_clean or "skus at risk" in q_clean or
            "spending" in q_clean or
            "finance summary" in q_clean or
            "clients are at risk" in q_clean or "clients at risk" in q_clean or
            "who should i contact" in q_clean or
            "generate the most revenue" in q_clean or "generate most revenue" in q_clean or
            "clients are inactive" in q_clean or "clients inactive" in q_clean or
            "projects are delayed" in q_clean or "projects delayed" in q_clean or
            ("project" in q_clean and ("deadline" in q_clean or "passed" in q_clean or
             "overdue" in q_clean or "mitigate" in q_clean)) or
            "projects need attention" in q_clean or
            "deadlines are at risk" in q_clean or "deadlines at risk" in q_clean or
            "team focus" in q_clean or "operational priorities" in q_clean
        )
        print("STEP C - deterministic check", flush=True)
        print(f"is_deterministic = {is_deterministic}", flush=True)
        
        # 2. Resolve or create ExecutiveConversation
        if conversation_id:
            conversation = db.query(ExecutiveConversation).filter(
                ExecutiveConversation.organization_id == org_id,
                ExecutiveConversation.id == conversation_id
            ).first()
        else:
            conversation = None

        if not conversation:
            # Fast, local title generation (never blocks)
            title = "Executive Consultation"
            if question and not is_static:
                cleaned_title = re.sub(r'[^\w\s]', '', question)
                words = cleaned_title.split()
                title = " ".join([w.capitalize() for w in words[:4]]) + ("..." if len(words) > 4 else "") if words else "Executive Consultation"

            conversation = ExecutiveConversation(organization_id=org_id, title=title)
            db.add(conversation)
            db.flush()

        # Save user message
        user_msg = ExecutiveMessage(conversation_id=conversation.id, role="user", content=question)
        db.add(user_msg)
        db.commit()

        yield json.dumps({"type": "meta", "conversation_id": str(conversation.id), "title": conversation.title}) + "\n"

        if is_static:
            static_res = ConversationLayer.handle_static_intent(intent, language or "en", question)
            for chunk in static_res.summary.split(" "):
                yield json.dumps({"type": "token", "content": chunk + " "}) + "\n"
                await asyncio.sleep(0.02)
            
            # Save assistant static response
            assistant_msg = ExecutiveMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=static_res.summary,
                agent_data=static_res.model_dump()
            )
            db.add(assistant_msg)
            db.commit()
            yield json.dumps({"type": "done"}) + "\n"
            return

        # If deterministic or mock mode, skip ALL LLM sub-agent calls and go straight to formatter
        if self.gemini_service.mock_mode or is_deterministic:
            if is_deterministic:
                logger.info("Deterministic query detected in stream. Bypassing ALL LLM calls.")
            else:
                logger.info("Gemini mock/depleted mode. Skipping sub-agents, using deterministic stream.")

            coo_result = self.board.generate_deterministic_fallback(db, org_id, question)

            print("STEP F - formatter", flush=True)
            markdown_content = ExecutiveFormatter.format_executive_response(
                coo_result, question, db=db, org_id=org_id
            )

            if self.gemini_service.mock_mode and not is_deterministic:
                markdown_content += "\n\n*Note: EVE is running in local deterministic reasoning mode (AI service offline).*"

            # Stream formatted content chunk by chunk
            print("STEP G - first token", flush=True)
            for i in range(0, len(markdown_content), 10):
                chunk = markdown_content[i:i+10]
                yield json.dumps({"type": "token", "content": chunk}) + "\n"
                await asyncio.sleep(0.01)

            # Save assistant message
            assistant_msg = ExecutiveMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=markdown_content,
                agent_data=coo_result.model_dump()
            )
            db.add(assistant_msg)
            db.commit()
            yield json.dumps({"type": "done"}) + "\n"
            return

        # --- NON-DETERMINISTIC LLM PATH (Gemini live) ---
        print("STEP D - db fetch", flush=True)

        # Pre-fetch database indicators to inject context
        health = get_health_score(db, org_id)
        goals = get_memory_context(db, org_id)

        inventory_intel = None
        business_health_score = int(health.get("score", 80))
        risk_count = 0
        opportunity_count = 0
        revenue_at_risk = 0.0
        working_capital_locked = 0.0
        
        try:
            from app.services.analytics_service import AnalyticsService
            inv_analysis = AnalyticsService.get_inventory_analysis(db, org_id)
            items_at_risk = inv_analysis.get("items_at_risk", [])
            revenue_at_risk = sum(item.get("revenue_at_risk", 0.0) for item in items_at_risk)
            working_capital_locked = sum(item.get("working_capital_locked", 0.0) for item in items_at_risk)
            risk_count = len(inv_analysis.get("top_risks", []))
            opportunity_count = len(inv_analysis.get("top_opportunities", []))
            business_health_score = inv_analysis.get("business_health_score", business_health_score)
            inventory_intel = {
                "business_health_score": business_health_score,
                "revenue_at_risk": revenue_at_risk,
                "working_capital_locked": working_capital_locked,
                "stockout_skus": inv_analysis.get("out_of_stock_skus", 0) + inv_analysis.get("low_stock_skus", 0),
                "top_actions": inv_analysis.get("top_actions", []),
                "risk_count": risk_count,
                "opportunity_count": opportunity_count
            }
        except Exception as e:
            logger.error(f"Failed to fetch inventory analytics in orchestrate_stream: {e}")

        try:
            from app.models.organization import Organization
            workspace = db.query(Organization).filter(Organization.id == org_id).first()
            workspace_name = workspace.name if workspace else None
            scenario_type = workspace.scenario_type if workspace else None
        except Exception:
            workspace_name = None
            scenario_type = None

        context_block = build_context_block(
            health=health,
            goals=goals,
            inventory_intel=inventory_intel,
            workspace_name=workspace_name,
            scenario_type=scenario_type
        )

        # Build sub-agent analysis summary blocks to inject as COO context
        # Only runs when Gemini is live AND query is non-deterministic
        print("STEP E - agent dispatch", flush=True)
        sub_agent_reports = []
        if mode == "full" or intent in ["Finance Query", "Pricing Query", "Sales Query"]:
            from app.services.ai.finance_agent import FinanceAgent
            finance_agent = FinanceAgent(self.gemini_service)
            finance_result = await finance_agent.analyze(db, org_id, question)
            sub_agent_reports.append(f"Finance Agent summary: {finance_result.summary}\nFindings: {finance_result.findings}")
        if mode == "full" or intent in ["Inventory Query", "Supply Chain Query"]:
            from app.services.ai.inventory_agent import InventoryAgent
            inventory_agent = InventoryAgent(self.gemini_service)
            inventory_result = await inventory_agent.analyze(db, org_id, question)
            sub_agent_reports.append(f"Inventory Agent summary: {inventory_result.summary}\nFindings: {inventory_result.findings}")
        if mode == "full" or intent in ["Projects Query", "Tasks Query", "Operations Query", "Technical Query", "Supply Chain Query"]:
            from app.services.ai.operations_agent import OperationsAgent
            ops_agent = OperationsAgent(self.gemini_service)
            ops_result = await ops_agent.analyze(db, org_id, question)
            sub_agent_reports.append(f"Operations Agent summary: {ops_result.summary}\nFindings: {ops_result.findings}")
            
        reports_block = "\n".join(sub_agent_reports)

        # Reconstruct recent conversation history block if available
        history_block = ""
        if conversation:
            history_msgs = db.query(ExecutiveMessage).filter(
                ExecutiveMessage.conversation_id == conversation.id
            ).order_by(ExecutiveMessage.created_at.desc()).limit(6).all()
            history_msgs.reverse()
            history_lines = []
            for msg in history_msgs:
                role_label = "Founder" if msg.role == "user" else "EVE COO"
                history_lines.append(f"{role_label}: {msg.content}")
            if history_lines:
                history_block = "\n=== RECENT CONVERSATION HISTORY ===\n" + "\n".join(history_lines) + "\n====================================\n"

        prompt = f"""
        {history_block}
        User Question/Goal: {question}
        
        Current Overall Business Health & Goals:
        {context_block}
        
        Reports from Specialized Sub-Agents:
        {reports_block or "No specialized sub-agent analysis executed for this query."}
        """

        full_content = []
        print("STEP F - formatter", flush=True)
        print("STEP G - first token", flush=True)
        async for chunk in self.gemini_service.generate_text_stream(
            prompt=prompt,
            system_instruction=COO_STREAMING_SYSTEM_PROMPT
        ):
            full_content.append(chunk)
            yield json.dumps({"type": "token", "content": chunk}) + "\n"

        full_text = "".join(full_content)

        # Post-process translations if language is Hindi
        if language == "hi":
            # Translate dynamic content to Hindi
            translated_text = await LocalizationService.translate_explanation(full_text, "hi", self.gemini_service)
            yield json.dumps({"type": "translate", "content": translated_text}) + "\n"
            full_text = translated_text

        # Create structured response model object to save in DB for SNAP reasoning detail visibility
        from app.schemas.executive import StrategicPriority
        
        # Build priority parsing from output
        priorities = []
        priority_matches = re.findall(r"-\s+\*\*Priority\s+\d+:\s*(.*?)\*\*\s*—\s*(.*)", full_text)
        for title, desc in priority_matches[:3]:
            data_source = None
            calculation = None
            business_object = None
            desc_clean = desc
            evidence_match = re.search(r"\[Source:\s*(.*?)\s*\|\s*Calc:\s*(.*?)\s*\|\s*Object:\s*(.*?)\]", desc)
            if evidence_match:
                data_source = evidence_match.group(1).strip()
                calculation = evidence_match.group(2).strip()
                business_object = evidence_match.group(3).strip()
                desc_clean = desc[:evidence_match.start()].strip()
            priorities.append(StrategicPriority(
                title=title.strip(),
                description=desc_clean,
                data_source=data_source,
                calculation=calculation,
                business_object=business_object
            ))

        # Apply evidence-only audit to parsed priorities
        from app.orchestration.validator import ExecutiveGovernanceValidator
        priorities = ExecutiveGovernanceValidator.audit_recommendations_evidence(priorities, db, org_id)

        # Extract confidence and expected impact from full_text if possible, or fall back
        confidence_val = 0.95
        confidence_match = re.search(r"Recommendation Confidence:\s*(\d+)%", full_text)
        if confidence_match:
            confidence_val = float(confidence_match.group(1)) / 100.0

        expected_impact_val = "Optimize operational margins and reduce stockout risk."
        impact_match = re.search(r"### 📈 Expected Impact\n(.*)", full_text)
        if impact_match:
            expected_impact_val = impact_match.group(1).strip()

        if not priorities:
            if inventory_intel and inventory_intel.get("top_actions"):
                actions = inventory_intel["top_actions"]
                priorities = [
                    StrategicPriority(title=actions[0][:40], description=actions[0]),
                    StrategicPriority(title=actions[1][:40] if len(actions) > 1 else "Replenish Safety Stock", description=actions[1] if len(actions) > 1 else "Trigger immediate reorders for high-priority stockout risks."),
                    StrategicPriority(title=actions[2][:40] if len(actions) > 2 else "Review Supplier Costs", description=actions[2] if len(actions) > 2 else "Assess supplier overhead inflation and adjust pricing.")
                ]
            else:
                priorities = [
                    StrategicPriority(title="Audit Pricing Model", description="Audit price points on low-margin products to eliminate margin drag."),
                    StrategicPriority(title="Replenish Safety Stock", description="Trigger immediate reorders for high-priority stockout risks."),
                    StrategicPriority(title="Review Supplier Costs", description="Assess supplier overhead inflation and adjust pricing.")
                ]

        coo_result = ExecutiveSynthesisResult(
            agent="COO Lead",
            summary=full_text,
            priorities=priorities,
            expected_impact=expected_impact_val,
            confidence_scores={"Overall": confidence_val},
            confidence_category="High Confidence" if confidence_val >= 0.8 else "Medium Confidence",
            risk_classification="High Risk" if "high risk" in full_text.lower() or "critical" in full_text.lower() else "Low Risk",
            evidence_used={
                "business_health_score": business_health_score,
                "risk_count": risk_count,
                "opportunity_count": opportunity_count,
                "revenue_at_risk": revenue_at_risk,
                "working_capital_locked": working_capital_locked
            }
        )
        # Stamp LLM provenance on the streaming-path result
        import datetime as _dt
        coo_result.llm_provider = "google"
        coo_result.llm_model = "gemini-2.5-flash"
        coo_result.llm_model_version = "gemini-2.5-flash-latest"
        coo_result.temperature = 1.0
        coo_result.top_k = 64
        coo_result.top_p = 0.95
        coo_result.response_timestamp = _dt.datetime.utcnow()
        coo_result.user_id = str(user_id) if user_id else None

        # Save assistant message
        assistant_msg = ExecutiveMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=full_text,
            agent_data=coo_result.model_dump(mode="json")
        )
        db.add(assistant_msg)
        db.commit()
        
        yield json.dumps({"type": "done"}) + "\n"
