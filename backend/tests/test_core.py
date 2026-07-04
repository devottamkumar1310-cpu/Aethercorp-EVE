# ==============================================================================
# PURPOSE: Unit tests for EVE core services.
# DATA FLOW: Runs assertions directly on Core registries and in-memory event buses.
# ==============================================================================

import asyncio
from app.core.agent_registry import register_agent, AgentRegistry
from app.core.tool_registry import register_tool, ToolRegistry
from app.core.event_bus import event_bus, Event
from app.core.dependency_container import container


def test_dependency_container():
    """
    Verifies singleton registration and resolution in the DI container.
    """
    container.clear()
    
    # Test singleton
    container.register_singleton("test_service", "service_instance")
    assert container.get("test_service") == "service_instance"
    
    # Test factory
    container.register_factory("test_factory", lambda: "new_instance")
    assert container.get("test_factory") == "new_instance"


def test_agent_registry():
    """
    Verifies that agents register dynamically.
    """
    @register_agent(
        role="test_agent_role",
        name="Test Agent",
        description="Handles unit tests assertions",
        tools=["test_tool_name"]
    )
    class DummyAgent:
        pass

    assert AgentRegistry.get_agent_class("test_agent_role") == DummyAgent
    meta = AgentRegistry.get_agent_metadata("test_agent_role")
    assert meta is not None
    assert meta.name == "Test Agent"
    assert meta.tools == ["test_tool_name"]


def test_tool_registry():
    """
    Verifies tool registration, schema auto-generation, and execution.
    """
    @register_tool(name="multiply_numbers")
    def multiply_numbers(a: int, b: int) -> int:
        """
        Multiplies two integers together.
        """
        return a * b

    # Assert registration
    tool = ToolRegistry.get_tool("multiply_numbers")
    assert tool is not None
    assert tool.description == "Multiplies two integers together."

    # Assert schema compilation
    schema = tool.schema
    assert schema["name"] == "multiply_numbers"
    assert "parameters" in schema
    assert "a" in schema["parameters"]["properties"]
    assert "b" in schema["parameters"]["properties"]
    assert "required" in schema["parameters"]
    assert "a" in schema["parameters"]["required"]

    # Assert execution
    res = ToolRegistry.execute("multiply_numbers", {"a": 5, "b": 6})
    assert res == 30


def test_event_bus():
    """
    Verifies asynchronous event subscriptions and publishing.
    """
    async def run_test():
        received_events = []

        async def dummy_handler(event: Event):
            received_events.append(event.data)

        event_bus.subscribe("test_topic", dummy_handler)
        
        # Publish event
        await event_bus.publish("test_topic", {"payload": "hello_world"}, sender="test_runner")
        
        # Wait briefly for execution
        await asyncio.sleep(0.05)
        
        assert len(received_events) == 1
        assert received_events[0]["payload"] == "hello_world"

    asyncio.run(run_test())
