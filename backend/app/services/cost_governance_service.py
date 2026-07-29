import datetime
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ai_usage import AIUsageLog

logger = logging.getLogger("eve.services.cost_governance_service")


def _day_start() -> datetime.datetime:
    now = datetime.datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _month_start() -> datetime.datetime:
    now = datetime.datetime.utcnow()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


class CostGovernanceService:
    """
    Read model over ai_usage_logs.

    Previously this reconstructed spend by scanning ExecutiveMessage rows and
    parsing JSON telemetry blobs, which saw only the executive chat feature and
    missed inventory analysis, document intelligence and agent orchestration
    entirely. It now reads the single source of truth written by
    app.core.ai_runtime, so every provider and every feature is included.
    """

    @staticmethod
    def get_daily_cost(db: Session, org_id) -> float:
        """Spend for one organization since UTC midnight."""
        try:
            total = db.query(func.coalesce(func.sum(AIUsageLog.cost_usd), 0)).filter(
                AIUsageLog.organization_id == org_id,
                AIUsageLog.created_at >= _day_start(),
            ).scalar()
            return round(float(total or 0), 6)
        except Exception as e:
            logger.error(f"Error calculating daily cost: {e}", exc_info=True)
            return 0.0

    @staticmethod
    def get_global_daily_cost(db: Session) -> float:
        """Spend across all organizations since UTC midnight."""
        try:
            total = db.query(func.coalesce(func.sum(AIUsageLog.cost_usd), 0)).filter(
                AIUsageLog.created_at >= _day_start(),
            ).scalar()
            return round(float(total or 0), 6)
        except Exception as e:
            logger.error(f"Error calculating global daily cost: {e}", exc_info=True)
            return 0.0

    @staticmethod
    def get_monthly_cost(db: Session, org_id: Optional[Any] = None) -> float:
        """Month-to-date spend, globally or for one organization."""
        try:
            q = db.query(func.coalesce(func.sum(AIUsageLog.cost_usd), 0)).filter(
                AIUsageLog.created_at >= _month_start()
            )
            if org_id is not None:
                q = q.filter(AIUsageLog.organization_id == org_id)
            return round(float(q.scalar() or 0), 6)
        except Exception as e:
            logger.error(f"Error calculating monthly cost: {e}", exc_info=True)
            return 0.0

    @staticmethod
    def get_budget_status(db: Session) -> Dict[str, Any]:
        """
        Everything needed to answer 'are we about to have a problem?' in one
        call. This is the shape an owner-dashboard panel would consume — the UI
        itself is deliberately deferred until there are customers generating
        spend worth watching.
        """
        cap = float(settings.AI_DAILY_CAP_USD or 0)
        spent = CostGovernanceService.get_global_daily_cost(db)
        pct = (spent / cap * 100.0) if cap > 0 else 0.0
        return {
            "daily_cap_usd": cap,
            "spent_today_usd": spent,
            "remaining_usd": round(max(cap - spent, 0.0), 6) if cap > 0 else None,
            "percent_used": round(pct, 2),
            "month_to_date_usd": CostGovernanceService.get_monthly_cost(db),
            "kill_switch_active": bool(settings.AI_KILL_SWITCH),
            # 50 / 80 / 95 / 100 ladder from the governance design.
            "threshold": (
                "critical" if pct >= 95 else
                "high" if pct >= 80 else
                "warning" if pct >= 50 else
                "normal"
            ),
        }

    @staticmethod
    def get_spend_breakdown(db: Session, days: int = 1) -> Dict[str, List[Dict[str, Any]]]:
        """Spend grouped by feature, model, organization and status."""
        since = datetime.datetime.utcnow() - datetime.timedelta(days=days)

        def _group(column):
            rows = db.query(
                column,
                func.coalesce(func.sum(AIUsageLog.cost_usd), 0).label("cost"),
                func.count(AIUsageLog.id).label("calls"),
            ).filter(AIUsageLog.created_at >= since).group_by(column).all()
            return [
                {"key": str(r[0]), "cost_usd": round(float(r[1] or 0), 6), "calls": int(r[2])}
                for r in sorted(rows, key=lambda r: float(r[1] or 0), reverse=True)
            ]

        try:
            return {
                "by_feature": _group(AIUsageLog.feature),
                "by_model": _group(AIUsageLog.model),
                "by_organization": _group(AIUsageLog.organization_id),
                "by_status": _group(AIUsageLog.status),
            }
        except Exception as e:
            logger.error(f"Error building spend breakdown: {e}", exc_info=True)
            return {"by_feature": [], "by_model": [], "by_organization": [], "by_status": []}
