# ==============================================================================
# PURPOSE: Derive the per-workspace daily AI spend ceiling from plan economics.
# DATA FLOW: AgentOrchestrator -> daily_cap_for_org() -> compared against
#            CostGovernanceService.get_daily_cost() before any billed LLM call.
# EXTENSION POINTS: Adjust PLAN_ECONOMICS when prices or vendor rates change; the
#            caps recompute automatically. Do not hardcode a new cap.
#
# ARCHITECTURAL DECISION — why this file exists at all:
#   The previous ceiling was `getattr(settings, "DAILY_ORG_AI_BUDGET", 2.0)`. That
#   constant was never defined in config.py, so every workspace ran on the $2/day
#   fallback: $60/month of AI on a plan intended to sell for $49. A customer who
#   sustained that cap cost more than they paid, and the cap — the very mechanism
#   meant to protect margin — was what permitted the loss.
#
#   The fix is not a different magic number. Each cap is COMPUTED from the plan's
#   price, its known non-AI costs, and a minimum gross-margin floor, so the number
#   is traceable to the economics rather than chosen.
#
# ARCHITECTURAL DECISION — internal guardrail, not metering:
#   The measured cost of an interaction is ~$0.004-$0.02, and expected usage is
#   tens of interactions per month. Every cap below is 15-20x expected usage, so a
#   real customer never reaches one. This is a runaway-cost circuit breaker (a bug,
#   a loop, a scripted abuser), NOT a quota the product sells against. Operators
#   are warned long before any customer is blocked — see WARN_FRACTION.
# ==============================================================================

import logging
from dataclasses import dataclass
from typing import Dict, Optional

logger = logging.getLogger("eve.core.ai_budget")

# The margin floor the guardrail defends. Expected-usage margin is ~86-94%; this
# is the WORST case we are willing to tolerate if a workspace somehow saturates
# its ceiling every day for a whole month.
MIN_GROSS_MARGIN = 0.70

# Operators get a structured warning at this fraction of the cap, so cost drift is
# visible while it is still cheap and long before a customer is refused.
WARN_FRACTION = 0.50

DAYS_PER_MONTH = 30.0


@dataclass(frozen=True)
class PlanEconomics:
    """
    The inputs behind one plan's ceiling.

    Figures come from the unit-economics analysis: support is the modelled
    human-time cost, other_variable covers WhatsApp messages plus Cloud Run and
    marginal storage. All are monthly USD.
    """

    key: str
    display_name: str
    price: float
    support_cost: float
    other_variable_cost: float
    # Monthly AI cost if the customer used their whole nominal allowance, at the
    # doubled 2027 token prices. Recorded so the headroom ratio is auditable.
    allowance_ai_cost: float

    @property
    def monthly_ai_ceiling(self) -> float:
        """Most we can spend on AI per month and still clear MIN_GROSS_MARGIN."""
        total_cost_budget = self.price * (1.0 - MIN_GROSS_MARGIN)
        return max(0.0, total_cost_budget - self.support_cost - self.other_variable_cost)

    @property
    def daily_cap(self) -> float:
        """Monthly ceiling spread evenly, rounded DOWN to a stable 5-cent step."""
        raw = self.monthly_ai_ceiling / DAYS_PER_MONTH
        return max(0.05, (int(raw * 20)) / 20.0)

    @property
    def headroom_vs_allowance(self) -> float:
        """How many times the full plan allowance the cap permits."""
        if self.allowance_ai_cost <= 0:
            return float("inf")
        return self.monthly_ai_ceiling / self.allowance_ai_cost


# Provisional plans, pending approval. Prices here are the ONLY place a price
# appears in backend code; nothing bills against them.
PLAN_ECONOMICS: Dict[str, PlanEconomics] = {
    "operator": PlanEconomics(
        key="operator", display_name="Operator", price=49.0,
        support_cost=6.25, other_variable_cost=0.35, allowance_ai_cost=2.00,
    ),
    "command": PlanEconomics(
        key="command", display_name="Command", price=149.0,
        support_cost=6.25, other_variable_cost=1.25, allowance_ai_cost=10.00,
    ),
    "chief": PlanEconomics(
        key="chief", display_name="Chief", price=399.0,
        support_cost=12.50, other_variable_cost=4.20, allowance_ai_cost=40.00,
    ),
}

