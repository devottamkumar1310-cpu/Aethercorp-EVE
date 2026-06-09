# ==============================================================================
# PURPOSE: Task execution graph (DAG) structure.
# DATA FLOW: Graph stores nodes -> validates dependency resolutions -> traverses for next ready steps.
# EXTENSION POINTS: Add dynamic graph modification rules during runtime (conditional branching).
# ARCHITECTURAL DECISION:
# - Enforces dependency validations to prevent deadlock states.
# ==============================================================================

import logging
from typing import Dict, Any, List
from app.orchestration.task_node import TaskNode

logger = logging.getLogger("eve.orchestration.task_graph")


class TaskGraph:
    """
    Manages execution dependencies among multiple agent tasks.
    """
    def __init__(self, organization_id: int):
        self.organization_id = organization_id
        self.nodes: Dict[str, TaskNode] = {}

    def add_node(self, node: TaskNode):
        """
        Adds a task node to the graph.
        """
        self.nodes[node.id] = node
        logger.debug(f"Added task node '{node.id}' to graph (Org: {self.organization_id})")

    def validate(self) -> bool:
        """
        Runs cycle detection (DFS-based topological sort check) on the graph dependencies.
        Returns True if the graph is a valid DAG.
        """
        visited = {} # node_id -> status (0 = unvisited, 1 = visiting, 2 = visited)
        
        # Initialize statuses
        for node_id in self.nodes:
            visited[node_id] = 0

        def dfs(node_id: str) -> bool:
            visited[node_id] = 1 # Visiting
            
            node = self.nodes.get(node_id)
            if node:
                for dep_id in node.dependencies:
                    if dep_id not in self.nodes:
                        logger.error(f"Graph validation failed: Dependency '{dep_id}' referenced by '{node_id}' is not in graph.")
                        return False
                        
                    if visited[dep_id] == 1:
                        logger.error(f"Graph validation failed: Circular dependency detected between '{node_id}' and '{dep_id}'")
                        return False # Cycle detected
                        
                    if visited[dep_id] == 0:
                        if not dfs(dep_id):
                            return False
                            
            visited[node_id] = 2 # Visited
            return True

        for node_id in self.nodes:
            if visited[node_id] == 0:
                if not dfs(node_id):
                    return False
        return True

    def get_executable_nodes(self) -> List[TaskNode]:
        """
        Finds all nodes that are pending and whose dependency nodes are completed.
        """
        executable = []
        for node in self.nodes.values():
            if node.status != "pending":
                continue
                
            # Check if all dependencies are completed
            deps_met = True
            for dep_id in node.dependencies:
                dep_node = self.nodes.get(dep_id)
                if not dep_node or dep_node.status != "completed":
                    deps_met = False
                    break
                    
            if deps_met:
                executable.append(node)
                
        return executable

    def is_completed(self) -> bool:
        """
        Checks if all nodes in the graph are successfully completed.
        """
        return all(node.status == "completed" for node in self.nodes.values())

    def is_failed(self) -> bool:
        """
        Checks if any node in the graph failed.
        """
        return any(node.status == "failed" for node in self.nodes.values())

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the graph.
        """
        return {
            "organization_id": self.organization_id,
            "nodes": {node_id: node.to_dict() for node_id, node in self.nodes.items()}
        }
