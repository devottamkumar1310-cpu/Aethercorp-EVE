# ==============================================================================
# PURPOSE: Sourcing Optimization Workflow.
# DATA FLOW: Graph triggers -> runs Sourcing agent -> compiles and saves Sourcing Report.
# EXTENSION POINTS: Add automatic purchase contract drafts.
# ==============================================================================

import logging
from sqlalchemy.orm import Session
from app.orchestration.orchestrator import Orchestrator
from app.orchestration.task_graph import TaskGraph
from app.orchestration.task_node import TaskNode
from app.services.report_service import ReportService
from app.workflows.profit_optimization_workflow import artifact_date

logger = logging.getLogger("eve.workflows.sourcing_workflow")


class SourcingWorkflow:
    """
    Coordinates supplier comparison and sourcing tasks.
    """
    def __init__(self, db: Session):
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def execute(self, organization_id: int) -> dict:
        logger.info(f"Triggering Sourcing Workflow for Org: {organization_id}")
        
        # Build manual task graph for sourcing
        graph = TaskGraph(organization_id)
        graph.add_node(TaskNode(
            id="sourcing_run",
            name="Analyze Suppliers",
            agent_role="sourcing",
            description="Finds and compares suppliers for the apparel catalog.",
            inputs={"organization_id": organization_id, "category": "tops"}
        ))
        graph.validate()

        # Run graph
        context = await self.orchestrator.execute(graph, inputs={"organization_id": organization_id})

        if graph.is_failed():
            raise RuntimeError(f"Sourcing workflow execution failed: {context.trace_logs[-1]}")

        # Extract sourcing result
        sourcing_result = context.results.get("sourcing_run", {})

        # Save as sourcing_report artifact
        artifact = ReportService.save_artifact(
            db=self.db,
            organization_id=organization_id,
            artifact_type="sourcing_report",
            title=f"Supplier Sourcing Report - {artifact_date()}",
            content=sourcing_result
        )

        return {
            "run_id": context.run_id,
            "status": "completed",
            "artifact_id": artifact.id,
            "report": sourcing_result,
            "duration_seconds": context.get_duration()
        }