# Whatever a workspace's plan turns out to be, an unknown value must not buy more
# headroom than the cheapest plan. Trials and legacy rows land here.
DEFAULT_PLAN_KEY = "operator"

# Existing Profile.plan_type values seen in the database, mapped onto the plans
# above. plan_type defaults to "starter" and predates this analysis.
_PLAN_TYPE_ALIASES: Dict[str, str] = {
    "starter": "operator",
    "free": "operator",
    "trial": "operator",
    "basic": "operator",
    "operator": "operator",
    "pro": "command",
    "growth": "command",
    "command": "command",
    "premium": "chief",
    "enterprise": "chief",
    "chief": "chief",
}


def resolve_plan_key(plan_type: Optional[str]) -> str:
    """Maps a stored plan_type onto a plan key, conservatively."""
    if not plan_type:
        return DEFAULT_PLAN_KEY
    return _PLAN_TYPE_ALIASES.get(str(plan_type).strip().lower(), DEFAULT_PLAN_KEY)


def plan_for_org(db, org_id) -> PlanEconomics:
    """
    Resolves a workspace's plan from the EXISTING Profile.plan_type of its owner.

    Deliberately reuses the column that is already there rather than introducing a
    subscription table: this is a cost guardrail, not billing. If the owner cannot
    be determined the cheapest plan applies, so an unresolvable workspace can never
    obtain a larger allowance than a paying entry-level one.
    """
    try:
        from app.models.organization import Membership
        from app.models.profile import Profile

        row = (
            db.query(Profile.plan_type)
            .join(Membership, Membership.user_id == Profile.id)
            .filter(Membership.organization_id == org_id)
            .order_by(Membership.role.desc())  # "owner" sorts above "admin"/"member"
            .first()
        )
        plan_type = row[0] if row else None
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not resolve plan for org %s: %s", org_id, exc)
        plan_type = None

    return PLAN_ECONOMICS[resolve_plan_key(plan_type)]


def daily_cap_for_org(db, org_id) -> float:
    """The workspace's daily AI spend ceiling in USD."""
    from app.config import settings

    # An explicit operational override always wins, for incident response.
    override = getattr(settings, "DAILY_ORG_AI_BUDGET", 0.0) or 0.0
    if override > 0:
        return float(override)

    return plan_for_org(db, org_id).daily_cap


def check_budget(db, org_id, spent_today: float) -> Optional[str]:
    """
    Returns None when the workspace may proceed, or a merchant-readable reason
    when it must be refused.

    Emits a structured operator warning once spend crosses WARN_FRACTION, which is
    the signal this guardrail is really for: cost drift should be investigated by a
    human long before it ever reaches a customer as a refusal.
    """
    cap = daily_cap_for_org(db, org_id)
    if cap <= 0:
        return None

    if spent_today >= cap * WARN_FRACTION and spent_today < cap:
        try:
            from app.services.alert_service import AlertService

            AlertService._dispatch_alert(
                "ai_budget_pressure",
                f"Workspace {org_id} has used ${spent_today:.4f} of its ${cap:.2f} "
                f"daily AI ceiling.",
                {"organization_id": str(org_id), "spent": spent_today, "cap": cap},
            )
        except Exception:  # pragma: no cover - telemetry must never block a request
            pass

    if spent_today >= cap:
        logger.error(
            "AI ceiling reached for workspace %s: $%.4f >= $%.2f",
            org_id, spent_today, cap,
        )
        # Deliberately not phrased as a quota. A real customer should never see
        # this, and if one does it is far more likely to be our bug than their
        # overuse — so the text points at support rather than at an upgrade.
        return (
            "EVE has paused analysis for today while we check unusually high "
            "activity on this workspace. Your data is unaffected. Please contact "
            "support if you were not expecting this."
        )

    return None
