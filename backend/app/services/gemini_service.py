# ==============================================================================
# PURPOSE: Centralized Google Gemini API client service.
# DATA FLOW: Accepts prompt requests -> applies retry/backoff policies ->
#            queries Gemini -> parses and returns structured Pydantic models.
# EXTENSION POINTS: Add cache decorators, custom temperature settings, or support regional endpoints.
# ARCHITECTURAL DECISION:
# - Serves as the single model client provider, avoiding duplicate client initializations.
# - Leverages standard Python thread executors and asyncio.wait_for to enforce timeouts.
# - Uses Pydantic schemas in `generate_structured_response` to force type-safe LLM outputs.
# ==============================================================================

import time
import logging
import asyncio
from typing import List, Dict, Any, Optional, Type
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.config import settings
from app.core.tool_registry import ToolRegistry
from app.schemas.agent_response import AgentResponseSchema, TokenUsageSchema

logger = logging.getLogger("eve.services.gemini_service")


class GeminiService:
    """
    Main communication client for Gemini models.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.client = None
        self.mock_mode = False

        if not self.api_key or self.api_key == "YOUR_GEMINI_API_KEY_HERE" or len(self.api_key) < 20:
            logger.warning("GEMINI_API_KEY is not set or format is invalid. Running in MOCK MODE.")
            self.mock_mode = True
        else:
            try:
                # Initialize Google GenAI client
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Gemini service client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Client: {e}. Falling back to MOCK MODE.")
                self.mock_mode = True

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        timeout: float = 30.0,
        retries: int = 3
    ) -> str:
        """
        Generates standard text response from Gemini.
        Includes retry logic with exponential backoff and timeout handling.
        """
        if self.mock_mode:
            await asyncio.sleep(0.1)
            return "Mock text response generated successfully."

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2
        )

        backoff = 1.0
        for attempt in range(retries):
            try:
                loop = asyncio.get_event_loop()
                def call_api():
                    return self.client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config
                    )
                
                # Execute with timeout limit
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, call_api),
                    timeout=timeout
                )
                
                if response.text:
                    return response.text
                return "Empty response text."

            except asyncio.TimeoutError:
                logger.error(f"Gemini generate_text timed out on attempt {attempt+1}/{retries}")
                if attempt == retries - 1:
                    raise RuntimeError("Gemini request timed out after maximum retries.")
            except Exception as e:
                logger.error(f"Gemini generate_text failed on attempt {attempt+1}/{retries}: {e}")
                if "API key not valid" in str(e) or "API_KEY_INVALID" in str(e):
                    logger.warning("Invalid API key detected during generate_text. Switching to mock mode.")
                    self.mock_mode = True
                    return "Mock text response generated successfully."
                if attempt == retries - 1:
                    raise e
                    
            await asyncio.sleep(backoff)
            backoff *= 2.0

    async def generate_structured_response(
        self,
        prompt: str,
        response_schema: Type[BaseModel],
        system_instruction: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        timeout: float = 30.0,
        retries: int = 3
    ) -> BaseModel:
        """
        Generates a structured Pydantic response from Gemini.
        Includes retry logic with exponential backoff and timeout handling.
        """
        if self.mock_mode:
            await asyncio.sleep(0.1)
            return self._generate_mock_structured(response_schema)

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=response_schema
        )

        backoff = 1.0
        for attempt in range(retries):
            try:
                loop = asyncio.get_event_loop()
                def call_api():
                    return self.client.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config
                    )
                
                response = await asyncio.wait_for(
                    loop.run_in_executor(None, call_api),
                    timeout=timeout
                )

                # Parse JSON string from text back to Pydantic object
                if response.text:
                    return response_schema.model_validate_json(response.text)
                raise ValueError("Received empty response text.")

            except asyncio.TimeoutError:
                logger.error(f"Gemini generate_structured_response timed out on attempt {attempt+1}/{retries}")
                if attempt == retries - 1:
                    raise RuntimeError("Gemini structured request timed out after maximum retries.")
            except Exception as e:
                logger.error(f"Gemini generate_structured_response failed on attempt {attempt+1}/{retries}: {e}")
                if "API key not valid" in str(e) or "API_KEY_INVALID" in str(e):
                    logger.warning("Invalid API key detected during generate_structured_response. Switching to mock mode.")
                    self.mock_mode = True
                    return self._generate_mock_structured(response_schema)
                if attempt == retries - 1:
                    raise e
                    
            await asyncio.sleep(backoff)
            backoff *= 2.0

    async def generate_response(
        self,
        prompt: str,
        system_instruction: str,
        agent_role: str,
        tool_names: List[str],
        model: str = "gemini-2.5-flash",
        timeout: float = 45.0,
        retries: int = 3
    ) -> AgentResponseSchema:
        """
        Executes a prompt against Gemini. Supports automated tool execution loops and timeout limits.
        """
        start_time = time.time()
        
        if self.mock_mode:
            return await self._generate_mock_response(prompt, system_instruction, agent_role, tool_names)

        try:
            # Prepare tools configuration
            gemini_tools = []
            registered_schemas = ToolRegistry.get_all_tool_schemas(tool_names)
            for schema in registered_schemas:
                gemini_tools.append(
                    types.FunctionDeclaration(
                        name=schema["name"],
                        description=schema["description"],
                        parameters=schema["parameters"]
                    )
                )

            # Set configurations
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
            
            if gemini_tools:
                config.tools = [types.Tool(function_declarations=gemini_tools)]

            logger.info(f"Sending request to Gemini ({model}) for agent '{agent_role}' with {len(tool_names)} tools...")
            
            # Execute model call with retries and timeout
            backoff = 1.0
            response = None
            
            for attempt in range(retries):
                try:
                    loop = asyncio.get_event_loop()
                    def call_model():
                        return self.client.models.generate_content(
                            model=model,
                            contents=prompt,
                            config=config
                        )
                        
                    response = await asyncio.wait_for(
                        loop.run_in_executor(None, call_model),
                        timeout=timeout
                    )
                    break # Success, break retry loop
                except asyncio.TimeoutError:
                    logger.error(f"Gemini call timed out for agent '{agent_role}' (Attempt {attempt+1}/{retries})")
                    if attempt == retries - 1:
                        raise
                except Exception as e:
                    logger.error(f"Gemini call failed for agent '{agent_role}' (Attempt {attempt+1}/{retries}): {e}")
                    if "API key not valid" in str(e) or "API_KEY_INVALID" in str(e):
                        logger.warning("Invalid API key detected during generate_response. Switching to mock mode.")
                        self.mock_mode = True
                        return await self._generate_mock_response(prompt, system_instruction, agent_role, tool_names)
                    if attempt == retries - 1:
                        raise
                await asyncio.sleep(backoff)
                backoff *= 2.0

            # Parse responses and execution loops if function calls are returned
            thoughts = ["Received initial response from model."]
            result_data = {}
            
            # Check for function/tool call request
            function_calls = response.function_calls
            if function_calls:
                for fc in function_calls:
                    tool_name = fc.name
                    args = fc.args
                    thoughts.append(f"Model requested tool call: {tool_name} with args: {args}")
                    logger.info(f"Agent '{agent_role}' calling tool '{tool_name}'...")
                    
                    # Run the tool locally
                    tool_result = ToolRegistry.execute(tool_name, args)
                    thoughts.append(f"Tool '{tool_name}' executed. Result: {tool_result}")
                    
                    if isinstance(tool_result, dict):
                        result_data.update(tool_result)
                    else:
                        result_data[tool_name] = tool_result
            
            if response.text:
                result_data["explanation"] = response.text
                thoughts.append("Model provided textual synthesis.")

            # Calculate token metrics
            prompt_tokens = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
            completion_tokens = response.usage_metadata.candidates_token_count if response.usage_metadata else 0
            total_tokens = response.usage_metadata.total_token_count if response.usage_metadata else 0
            
            token_usage = TokenUsageSchema(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens
            )
            
            cost = (prompt_tokens * 0.000000075) + (completion_tokens * 0.00000030)
            latency = time.time() - start_time
            
            return AgentResponseSchema(
                agent_role=agent_role,
                status="success",
                result=result_data,
                thoughts=thoughts,
                latency_seconds=latency,
                estimated_cost=cost,
                token_usage=token_usage
            )

        except Exception as e:
            logger.error(f"Error calling Gemini: {e}", exc_info=e)
            return AgentResponseSchema(
                agent_role=agent_role,
                status="failure",
                thoughts=[f"Error encountered during LLM inference: {str(e)}"],
                latency_seconds=time.time() - start_time,
                error_message=str(e)
            )

    def _generate_mock_structured(self, response_schema: Type[BaseModel]) -> BaseModel:
        """
        Dynamically constructs dummy dict matching Pydantic class signatures for offline development.
        """
        dummy = {}
        for name, field in response_schema.model_fields.items():
            field_type = field.annotation
            
            # Check type arguments and defaults
            if field_type == int:
                dummy[name] = 10
            elif field_type == float:
                dummy[name] = 4500.00
            elif field_type == str:
                dummy[name] = "Projected optimization suggestion."
            elif field_type == bool:
                dummy[name] = True
            elif getattr(field_type, "__origin__", None) == list:
                dummy[name] = []
            elif getattr(field_type, "__origin__", None) == dict:
                dummy[name] = {}
            else:
                dummy[name] = None
        return response_schema.model_validate(dummy)

    async def _generate_mock_response(
        self,
        prompt: str,
        system_instruction: str,
        agent_role: str,
        tool_names: List[str]
    ) -> AgentResponseSchema:
        """
        Generates simulated high-quality agent outputs for local testing when no API key exists.
        """
        logger.debug(f"Simulating mock agent execution for role: '{agent_role}'")
        await asyncio.sleep(0.5)
        
        thoughts = [
            "Mock Mode Activated: Skipping Gemini API call.",
            f"Parsing agent system prompt context: '{agent_role}'",
            f"Auto-executing available tools: {tool_names}"
        ]
        
        result_data = {}
        
        for name in tool_names:
            try:
                sig = inspect.signature(ToolRegistry.get_tool(name).func)
                dummy_args = {}
                for param_name, param in sig.parameters.items():
                    if param_name == "organization_id":
                        dummy_args["organization_id"] = 1
                    elif param.default != inspect.Parameter.empty:
                        dummy_args[param_name] = param.default
                
                tool_result = ToolRegistry.execute(name, dummy_args)
                thoughts.append(f"Auto-run tool '{name}' successfully.")
                if isinstance(tool_result, dict):
                    result_data.update(tool_result)
                else:
                    result_data[name] = tool_result
            except Exception as e:
                thoughts.append(f"Skipped auto-run tool '{name}': require parameters ({e})")

        if agent_role == "inventory":
            result_data["recommendation"] = "Reorder top-selling Category 'Tops' SKU-001 by 150 units. Safety stock thresholds are violated due to lead times."
        elif agent_role == "pricing":
            result_data["recommendation"] = "Increase retail price of SKU-001 by 5.5% ($45.00 -> $47.50) to optimize margins. High price elasticity suggests low volume drop."
        elif agent_role == "executive":
            result_data["recommendation"] = "Overall inventory health is stable. We suggest replenishing core tops and increasing select retail pricing to boost profitability by $4,500."

        return AgentResponseSchema(
            agent_role=agent_role,
            status="success",
            result=result_data,
            thoughts=thoughts,
            latency_seconds=0.5,
            estimated_cost=0.0,
            token_usage=TokenUsageSchema(prompt_tokens=100, completion_tokens=150, total_tokens=250)
        )


import inspect
import asyncio
from app.core.dependency_container import container
container.register_singleton("gemini_service", GeminiService())
