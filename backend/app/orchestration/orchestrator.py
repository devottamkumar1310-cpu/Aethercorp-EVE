# ==============================================================================
# PURPOSE: Asynchronous Task Graph Orchestrator.
# DATA FLOW: Graph and Context flow in -> traverses dependency paths -> instantiates and runs
#            agents concurrently -> validates replies -> outputs synthesis flags.
# EXTENSION POINTS: Add progress callbacks, task execution timeouts, or manual override hooks.
# ARCHITECTURAL DECISION:
# - Uses asyncio to run independent DAG branches concurrently.
# - Promotes isolation by instantiating agents dynamically with scoped database sessions.
# ==============================================================================

import asyncio
import logging
import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.agent_registry import AgentRegistry
from app.core.event_bus import event_bus
from app.orchestration.task_graph import TaskGraph
from app.orchestration.task_node import TaskNode
from app.orchestration.execution_context import ExecutionContext
from app.orchestration.validator import Validator

logger = logging.getLogger("eve.orchestration.orchestrator")


class Orchestrator:
    """
    Core engine that executes TaskGraphs by dispatching tasks to agents.
    """
    def __init__(self, db: Session):
        self.db = db

    async def execute(
        self,
        graph: TaskGraph,
        inputs: Optional[Dict[str, Any]] = None
    ) -> ExecutionContext:
        """
        Executes a TaskGraph topological traversal asynchronously.
        """
        run_id = str(uuid.uuid4())
        context = ExecutionContext(run_id=run_id, organization_id=graph.organization_id, inputs=inputs or {})
        context.log(f"Starting execution of TaskGraph. Nodes count: {len(graph.nodes)}")

        # Run loop until graph completes or fails
        while not graph.is_completed() and not graph.is_failed():
            executable_nodes = graph.get_executable_nodes()
            
            if not executable_nodes:
                # If there are pending nodes but none are executable, we have a deadlock
                pending_ids = [n.id for n in graph.nodes.values() if n.status == "pending"]
                if pending_ids:
                    context.log(f"Execution deadlock detected. Pending nodes: {pending_ids}")
                    for pid in pending_ids:
                        graph.nodes[pid].fail("Deadlock: prerequisite dependencies could not be resolved.")
                break

            context.log(f"Found {len(executable_nodes)} executable nodes: {[n.id for n in executable_nodes]}")
            
            # Execute all ready nodes concurrently
            tasks = [
                asyncio.create_task(self._execute_node(node, context))
                for node in executable_nodes
            ]
            
            await asyncio.gather(*tasks)

        context.complete()
        
        # Check overall results
        if graph.is_completed():
            context.log("All graph tasks finished successfully.")
        else:
            context.log("Graph execution halted due to failures.")
            
        return context

    async def _execute_node(self, node: TaskNode, context: ExecutionContext):
        """
        Helper to execute a single task node.
        """
        node.start()
        context.log(f"Dispatched task '{node.id}' to agent '{node.agent_role}'")
        
        # Merge global context variables into node input variables early for dispatch logging
        merged_inputs = {**context.variables, **node.inputs}
        
        await event_bus.publish(
            topic="task_dispatched",
            data={
                "task_id": node.id,
                "target_role": node.agent_role,
                "task_description": node.description,
                "inputs": merged_inputs
            },
            sender="orchestrator"
        )
        
        # 1. Fetch agent class from registry
        agent_class = AgentRegistry.get_agent_class(node.agent_role)
        if not agent_class:
            err = f"Unregistered agent role '{node.agent_role}' requested by node '{node.id}'."
            node.fail(err)
            context.log(f"Error: {err}")
            await event_bus.publish(
                topic="task_failed",
                data={
                    "task_id": node.id,
                    "agent_role": node.agent_role,
                    "error": err
                },
                sender="orchestrator"
            )
            return

        try:
            # 2. Instantiate agent with DB session
            agent = agent_class(db=self.db)
            
            # 3. Merge global context variables into node input variables (again in case modified)
            merged_inputs = {**context.variables, **node.inputs}
            
            # 4. Run the Agent (LLM generation + Tool execution loop)
            response = await agent.run(
                task_description=node.description,
                organization_id=context.organization_id,
                context=merged_inputs
            )
            
            # 5. Evaluate response
            if response.status == "failure":
                if node.agent_role in ["pricing", "inventory"]:
                    fallback_result = {"status": "failed", "error": response.error_message or "Agent reported execution failure."}
                    node.complete(fallback_result)
                    context.results[node.id] = fallback_result
                    context.set_variable(node.id, fallback_result)
                    context.log(f"Node '{node.id}' execution failed, trapped fallback: {fallback_result['error']}")
                    return

                node.fail(response.error_message or "Agent reported execution failure.")
                context.log(f"Node '{node.id}' execution failed: {node.error}")
                await event_bus.publish(
                    topic="task_failed",
                    data={
                        "task_id": node.id,
                        "agent_role": node.agent_role,
                        "error": node.error
                    },
                    sender=node.agent_role
                )
                return

            # 6. Validate the output payload mathematically
            is_valid, validation_err = Validator.validate_node_output(node.agent_role, response.result)
            if not is_valid:
                if node.agent_role in ["pricing", "inventory"]:
                    fallback_result = {"status": "failed", "error": f"Output validation failed: {validation_err}"}
                    node.complete(fallback_result)
                    context.results[node.id] = fallback_result
                    context.set_variable(node.id, fallback_result)
                    context.log(f"Node '{node.id}' output validation failed, trapped fallback: {validation_err}")
                    return

                node.fail(f"Output validation failed: {validation_err}")
                context.log(f"Node '{node.id}' output validation failed: {validation_err}")
                await event_bus.publish(
                    topic="task_failed",
                    data={
                        "task_id": node.id,
                        "agent_role": node.agent_role,
                        "error": node.error
                    },
                    sender=node.agent_role
                )
                return

            # 7. Success: save results to context
            node.complete(response.result)
            context.results[node.id] = response.result
            
            # Merge results into shared context variables so subsequent nodes can read them
            context.set_variable(node.id, response.result)
            # Also shallow merge key result maps directly
            for k, v in response.result.items():
                if isinstance(v, (int, float, str, list, dict)):
                    context.set_variable(f"{node.id}_{k}", v)

            context.log(f"Node '{node.id}' finished successfully in {response.latency_seconds:.2f}s.")
            
            await event_bus.publish(
                topic="task_completed",
                data={
                    "task_id": node.id,
                    "agent_role": node.agent_role,
                    "result": response.result
                },
                sender=node.agent_role
            )

        except Exception as e:
            if node.agent_role in ["pricing", "inventory"]:
                fallback_result = {"status": "failed", "error": str(e)}
                node.complete(fallback_result)
                context.results[node.id] = fallback_result
                context.set_variable(node.id, fallback_result)
                context.log(f"Fatal error during node '{node.id}' run, trapped fallback: {e}")
                return

            logger.error(f"Fatal error executing node '{node.id}': {e}", exc_info=e)
            node.fail(str(e))
            context.log(f"Fatal error during node '{node.id}' run: {e}")
            await event_bus.publish(
                topic="task_failed",
                data={
                    "task_id": node.id,
                    "agent_role": node.agent_role,
                    "error": str(e)
                },
                sender="orchestrator"
            )
