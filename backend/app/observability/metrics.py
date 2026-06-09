# ==============================================================================
# PURPOSE: Performance Metrics Collector.
# DATA FLOW: Aggregates latency statistics and success counts -> returns rate percentages.
# EXTENSION POINTS: Add alerts when success rate drops below SLA thresholds (e.g. <95%).
# ==============================================================================

import logging
from typing import Dict, List, Any

logger = logging.getLogger("eve.observability.metrics")


class MetricsCollector:
    """
    Tracks service-level metrics for EVE.
    """
    _latencies: List[float] = []
    _success_count = 0
    _failure_count = 0

    @classmethod
    def record_execution(cls, duration_seconds: float, was_successful: bool):
        """
        Logs duration and status of a workflow execution.
        """
        cls._latencies.append(duration_seconds)
        if was_successful:
            cls._success_count += 1
        else:
            cls._failure_count += 1

    @classmethod
    def get_summary_metrics(cls) -> Dict[str, Any]:
        """
        Returns average latency and success rates.
        """
        total = cls._success_count + cls._failure_count
        success_rate = (cls._success_count / total * 100.0) if total > 0 else 100.0
        avg_latency = (sum(cls._latencies) / len(cls._latencies)) if cls._latencies else 0.0

        return {
            "total_runs": total,
            "success_rate_pct": round(success_rate, 2),
            "average_latency_seconds": round(avg_latency, 2),
            "latencies_history": [round(x, 2) for x in cls._latencies[-10:]] # last 10 runs
        }
