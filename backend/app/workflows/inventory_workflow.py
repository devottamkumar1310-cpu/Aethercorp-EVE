# ==============================================================================
# PURPOSE: Multi-agent Inventory Optimization Workflow.
# DATA FLOW: Graph triggers -> runs Inventory agent -> compiles and saves Inventory Report.
# EXTENSION POINTS: Add automatic size curve adjustments to PO templates.
# ==============================================================================

import logging
from sqlalchemy.orm import Session
from app.orchestration.orchestrator import Orchestrator
from app.orchestration.planner import Planner
from app.services.report_service import ReportService
from app.workflows.profit_optimization_workflow import artifact_date

logger = logging.getLogger("eve.workflows.inventory_workflow")


class InventoryWorkflow:
    """
    Coordinates inventory analysis tasks.
    """
    def __init__(self, db: Session):
        self.db = db
        self.orchestrator = Orchestrator(db)
        self.planner = Planner()

    async def execute(self, organization_id: int) -> dict:
        logger.info(f"Triggering Inventory Workflow for Org: {organization_id}")
        
        # 1. Build task graph
        graph = await self.planner.create_plan(
            goal="Analyze inventory health and reorders.",
            organization_id=organization_id
        )

        # 2. Run graph
        context = await self.orchestrator.execute(graph, inputs={"organization_id": organization_id})

        if graph.is_failed():
            raise RuntimeError(f"Inventory workflow execution failed: {context.trace_logs[-1]}")

        # Extract inventory result
        inventory_result = context.results.get("inventory_run", {})

        # 3. Save as inventory_report artifact
        artifact = ReportService.save_artifact(
            db=self.db,
            organization_id=organization_id,
            artifact_type="inventory_report",
            title=f"Inventory Optimization Report - {artifact_date()}",
            content=inventory_result
        )

        return {
            "run_id": context.run_id,
            "status": "completed",
            "artifact_id": artifact.id,
            "report": inventory_result,
            "duration_seconds": context.get_duration()
        }
