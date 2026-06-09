# ==============================================================================
# PURPOSE: Task Node definition for the Execution Graph.
# DATA FLOW: Created by the Planner, traversed by the Orchestrator, executed by agents.
# EXTENSION POINTS: Add progress trackers, timeout limits, and priority weights.
# ARCHITECTURAL DECISION:
# - Represents a single state machine transition. Decouples structural data
#   from specific execution engines.
# ==============================================================================

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("eve.orchestration.task_node")


class TaskNode:
    """
    Represents a single step in a multi-agent execution plan.
    """
    def __init__(
        self,
        id: str,
        name: str,
        agent_role: str,
        description: str,
        dependencies: Optional[List[str]] = None,
        inputs: Optional[Dict[str, Any]] = None
    ):
        self.id = id
        self.name = name
        self.agent_role = agent_role
        self.description = description
        self.dependencies = dependencies or []
        self.inputs = inputs or {}
        self.status = "pending" # pending, running, completed, failed
        self.output: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None

    def start(self):
        """
        Transitions the node to running status.
        """
        self.status = "running"
        logger.info(f"TaskNode '{self.id}' status changed to RUNNING.")

    def complete(self, output: Dict[str, Any]):
        """
        Transitions the node to completed status and records output.
        """
        self.status = "completed"
        self.output = output
        logger.info(f"TaskNode '{self.id}' completed successfully.")

    def fail(self, error_msg: str):
        """
        Transitions the node to failed status and records error.
        """
        self.status = "failed"
        self.error = error_msg
        logger.error(f"TaskNode '{self.id}' failed: {error_msg}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes node to dictionary format for APIs and JSON schemas.
        """
        return {
            "id": self.id,
            "name": self.name,
            "agent_role": self.agent_role,
            "description": self.description,
            "dependencies": self.dependencies,
            "inputs": self.inputs,
            "status": self.status,
            "output": self.output,
            "error": self.error
        }
