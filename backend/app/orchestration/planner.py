# ==============================================================================
# PURPOSE: Task Planner Engine.
# DATA FLOW: Accepts goal text -> queries AgentRegistry for capabilities -> calls Gemini to decompose ->
#            builds a validated TaskGraph.
# EXTENSION POINTS: Add custom plan validators, support conditional triggers, or multi-objective goals.
# ARCHITECTURAL DECISION:
# - Connects LLM reasoning directly to Agent Registry discovery.
# - Promotes autonomy by letting Gemini determine dependencies rather than hardcoding.
# - Includes predefined recipes for common D2C workflows (clearance markdown, reorder runs)
#   as robust fallbacks.
# ==============================================================================

import json
import logging
from app.core.agent_registry import AgentRegistry
from app.core.dependency_container import container
from app.orchestration.task_graph import TaskGraph
from app.orchestration.task_node import TaskNode

logger = logging.getLogger("eve.orchestration.planner")


class Planner:
    """
    Translates user requests into structured executable task graphs.
    """
    def __init__(self):
        self.gemini_service = container.get("gemini_service")

    async def create_plan(self, goal: str, organization_id: int) -> TaskGraph:
        """
        Interprets natural language goals and constructs a TaskGraph.
        """
        logger.info(f"Planner decomposing goal: '{goal}' for Org: {organization_id}")
        
        # 1. Fallback / Recipe check first for standard workflows
        normalized_goal = goal.lower()
        
        # Natural Language Scenario Parsing
        import re
        if "price" in normalized_goal or "pricing" in normalized_goal:
            if "increase" in normalized_goal or "change" in normalized_goal or "raise" in normalized_goal or "up" in normalized_goal:
                match = re.search(r'(\d+)', normalized_goal)
                val = float(match.group(1)) if match else 10.0
                return self._build_forecasting_recipe(organization_id, "price_change", val)
                
        if "sales" in normalized_goal or "demand" in normalized_goal:
            if "increase" in normalized_goal or "grow" in normalized_goal or "up" in normalized_goal or "grows" in normalized_goal:
                match = re.search(r'(\d+)', normalized_goal)
                val = float(match.group(1)) if match else 20.0
                return self._build_forecasting_recipe(organization_id, "demand_growth", val)
            elif "drop" in normalized_goal or "fall" in normalized_goal or "decline" in normalized_goal or "down" in normalized_goal or "decrease" in normalized_goal or "falls" in normalized_goal or "drops" in normalized_goal:
                match = re.search(r'(\d+)', normalized_goal)
                val = float(match.group(1)) if match else 30.0
                return self._build_forecasting_recipe(organization_id, "demand_decline", val)
                
        if "expand" in normalized_goal or "expansion" in normalized_goal or "increase inventory" in normalized_goal or "order" in normalized_goal:
            match = re.search(r'(\d+)', normalized_goal)
            val = float(match.group(1)) if match else 1000.0
            return self._build_forecasting_recipe(organization_id, "inventory_expansion", val)
            
        if "cash" in normalized_goal or "flow" in normalized_goal:
            match = re.search(r'(\d+)', normalized_goal)
            val = float(match.group(1)) if match else 30.0
            return self._build_forecasting_recipe(organization_id, "cash_flow_forecast", val)
            
        elif "cash will i need" in normalized_goal or "cash do i need" in normalized_goal:
            return self._build_forecasting_recipe(organization_id, "cash_flow_forecast", 30.0)
            
        elif "next month" in normalized_goal or "safest growth strategy" in normalized_goal:
            return self._build_executive_action_recipe(organization_id)
            
        if "inventory" in normalized_goal and "pricing" in normalized_goal:
            return self._build_executive_action_recipe(organization_id)
        elif "inventory" in normalized_goal:
            return self._build_inventory_recipe(organization_id)
        elif "pricing" in normalized_goal:
            return self._build_pricing_recipe(organization_id)

        # 2. Dynamic planning using Gemini Function Calling or JSON Schema parsing
        agents_list = AgentRegistry.list_agents()
        agents_desc = "\n".join([
            f"- Role: '{a['role']}', Name: '{a['name']}', Description: '{a['description']}', Tools: {a['tools']}"
            for a in agents_list
        ])

        system_instruction = (
            "You are EVE's Lead Task Planner. Your job is to translate a user business goal into a valid "
            "JSON task graph. You must only utilize the registered agents described below.\n\n"
            "Registered Agents:\n"
            f"{agents_desc}\n\n"
            "Format the output strictly as a JSON object containing a 'tasks' list, where each task has:\n"
            "- id (str, unique node key like 'task_1')\n"
            "- name (str, action description)\n"
            "- agent_role (str, must match one of the registered roles)\n"
            "- description (str, explanation of what the agent will do)\n"
            "- dependencies (list of string IDs of pre-requisite tasks)\n"
            "- inputs (dictionary of parameters: e.g. {'organization_id': 1})\n"
            "Do not output markdown block quotes, return raw JSON string."
        )

        prompt = f"Goal: Decompose this instruction: '{goal}' into a sequenced task graph."
        
        try:
            # Request LLM structured response (uses gemini_service.DEFAULT_MODEL)
            response = await self.gemini_service.generate_response(
                prompt=prompt,
                system_instruction=system_instruction,
                agent_role="planner",
                tool_names=[]
            )

            if response.status == "success" and "explanation" in response.result:
                raw_json = response.result["explanation"]
                # Strip potential markdown formatting if returned
                if "```json" in raw_json:
                    raw_json = raw_json.split("```json")[1].split("```")[0]
                elif "```" in raw_json:
                    raw_json = raw_json.split("```")[1].split("```")[0]
                    
                parsed = json.loads(raw_json.strip())
                graph = TaskGraph(organization_id)
                
                for t in parsed.get("tasks", []):
                    # Ensure organization_id is bound to all inputs
                    task_inputs = t.get("inputs", {})
                    task_inputs["organization_id"] = organization_id
                    
                    node = TaskNode(
                        id=t["id"],
                        name=t["name"],
                        agent_role=t["agent_role"],
                        description=t["description"],
                        dependencies=t.get("dependencies", []),
                        inputs=task_inputs
                    )
                    graph.add_node(node)
                    
                if graph.validate():
                    logger.info("Successfully compiled dynamic TaskGraph.")
                    return graph
                    
        except Exception as e:
            logger.error(f"Failed to generate dynamic plan: {e}. Falling back to default recipe.")
            
        # Default fallback if LLM plan fails or is offline
        return self._build_profit_optimization_recipe(organization_id)

    def _build_inventory_recipe(self, organization_id: int) -> TaskGraph:
        """
        Generates standard Inventory replenishment optimization graph.
        """
        graph = TaskGraph(organization_id)
        graph.add_node(TaskNode(
            id="inventory_run",
            name="Analyze Inventory Health",
            agent_role="inventory",
            description="Examines sales velocities, lead times, and recommends stock levels.",
            inputs={"organization_id": organization_id}
        ))
        graph.validate()
        return graph

    def _build_pricing_recipe(self, organization_id: int) -> TaskGraph:
        """
        Generates standard pricing optimization graph.
        """
        graph = TaskGraph(organization_id)
        graph.add_node(TaskNode(
            id="pricing_run",
            name="Run Dynamic Pricing Suggestions",
            agent_role="pricing",
            description="Performs price elasticity checks and suggests pricing adjustments.",
            inputs={"organization_id": organization_id}
        ))
        graph.validate()
        return graph

    def _build_forecasting_recipe(self, organization_id: int, scenario_type: str, parameter: float) -> TaskGraph:
        graph = TaskGraph(organization_id)
        graph.add_node(TaskNode(
            id="forecasting_run",
            name="Run Executive Forecasting Scenario",
            agent_role="forecasting",
            description=f"Simulates {scenario_type} with parameter {parameter}",
            inputs={"organization_id": organization_id, "scenario_type": scenario_type, "parameter": parameter}
        ))
        graph.validate()
        return graph

    def _build_executive_action_recipe(self, organization_id: int) -> TaskGraph:
        graph = TaskGraph(organization_id)
        
        # Node 1: Analyze inventory
        graph.add_node(TaskNode(
            id="inventory_run",
            name="Examine Stock Levels",
            agent_role="inventory",
            description="Scans for stockout risks, safety thresholds, and dead items.",
            inputs={"organization_id": organization_id}
        ))
        
        # Node 2: Optimizes retail pricing
        graph.add_node(TaskNode(
            id="pricing_run",
            name="Optimize Prices",
            agent_role="pricing",
            description="Calculates recommended pricing adjustments.",
            inputs={"organization_id": organization_id}
        ))
        
        # Node 3: Predict cash flow
        graph.add_node(TaskNode(
            id="forecasting_run",
            name="Forecast Cash Flow",
            agent_role="forecasting",
            description="Generates standard 30 day cash flow forecast.",
            inputs={"organization_id": organization_id, "scenario_type": "cash_flow_forecast", "parameter": 30.0}
        ))
        
        graph.validate()
        return graph

    def _build_profit_optimization_recipe(self, organization_id: int) -> TaskGraph:
        """
        Generates multi-stage profit optimization graph.
        """
        graph = TaskGraph(organization_id)
        
        # Node 1: Gather market competitor intelligence
        graph.add_node(TaskNode(
            id="market_check",
            name="Check Competitor Indexing",
            agent_role="market",
            description="Monitors market indices for pricing benchmarking.",
            inputs={"organization_id": organization_id}
        ))
        
        # Node 2: Analyze inventory (Runs in parallel or depends on market)
        graph.add_node(TaskNode(
            id="inventory_run",
            name="Examine Stock Levels",
            agent_role="inventory",
            description="Scans for stockout risks, safety thresholds, and dead items.",
            inputs={"organization_id": organization_id}
        ))
        
        # Node 3: Optimizes retail pricing (depends on market and inventory checks)
        graph.add_node(TaskNode(
            id="pricing_run",
            name="Optimize Prices",
            agent_role="pricing",
            description="Calculates recommended pricing adjustments based on stock and competitor indices.",
            dependencies=["market_check", "inventory_run"],
            inputs={"organization_id": organization_id}
        ))
        
        graph.validate()
        return graph
