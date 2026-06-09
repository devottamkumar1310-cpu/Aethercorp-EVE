# ==============================================================================
# PURPOSE: Base class for all specialized agents.
# DATA FLOW: Takes task statements, connects to DB, calls Gemini service, and returns responses.
# EXTENSION POINTS: Add pre-execution and post-execution hooks, validation callbacks, or retry policies.
# ARCHITECTURAL DECISION:
# - All agents inherit from this interface to guarantee uniform telemetry outputs
#   (latency, token counts, cost tracking) and standard tool-use integrations.
# ==============================================================================

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.dependency_container import container
from app.schemas.agent_response import AgentResponseSchema

logger = logging.getLogger("eve.agents.base_agent")


class BaseAgent:
    """
    Standard interface for all EVE platform agents.
    """
    role: str = "base"
    name: str = "Base Agent"
    system_prompt: str = "You are a helpful business assistant."
    tools: List[str] = []

    def __init__(self, db: Optional[Session] = None):
        """
        Initializes agent with optional database session.
        """
        self.db = db
        # Fetch Gemini service from dependency container
        self.gemini_service = container.get("gemini_service")

    async def run(
        self,
        task_description: str,
        organization_id: int,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponseSchema:
        """
        Main execution point for the agent. Runs prompt validation and hooks into LLM API.
        """
        logger.info(f"Agent '{self.name}' ({self.role}) starting task: '{task_description}' for Org: {organization_id}")
        
        # Inject tenant details and session context into the prompt
        formatted_prompt = f"Target Organization ID: {organization_id}\n"
        if context:
            formatted_prompt += f"Execution Context Variables: {context}\n"
        formatted_prompt += f"Task to Execute: {task_description}"

        # Call the central Gemini Service
        response = await self.gemini_service.generate_response(
            prompt=formatted_prompt,
            system_instruction=self.system_prompt,
            agent_role=self.role,
            tool_names=self.tools
        )
        
        # Log results
        if response.status == "success":
            logger.info(f"Agent '{self.name}' completed task in {response.latency_seconds:.2f}s. Cost: ${response.estimated_cost:.5f}")
        else:
            logger.error(f"Agent '{self.name}' failed task: {response.error_message}")
            
        return response
