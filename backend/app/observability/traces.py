# ==============================================================================
# PURPOSE: Spans and Traces Logger.
# DATA FLOW: Logs timestamps at entry and exit of functions -> computes duration -> stores logs.
# EXTENSION POINTS: Connect to OpenTelemetry, Jaeger, or AWS X-Ray.
# ==============================================================================

import time
import logging
from typing import Dict, List, Any

logger = logging.getLogger("eve.observability.traces")


class Span:
    """
    Represents a timed block of execution (e.g. agent call, workflow run).
    """
    def __init__(self, name: str, trace_id: str):
        self.name = name
        self.trace_id = trace_id
        self.start_time = time.time()
        self.end_time = None
        self.duration = 0.0

    def close(self):
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time


class TraceStore:
    """
    In-memory storage for active execution trace spans.
    """
    _traces: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    def start_span(cls, trace_id: str, name: str) -> Span:
        """
        Creates and starts a timed execution span.
        """
        return Span(name, trace_id)

    @classmethod
    def record_span(cls, span: Span):
        """
        Closes and saves a timed span.
        """
        span.close()
        if span.trace_id not in cls._traces:
            cls._traces[span.trace_id] = []
            
        cls._traces[span.trace_id].append({
            "name": span.name,
            "duration_seconds": round(span.duration, 3),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(span.start_time))
        })
        logger.info(f"TraceStore [{span.trace_id}]: Span '{span.name}' completed in {span.duration:.3f}s")

    @classmethod
    def get_trace_history(cls, trace_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all spans associated with a trace/run ID.
        """
        return cls._traces.get(trace_id, [])
