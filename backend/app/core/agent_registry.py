# ==============================================================================
# PURPOSE: Dynamic Agent Registry.
# DATA FLOW: Specialized agents register themselves at import time. The Planner and Orchestrator
#            query this registry to discover which agent can fulfill a given task.
# EXTENSION POINTS: Add remote agent APIs, dynamic capability updates, or registry syncs.
# ARCHITECTURAL DECISION:
# - No hardcoded agent imports in the routing pipeline.
# - Decouples task allocation from specific class names, enabling easy addition of new agents.
# ==============================================================================

import logging
from typing import Dict, Any, Type, List, Optional

logger = logging.getLogger("eve.core.agent_registry")


class AgentMetadata:
    """
    Data container for agent self-registration metadata.
    """
    def __init__(
        self,
        name: str,
        role: str,
        description: str,
        tools: List[str],
        capabilities: Optional[List[str]] = None,
        supported_tasks: Optional[List[str]] = None
    ):
        self.name = name
        self.role = role
        self.description = description
        self.tools = tools
        self.capabilities = capabilities or []
        self.supported_tasks = supported_tasks or []


class AgentRegistry:
    """
    Central, thread-safe registry holding references to all active agent classes.
    """
    _agents: Dict[str, Type] = {}
    _metadata: Dict[str, AgentMetadata] = {}

    @classmethod
    def register(
        cls,
        role: str,
        name: str,
        description: str,
        tools: List[str],
        capabilities: Optional[List[str]] = None,
        supported_tasks: Optional[List[str]] = None
    ):
        """
        Decorator to register an agent class on startup.
        """
        def decorator(agent_class: Type):
            role_key = role.lower().strip()
            cls._agents[role_key] = agent_class
            cls._metadata[role_key] = AgentMetadata(
                name=name,
                role=role,
                description=description,
                tools=tools,
                capabilities=capabilities,
                supported_tasks=supported_tasks
            )
            logger.info(f"Registered agent: {name} (Role: {role}) with {len(tools)} tools.")
            return agent_class
        return decorator

    @classmethod
    def get_agent_class(cls, role: str) -> Optional[Type]:
        """
        Retrieves the class constructor for a given agent role.
        """
        return cls._agents.get(role.lower().strip())

    @classmethod
    def get_agent_metadata(cls, role: str) -> Optional[AgentMetadata]:
        """
        Retrieves metadata associated with an agent role.
        """
        return cls._metadata.get(role.lower().strip())

    @classmethod
    def list_agents(cls) -> List[Dict[str, Any]]:
        """
        Lists all registered agent roles and their metadata for dashboard views.
        """
        return [
            {
                "role": meta.role,
                "name": meta.name,
                "description": meta.description,
                "tools": meta.tools,
                "capabilities": meta.capabilities,
                "supported_tasks": meta.supported_tasks
            }
            for meta in cls._metadata.values()
        ]


# Global registration decorator helper
register_agent = AgentRegistry.register
