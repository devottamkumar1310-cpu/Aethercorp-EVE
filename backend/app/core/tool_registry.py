# ==============================================================================
# PURPOSE: Tool Registry for Agent Function Calling.
# DATA FLOW: Decorator registers python functions. Agents request tool definitions to send to Gemini.
#            Gemini returns tool calls, which are dispatched and executed here.
# EXTENSION POINTS: Add rate limiting, argument validation pipelines, or permission scopes.
# ARCHITECTURAL DECISION:
# - Auto-generates JSON schema declarations from Python type hints and docstrings.
# - Eliminates the need to write redundant JSON schemas for each tool manually.
# ==============================================================================

import inspect
import logging
from typing import Callable, Dict, Any, List, get_type_hints, Optional

logger = logging.getLogger("eve.core.tool_registry")


class Tool:
    """
    Wrapper for a registered python function, containing its schema for Gemini API ingestion.
    """
    def __init__(self, name: str, func: Callable, description: str, schema: Dict[str, Any]):
        self.name = name
        self.func = func
        self.description = description
        self.schema = schema

    def execute(self, **kwargs) -> Any:
        """
        Executes the underlying python function with provided arguments.
        """
        try:
            return self.func(**kwargs)
        except Exception as e:
            logger.error(f"Error executing tool '{self.name}': {e}")
            raise e


class ToolRegistry:
    """
    Registry container for all callable tools.
    """
    _tools: Dict[str, Tool] = {}

    @classmethod
    def register(cls, name: Optional[str] = None):
        """
        Decorator to register a python function as an agent tool.
        """
        def decorator(func: Callable):
            tool_name = name or func.__name__
            docstring = func.__doc__ or "No description provided."
            
            # Simple docstring cleaner
            description = docstring.strip().split("\n")[0]
            
            # Auto-generate schema from function signature and annotations
            schema = cls._generate_schema(tool_name, func, description)
            
            cls._tools[tool_name] = Tool(
                name=tool_name,
                func=func,
                description=description,
                schema=schema
            )
            logger.info(f"Registered tool: {tool_name} - {description}")
            return func
        return decorator

    @classmethod
    def get_tool(cls, name: str) -> Optional[Tool]:
        """
        Retrieves a tool wrapper by its registration name.
        """
        return cls._tools.get(name)

    @classmethod
    def get_all_tool_schemas(cls, tool_names: List[str]) -> List[Dict[str, Any]]:
        """
        Returns schemas for selected tools to pass directly to Gemini API.
        """
        schemas = []
        for name in tool_names:
            tool = cls.get_tool(name)
            if tool:
                schemas.append(tool.schema)
        return schemas

    @classmethod
    def execute(cls, name: str, arguments: Dict[str, Any]) -> Any:
        """
        Executes tool by name with arguments.
        """
        tool = cls.get_tool(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found in registry.")
        return tool.execute(**arguments)

    @classmethod
    def _generate_schema(cls, name: str, func: Callable, description: str) -> Dict[str, Any]:
        """
        Helper that uses inspect to convert Python signatures to Gemini-compatible JSON schema.
        """
        sig = inspect.signature(func)
        type_hints = get_type_hints(func)
        
        properties = {}
        required = []
        
        for param_name, param in sig.parameters.items():
            if param_name == "self" or param_name == "args" or param_name == "kwargs":
                continue
                
            param_type = type_hints.get(param_name, str)
            
            # Map Python types to JSON Schema types
            type_str = "string"
            if param_type == int:
                type_str = "integer"
            elif param_type == float:
                type_str = "number"
            elif param_type == bool:
                type_str = "boolean"
            elif param_type == list or getattr(param_type, "__origin__", None) == list:
                type_str = "array"
            elif param_type == dict or getattr(param_type, "__origin__", None) == dict:
                type_str = "object"
                
            properties[param_name] = {
                "type": type_str,
                "description": f"Argument: {param_name}"
            }
            
            # Check if parameter has no default value (making it required)
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
                
        # Format matching Google GenAI tool declaration
        return {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }


# Global registry decorator helper
register_tool = ToolRegistry.register
