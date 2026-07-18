import logging
import uuid
import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.ai.agent_orchestrator import AgentOrchestrator
from app.models.organization import Organization
from app.models.recommendation_trace import RecommendationTrace

logger = logging.getLogger("eve.services.ai.proactive_analysis")

class ProactiveAnalysisService:
    @staticmethod
    def _update_status(db: Session, org_id: uuid.UUID, status: str, step: int, error: str = None, rec_count: int = 0):
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if org:
            org.analysis_status = {
                "status": status,
                "step": step,
                "error": error,
                "recommendations_count": rec_count
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
            
            # 1. Synthesize the proactive query
            query = "What is the biggest operational risk right now and what should I reorder? Analyze our business and provide critical strategic recommendations based on current metrics."
            
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 3)
            # 2. Invoke standard orchestrator pipeline
            orchestrator = AgentOrchestrator()
            
            await orchestrator.orchestrate(
                db=db,
                org_id=org_id,
                question=query,
                mode="smart",
                user_id=user_id,
                developer_mode=False
            )
            
            ProactiveAnalysisService._update_status(db, org_id, "in_progress", 4)
            await asyncio.sleep(1.0) # Simulate final trace creation step visualization
            
            # Count the newly generated traces
            count = db.query(RecommendationTrace).filter(RecommendationTrace.organization_id == org_id).count()
            
            ProactiveAnalysisService._update_status(db, org_id, "completed", 4, rec_count=count)
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
