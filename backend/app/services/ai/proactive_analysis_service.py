import logging
import uuid
import asyncio
import datetime
from collections import Counter
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.ai.agent_orchestrator import AgentOrchestrator
from app.models.organization import Organization
from app.models.recommendation_trace import RecommendationTrace

logger = logging.getLogger("eve.services.ai.proactive_analysis")

class ProactiveAnalysisService:
    @staticmethod
    def _update_status(
        db: Session,
        org_id: uuid.UUID,
        status: str,
        step: int,
        error: str = None,
        rec_count: int = 0,
        primary_type: str = None,
    ):
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if org:
            org.analysis_status = {
                "status": status,
                "step": step,
                "error": error,
                "recommendations_count": rec_count,
                # Dominant recommendation_type of this run, so the client can send
                # the user to the surface where the result is actionable rather
                # than to the audit trail. None when the run produced nothing.
                "primary_type": primary_type,
            }
            db.commit()

    @staticmethod
    async def generate_baseline_recommendations_async(org_id: uuid.UUID, user_id: uuid.UUID = None):
        """
        Background task to perform initial business intelligence analysis.
        To be used with FastAPI BackgroundTasks which natively supports async functions.
        """
        logger.info(f"[PROACTIVE ANALYSIS] Starting background analysis for Org {org_id}")
        
        db = SessionLocal()
        try:
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 1)
            await asyncio.sleep(1.0) # Simulate processing data
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 2)
            
            # 1. Synthesize the proactive query.
            # Scoped to inventory because that is what depth="baseline" below
            # actually analyses — asking about "our business" invited a full
            # board run and produced findings from agents that never ran.
            query = (
                "What is the biggest inventory risk right now and what should I reorder? "
                "Base your answer on current stock levels, sell-through and dead stock."
            )
            
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 3)
            # 2. Invoke standard orchestrator pipeline
            orchestrator = AgentOrchestrator()

            # Watermark taken before the run so the summary below reflects what
            # THIS analysis produced. Counting every trace in the workspace would
            # report a workspace total and call it "new".
            # Naive UTC to match RecommendationTrace.created_at's default.
            run_started_at = datetime.datetime.utcnow()

            # depth="baseline" performs lightweight proactive analysis: 0 router calls,
            # 0 sub-agent LLM calls (deterministic Python inventory computation), and
            # 1 COO synthesis call. This run is automatic on CSV upload.
            msg = await orchestrator.orchestrate(
                db=db,
                org_id=org_id,
                question=query,
                mode="smart",
                user_id=user_id,
                developer_mode=False,
                depth="baseline"
            )

            if msg and msg.agent_data:
                from app.services.ai.memory_service import save_recommendation
                save_recommendation(db, org_id, "EVE COO Baseline", msg.agent_data)
            
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 4)
            await asyncio.sleep(1.0) # Simulate final trace creation step visualization
            
            # Summarize only what this run generated.
            new_traces = (
                db.query(RecommendationTrace)
                .filter(
                    RecommendationTrace.organization_id == org_id,
                    RecommendationTrace.created_at >= run_started_at,
                )
                .all()
            )
            count = len(new_traces)

            # Dominant type decides where the client sends the user next. Ties
            # break toward whichever type Counter saw first, which is stable
            # enough for a navigation hint.
            types = [t.recommendation_type for t in new_traces if t.recommendation_type]
            primary_type = Counter(types).most_common(1)[0][0] if types else None

            ProactiveAnalysisService._update_status(
                db, org_id, "completed", 4, rec_count=count, primary_type=primary_type
            )
            logger.info(f"[PROACTIVE ANALYSIS] Successfully generated baseline recommendations for Org {org_id}")
            
        except Exception as e:
            logger.error(f"[PROACTIVE ANALYSIS] Failed to generate recommendations: {e}", exc_info=True)
            ProactiveAnalysisService._update_status(db, org_id, "failed", 0, error=str(e))
        finally:
            db.close()

    @staticmethod
    def generate_baseline_recommendations_sync(org_id: uuid.UUID, user_id: uuid.UUID = None):
        """
        Wrapper to run the async task from sync context if needed.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(ProactiveAnalysisService.generate_baseline_recommendations_async(org_id, user_id))
        except RuntimeError:
            asyncio.run(ProactiveAnalysisService.generate_baseline_recommendations_async(org_id, user_id))
