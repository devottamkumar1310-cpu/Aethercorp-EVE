# ==============================================================================
# PURPOSE: Market intelligence workflow.
# DATA FLOW: Graph triggers -> runs Market agent -> compiles and saves Market Report.
# EXTENSION POINTS: Add brand index sentiment score graphs.
# ==============================================================================

import logging
from sqlalchemy.orm import Session
from app.orchestration.orchestrator import Orchestrator
from app.orchestration.task_graph import TaskGraph
from app.orchestration.task_node import TaskNode
from app.services.report_service import ReportService
from app.workflows.profit_optimization_workflow import artifact_date

logger = logging.getLogger("eve.workflows.market_workflow")


class MarketWorkflow:
    """
    Coordinates market intelligence monitoring.
    """
    def __init__(self, db: Session):
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def execute(self, organization_id: int) -> dict:
        logger.info(f"Triggering Market Workflow for Org: {organization_id}")
        
        # Build manual task graph for market analysis
        graph = TaskGraph(organization_id)
        graph.add_node(TaskNode(
            id="market_run",
            name="Run Market Price Checks",
            agent_role="market",
            description="Examines competitor prices for pricing adjustments.",
            inputs={"organization_id": organization_id, "sku": "SKU-001"}
        ))
        graph.validate()

        # Run graph
        context = await self.orchestrator.execute(graph, inputs={"organization_id": organization_id})

        if graph.is_failed():
            raise RuntimeError(f"Market workflow execution failed: {context.trace_logs[-1]}")

        # Extract market result
        market_result = context.results.get("market_run", {})

        # Save as market_report artifact
        artifact = ReportService.save_artifact(
            db=self.db,
            organization_id=organization_id,
            artifact_type="market_report",
            title=f"Market Intelligence Report - {artifact_date()}",
            content=market_result
        )

        return {
            "run_id": context.run_id,
            "status": "completed",
            "artifact_id": artifact.id,
            "report": market_result,
            "duration_seconds": context.get_duration()
        }
