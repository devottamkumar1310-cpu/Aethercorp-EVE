# ==============================================================================
# PURPOSE: Multi-agent Profit Optimization Workflow.
# DATA FLOW: Initiates TaskGraph -> runs Market, Inventory, and Pricing agents ->
#            passes intermediate results -> compiles and saves CEO Executive Report.
# EXTENSION POINTS: Add custom landing margins or automatic supplier reorder requests.
# ARCHITECTURAL DECISION:
# - Encapsulates the execution logic for the brand profit optimizer workflow.
# - Leverages ReportService to persist the final report.
# ==============================================================================

import logging
from sqlalchemy.orm import Session
from app.orchestration.orchestrator import Orchestrator
from app.orchestration.planner import Planner
from app.agents.executive_orchestrator import ExecutiveOrchestrator
from app.services.report_service import ReportService

logger = logging.getLogger("eve.workflows.profit_optimization_workflow")


class ProfitOptimizationWorkflow:
    """
    Coordinates Market, Inventory, and Pricing agents to maximize brand margins.
    """
    def __init__(self, db: Session):
        self.db = db
        self.orchestrator = Orchestrator(db)
        self.planner = Planner()
        self.ceo = ExecutiveOrchestrator(db=db)

    async def execute(self, organization_id: int) -> dict:
        """
        Executes the profit optimization pipeline.
        """
        logger.info(f"Triggering Profit Optimization Workflow for Org: {organization_id}")
        
        # 1. Build the predefined task graph using the planner recipe
        # Goal string triggers the profit optimization recipe
        graph = await self.planner.create_plan(
            goal="Optimize inventory and pricing to maximize profitability.",
            organization_id=organization_id
        )

        # 2. Run the task graph via the Orchestrator
        context = await self.orchestrator.execute(graph, inputs={"organization_id": organization_id})

        if graph.is_failed():
            raise RuntimeError(f"Workflow execution failed: {context.trace_logs[-1]}")

        # 3. Call CEO agent to compile the synthesized executive summary report
        compiled_report = await self.ceo.compile_report(context.results, organization_id)

        # 4. Persist compiled report in the Artifact database table
        artifact = ReportService.save_artifact(
            db=self.db,
            organization_id=organization_id,
            artifact_type="executive_report",
            title=f"Executive Profit Optimization Report - {artifact_date()}",
            content=compiled_report
        )

        return {
            "run_id": context.run_id,
            "status": "completed",
            "artifact_id": artifact.id,
            "report": compiled_report,
            "duration_seconds": context.get_duration()
        }


def artifact_date() -> str:
    import datetime
    return datetime.date.today().strftime("%B %d, %Y")
