# ==============================================================================
# PURPOSE: Tests for the per-plan AI spend ceiling (app/core/ai_budget.py).
#
# WHAT THIS PROTECTS: the previous ceiling was an undefined setting read via
# getattr with a $2/day fallback — $60/month of AI on a $49 plan, i.e. the
# guardrail itself permitted a negative gross margin. These tests assert the
# ceiling is now derived from plan economics and can never do that again.
# ==============================================================================

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.ai_budget import (
    DEFAULT_PLAN_KEY,
    MIN_GROSS_MARGIN,
    PLAN_ECONOMICS,
    check_budget,
    daily_cap_for_org,
    plan_for_org,
    resolve_plan_key,
)
from app.database import Base
from app.models.organization import Membership, Organization
from app.models.profile import Profile

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def no_override(monkeypatch):
    """Most tests exercise the derived cap, not the incident override."""
    monkeypatch.setattr(settings, "DAILY_ORG_AI_BUDGET", 0.0)


def _workspace(db, plan_type):
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    db.add_all([
        Profile(id=user_id, email=f"{user_id.hex[:8]}@x.com", full_name="P",
                hashed_password="x", plan_type=plan_type),
        Organization(id=org_id, name="W", slug=f"budget-{org_id.hex[:8]}"),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    db.commit()
    return org_id


class TestDerivation:
    def test_every_plan_clears_the_margin_floor_at_its_ceiling(self):
        """The load-bearing property: saturating the cap every day stays profitable."""
        for plan in PLAN_ECONOMICS.values():
            worst_cost = (
                plan.support_cost + plan.other_variable_cost + plan.daily_cap * 30
            )
            margin = (plan.price - worst_cost) / plan.price
            assert margin >= MIN_GROSS_MARGIN - 0.01, (
                f"{plan.display_name}: worst-case margin {margin:.1%} "
                f"below floor {MIN_GROSS_MARGIN:.0%}"
            )

    def test_the_old_flat_ceiling_would_have_failed_this_test(self):
        """Documents the regression being prevented, in numbers."""
        operator = PLAN_ECONOMICS["operator"]
        old_monthly_ai = 2.00 * 30  # the previous getattr fallback
        old_cost = operator.support_cost + operator.other_variable_cost + old_monthly_ai
        old_margin = (operator.price - old_cost) / operator.price
        assert old_margin < 0, "the old ceiling should be provably loss-making"

    def test_ceiling_leaves_generous_headroom_over_the_plan_allowance(self):
        """A real customer must never reach the cap — it is a breaker, not a quota."""
        for plan in PLAN_ECONOMICS.values():
            assert plan.headroom_vs_allowance >= 2.0, (
                f"{plan.display_name}: only {plan.headroom_vs_allowance:.1f}x "
                "the full allowance, too tight to be invisible"
            )

    def test_caps_increase_with_plan_price(self):
        caps = [PLAN_ECONOMICS[k].daily_cap for k in ("operator", "command", "chief")]
        assert caps == sorted(caps)
        assert len(set(caps)) == 3, "plans must not share one flat ceiling"

    def test_ceiling_is_never_negative_or_zero(self):
        for plan in PLAN_ECONOMICS.values():
            assert plan.daily_cap > 0


class TestPlanResolution:
    @pytest.mark.parametrize("stored,expected", [
        ("starter", "operator"), ("free", "operator"), ("trial", "operator"),
        ("pro", "command"), ("growth", "command"),
        ("enterprise", "chief"), ("premium", "chief"),
        ("STARTER", "operator"), ("  Pro  ", "command"),
    ])
    def test_existing_plan_type_values_map_onto_plans(self, stored, expected):
        assert resolve_plan_key(stored) == expected

    @pytest.mark.parametrize("stored", [None, "", "something-unknown", "legacy-tier-7"])
    def test_unknown_plan_falls_back_to_the_cheapest(self, stored):
        # An unresolvable workspace must never obtain more headroom than a paying
        # entry-level one.
        assert resolve_plan_key(stored) == DEFAULT_PLAN_KEY

    def test_plan_resolved_from_the_workspace_owner(self, db):
        org_id = _workspace(db, "enterprise")
        assert plan_for_org(db, org_id).key == "chief"

    def test_workspace_with_no_membership_gets_the_default_cap(self, db):
        orphan = uuid.uuid4()
        db.add(Organization(id=orphan, name="Orphan", slug=f"orph-{orphan.hex[:8]}"))
        db.commit()
        assert daily_cap_for_org(db, orphan) == PLAN_ECONOMICS[DEFAULT_PLAN_KEY].daily_cap


class TestEnforcement:
    def test_normal_usage_is_never_refused(self, db):
        org_id = _workspace(db, "starter")
        # Measured expected usage for a small customer is ~$0.0145/day.
        assert check_budget(db, org_id, 0.0145) is None

    def test_usage_at_the_ceiling_is_refused(self, db):
        org_id = _workspace(db, "starter")
        cap = daily_cap_for_org(db, org_id)
        refusal = check_budget(db, org_id, cap)
        assert refusal is not None
        # The message must not read as a sold quota the customer overran.
        assert "limit exceeded" not in refusal.lower()
        assert "upgrade" not in refusal.lower()
        assert "support" in refusal.lower()

    def test_higher_plans_tolerate_more_spend(self, db):
        entry = _workspace(db, "starter")
        top = _workspace(db, "enterprise")
        spend = 1.00  # over Operator's ceiling, well under Chief's
        assert check_budget(db, entry, spend) is not None
        assert check_budget(db, top, spend) is None

    def test_incident_override_supersedes_every_plan(self, db, monkeypatch):
        org_id = _workspace(db, "starter")
        monkeypatch.setattr(settings, "DAILY_ORG_AI_BUDGET", 99.0)
        assert daily_cap_for_org(db, org_id) == 99.0
        assert check_budget(db, org_id, 50.0) is None

    def test_warning_fires_before_any_customer_is_refused(self, db, monkeypatch):
        """Cost drift must reach an operator while spend is still permitted."""
        org_id = _workspace(db, "starter")
        cap = daily_cap_for_org(db, org_id)

        alerts = []
        from app.services import alert_service

        monkeypatch.setattr(
            alert_service.AlertService, "_dispatch_alert",
            classmethod(lambda cls, t, m, meta=None: alerts.append(t)),
        )

        assert check_budget(db, org_id, cap * 0.6) is None  # permitted...
        assert "ai_budget_pressure" in alerts                # ...but flagged
