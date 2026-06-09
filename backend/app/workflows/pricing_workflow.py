# ==============================================================================
# PURPOSE: Multi-agent Dynamic Pricing Optimization Workflow.
# DATA FLOW: Graph triggers -> runs Pricing agent -> compiles and saves Pricing Report.
# EXTENSION POINTS: Add channel-specific (Shopify, retail store) pricing suggestion matrices.
# ==============================================================================

import logging
from sqlalchemy.orm import Session
from app.orchestration.orchestrator import Orchestrator
from app.orchestration.planner import Planner
from app.services.report_service import ReportService
from app.workflows.profit_optimization_workflow import artifact_date

logger = logging.getLogger("eve.workflows.pricing_workflow")


class PricingWorkflow:
    """
    Coordinates pricing optimization tasks.
    """
    def __init__(self, db: Session):
        self.db = db
        self.orchestrator = Orchestrator(db)
        self.planner = Planner()

    async def execute(self, organization_id: int) -> dict:
        logger.info(f"Triggering Pricing Workflow for Org: {organization_id}")
        
        # 1. Build task graph
        graph = await self.planner.create_plan(
            goal="Analyze margins and dynamic pricing suggestions.",
            organization_id=organization_id
        )

        # 2. Run graph
        context = await self.orchestrator.execute(graph, inputs={"organization_id": organization_id})

        if graph.is_failed():
            raise RuntimeError(f"Pricing workflow execution failed: {context.trace_logs[-1]}")

        # Extract pricing result
        pricing_result = context.results.get("pricing_run", {})

        # 3. Save as pricing_report artifact
        artifact = ReportService.save_artifact(
            db=self.db,
            organization_id=organization_id,
            artifact_type="pricing_report",
            title=f"Dynamic Pricing Report - {artifact_date()}",
            content=pricing_result
        )

        return {
            "run_id": context.run_id,
            "status": "completed",
            "artifact_id": artifact.id,
            "report": pricing_result,
            "duration_seconds": context.get_duration()
        }
