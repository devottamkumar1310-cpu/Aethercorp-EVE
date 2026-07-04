# ==============================================================================
# PURPOSE: Unit and integration tests for EVE's Multi-Agent Framework.
# DATA FLOW: Tests registry discovery, event-based execution, and CEO report aggregation.
# ==============================================================================

import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.agent_registry import AgentRegistry
from app.core.event_bus import event_bus, Event
from app.agents.executive_orchestrator import ExecutiveOrchestrator


def test_agent_discovery():
    """
    Verifies that all specialized agents self-register and expose metadata correctly.
    """
    roles = ["executive", "market", "inventory", "pricing", "sourcing", "analytics"]
    for role in roles:
        agent_class = AgentRegistry.get_agent_class(role)
        assert agent_class is not None, f"Agent for role '{role}' failed to register."
        
        meta = AgentRegistry.get_agent_metadata(role)
        assert meta is not None
        assert meta.role == role
        assert len(meta.capabilities) > 0, f"Role '{role}' is missing capabilities metadata."
        assert len(meta.supported_tasks) > 0, f"Role '{role}' is missing supported_tasks metadata."


def test_event_driven_agent_execution():
    """
    Tests that agents can receive task dispatches and reply with completions via the Event Bus.
    """
    async def run_event_loop_test():
        dispatched_tasks = []
        completed_results = []

        # 1. Define listener on task_dispatched
        async def on_task_dispatched(event: Event):
            data = event.data
            target_role = data.get("target_role")
            task_desc = data.get("task_description")
            task_id = data.get("task_id")
            
            dispatched_tasks.append(data)
            
            # Simulate agent processing task and publishing result
            await event_bus.publish(
                topic="task_completed",
                data={
                    "task_id": task_id,
                    "agent_role": target_role,
                    "result": {"status": "success", "summary": f"Completed task: {task_desc}"}
                },
                sender=target_role
            )

        # 2. Define listener on task_completed
        async def on_task_completed(event: Event):
            completed_results.append(event.data)

        # Subscribe handlers
        event_bus.subscribe("task_dispatched", on_task_dispatched)
        event_bus.subscribe("task_completed", on_task_completed)

        # 3. Publish task
        await event_bus.publish(
            topic="task_dispatched",
            data={
                "task_id": "test_task_100",
                "target_role": "inventory",
                "task_description": "Assess stockout risk for premium tops"
            },
            sender="executive"
        )
        
        # Give event loops a brief moment
        await asyncio.sleep(0.05)

        assert len(dispatched_tasks) == 1
        assert dispatched_tasks[0]["task_id"] == "test_task_100"
        
        assert len(completed_results) == 1
        assert completed_results[0]["task_id"] == "test_task_100"
        assert completed_results[0]["agent_role"] == "inventory"
        assert completed_results[0]["result"]["status"] == "success"

    asyncio.run(run_event_loop_test())


def test_executive_report_aggregation():
    """
    Verifies that the ExecutiveOrchestrator can compile and aggregate outputs successfully.
    """
    # Create temp DB engine
    engine = create_engine("sqlite:///:memory:")
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()

    try:
        # Instantiate CEO agent
        ceo = ExecutiveOrchestrator(db=db)
        
        # Simulate outputs from a task graph run
        mock_graph_outputs = {
            "inventory_check": {
                "agent_role": "inventory",
                "status": "success",
                "result": {
                    "average_risk_score": 72.5,
                    "items_at_risk": [{"sku": "SKU-001"}],
                    "dead_stock_items": [{"sku": "SKU-002"}]
                }
            },
            "pricing_adjust": {
                "agent_role": "pricing",
                "status": "success",
                "result": {
                    "estimated_profit_impact": 4500.00,
                    "recommendations": [{"sku": "SKU-001", "recommended_price": 49.99}]
                }
            }
        }

        # Request CEO report compilation
        async def run_compilation():
            return await ceo.compile_report(mock_graph_outputs, organization_id=1)

        compiled = asyncio.run(run_compilation())

        # Assert correct aggregation
        assert compiled["inventory_risk_score"] == 72.5
        assert compiled["total_reorder_recommendations"] == 1
        assert compiled["total_dead_stock_items"] == 1
        assert compiled["total_pricing_adjustments"] == 1
        assert compiled["estimated_profit_impact"] == 4500.00
        assert "projected profit impact of $4,500.00" in compiled["strategic_recommendation"]
        
    finally:
        db.close()


def test_gemini_service_generation():
    """
    Verifies that generate_text and generate_structured_response resolve correctly.
    """
    from pydantic import BaseModel, Field
    from app.core.dependency_container import container
    
    gemini = container.get("gemini_service")
    
    class TestResponseModel(BaseModel):
        score: float = Field(..., description="Test metric score")
        recommendation: str = Field(..., description="Action advice")

    async def run_generation_tests():
        # Test text generation
        text_res = await gemini.generate_text("Say Hello World", model="gemini-2.5-flash")
        assert isinstance(text_res, str)
        assert len(text_res) > 0

        # Test structured response generation
        structured_res = await gemini.generate_structured_response(
            prompt="Analyze performance",
            response_schema=TestResponseModel,
            model="gemini-2.5-flash"
        )
        assert isinstance(structured_res, TestResponseModel)
        assert hasattr(structured_res, "score")
        assert hasattr(structured_res, "recommendation")

    asyncio.run(run_generation_tests())
