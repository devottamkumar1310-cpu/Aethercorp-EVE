# ==============================================================================
# PURPOSE: Runtime execution context tracker.
# DATA FLOW: Stores run parameters, inputs, and intermediary agent results during execution.
# EXTENSION POINTS: Add thread-local variable bindings, or remote session state synchronizations.
# ARCHITECTURAL DECISION:
# - Serves as a thread-safe data container representing a single workflow session.
# ==============================================================================

import time
import logging
from typing import Dict, Any, List

logger = logging.getLogger("eve.orchestration.execution_context")


class ExecutionContext:
    """
    State container containing active values and logs during a task run.
    """
    def __init__(self, run_id: str, organization_id: int, inputs: Dict[str, Any]):
        self.run_id = run_id
        self.organization_id = organization_id
        self.inputs = inputs or {}
        
        # Runtime states
        self.variables: Dict[str, Any] = {}
        self.results: Dict[str, Any] = {} # node_id -> output dict
        self.start_time = time.time()
        self.end_time = None
        self.trace_logs: List[str] = []

    def set_variable(self, name: str, value: Any):
        """
        Sets a shared parameter.
        """
        self.variables[name] = value
        logger.debug(f"ExecutionContext: Set var '{name}'")

    def get_variable(self, name: str, default: Any = None) -> Any:
        """
        Retrieves a shared parameter.
        """
        return self.variables.get(name, default)

    def log(self, message: str):
        """
        Appends an event message to the execution trace.
        """
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        log_entry = f"[{timestamp}] {message}"
        self.trace_logs.append(log_entry)
        logger.info(f"ExecutionTrace [{self.run_id}]: {message}")

    def get_duration(self) -> float:
        """
        Returns elapsed execution time.
        """
        if self.end_time:
            return self.end_time - self.start_time
        return time.time() - self.start_time

    def complete(self):
        """
        Flags the context run as finished.
        """
        self.end_time = time.time()
        self.log(f"Execution completed. Total duration: {self.get_duration():.2f}s")
