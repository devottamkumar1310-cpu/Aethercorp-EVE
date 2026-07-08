import logging
from typing import Dict, Any, List
from app.core.orchestrator.base_engine import BaseEngine, EngineContext, EngineOutput
from app.core.orchestrator.synthesizer import RecommendationSynthesizer

logger = logging.getLogger("eve.orchestrator")

class IntelligenceOrchestrator:
    def __init__(self):
        self._engines: Dict[str, BaseEngine] = {}

    def register_engine(self, engine: BaseEngine):
        """Registers an analytical engine."""
        self._engines[engine.name] = engine
        logger.info(f"Orchestrator: Registered {engine.name}")

    async def execute_engines(self, context: EngineContext) -> Dict[str, EngineOutput]:
        """Executes all registered engines, feeding outputs sequentially into context parameters."""
        outputs = {}
        for name, engine in self._engines.items():
            try:
                # If a previous engine generated metrics, we inject them into the context parameters
                # so subsequent engines (e.g. Optimization / Confidence / Classification) can access them.
                output = await engine.execute(context)
                outputs[name] = output
                if output.success:
                    if name == "forecast_engine":
                        context.parameters["forecast_value"] = output.data.get("forecast_value")
                    elif name == "optimization_engine":
                        context.parameters["reorder_point"] = output.data.get("reorder_point")
                        context.parameters["safety_stock"] = output.data.get("safety_stock")
            except Exception as e:
                logger.error(f"Engine {name} execution failed: {str(e)}")
                outputs[name] = EngineOutput(
                    engine_name=name,
                    success=False,
                    errors=[str(e)],
                    confidence_weight=0.0
                )
        return outputs

    async def run_pipeline(self, context: EngineContext) -> Dict[str, Any]:
        """Runs the orchestrator execution and feeds outputs to the synthesizer."""
        results = await self.execute_engines(context)
        synthesized = RecommendationSynthesizer.synthesize(results, context)
        
        # Keep engine traces for diagnostics/testing
        synthesized["engine_outputs"] = {
            name: (out.model_dump() if hasattr(out, "model_dump") else out.__dict__)
            for name, out in results.items()
        }
        return synthesized
