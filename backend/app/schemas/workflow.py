# ==============================================================================
# PURPOSE: Pydantic schemas for Workflow triggering, execution tracking, and status polling.
# DATA FLOW: Client requests triggering -> workflow execution starts -> status returned.
# EXTENSION POINTS: Add trigger metadata, webhooks, or scheduled run configuration parameters.
# ARCHITECTURAL DECISION:
# - Envelopes task graphs to represent unified execution runs, exposing states
#   to frontend consoles.
# ==============================================================================

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class WorkflowRunRequest(BaseModel):
    """
    Schema to initiate a pre-defined multi-agent workflow (e.g. inventory optimization).
    """
    workflow_type: str = Field(..., description="Type of workflow: inventory, pricing, profit_optimization, sourcing")
    inputs: Dict[str, Any] = Field(default_factory=dict, description="Custom parameters to override default settings")


class WorkflowRunResponse(BaseModel):
    """
    Telemetry payload describing the current state of a running/completed workflow.
    """
    run_id: str = Field(..., description="Unique trace identifier for this run instance")
    workflow_type: str = Field(..., description="Type of workflow")
    organization_id: int = Field(..., description="Tenant identifier")
    status: str = Field(..., description="pending, running, completed, failed")
    start_time: datetime = Field(..., description="When the workflow was triggered")
    end_time: Optional[datetime] = Field(None, description="When the workflow completed execution")
    duration_seconds: float = Field(default=0.0)
    steps: List[Dict[str, Any]] = Field(default_factory=list, description="State summaries of individual task nodes")
    result: Optional[Dict[str, Any]] = Field(None, description="Final combined output artifact summaries")
    error: Optional[str] = Field(None, description="Failure description if status is failed")
