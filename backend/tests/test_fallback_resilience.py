# ==============================================================================
# PURPOSE: Regression tests for the deterministic fallback that runs when Gemini
#          is unavailable, and for the central Gemini model migration.
#
# THE BUG THIS PROTECTS AGAINST:
#   business_health_service.get_health_score() returns {"score": None} when a
#   workspace has no clients AND no revenue — an "insufficient data" signal. That
#   is the normal state of a Shopify-only merchant: real inventory, no CRM or
#   finance rows. executive_board did `health.get("score", 50.0)`, which does NOT
#   default when the key exists with a None value, then called int(score).
#
#   Result: whenever Gemini failed for such a workspace, the fallback — the ONLY
#   remaining path — raised TypeError and the user got a 503. The safety net had
#   a hole exactly where it was most needed.
# ==============================================================================

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.client import Client
from app.models.finance import Revenue
from app.models.inventory import InventoryItem
from app.models.organization import Membership, Organization
from app.models.product import Product
from app.models.profile import Profile
from app.services.ai.executive_board import ExecutiveBoard
from app.services.business_health_service import get_health_score

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


def _workspace(db, *, with_revenue=False, with_clients=False, with_inventory=True):
    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    db.add_all([
        Profile(id=user_id, email=f"{user_id.hex[:8]}@x.com", full_name="P",
                hashed_password="x"),
        Organization(id=org_id, name="FB Co", slug=f"fb-{org_id.hex[:8]}"),
        Membership(user_id=user_id, organization_id=org_id, role="owner"),
    ])
    db.flush()

    if with_inventory:
        product = Product(
            id=uuid.uuid4(), organization_id=org_id, sku=f"FB-{org_id.hex[:4]}",
            name="Fallback Test Jacket", category="Outerwear",
            unit_cost=40.0, selling_price=120.0,
        )
        db.add(product)
        db.flush()
        db.add(InventoryItem(
            id=uuid.uuid4(), organization_id=org_id, product_id=product.id,
            stock_on_hand=2, reorder_point=20, safety_stock=8,
            lead_time_days=14, avg_daily_sales=1.5,
        ))
    # Revenue -> Project -> Client is a NOT NULL chain, so a scored workspace
    # needs all three.
    client_id = None
    if with_clients or with_revenue:
        client_id = uuid.uuid4()
        db.add(Client(
            id=client_id, organization_id=org_id, company_name="C",
            contact_person="C", email=f"c{client_id.hex[:6]}@x.com", status="active",
        ))
        db.flush()
    if with_revenue:
        import datetime

        from app.models.project import Project

        project = Project(
            id=uuid.uuid4(), organization_id=org_id, name="FB Project",
            client_id=client_id, status="active",
        )
        db.add(project)
        db.flush()
        db.add(Revenue(
            id=uuid.uuid4(), organization_id=org_id, project_id=project.id,
            amount=5000.0, date=datetime.datetime.utcnow(), description="Sales",
        ))
    db.commit()
    return org_id


class TestHealthScorePremise:
    def test_shopify_only_workspace_really_does_yield_a_none_score(self, db):
        """Establishes the precondition the fallback must survive."""
        org_id = _workspace(db, with_revenue=False, with_clients=False)
        health = get_health_score(db, org_id)
        assert health["score"] is None
        # And the naive default does not save you — this is the trap.
        assert health.get("score", 50.0) is None


class TestDeterministicFallback:
    def test_fallback_survives_a_none_health_score(self, db):
        """The regression: this raised TypeError: int() argument ... not 'NoneType'."""
        org_id = _workspace(db, with_revenue=False, with_clients=False)
        board = ExecutiveBoard(gemini_service=None)

        result = board.generate_deterministic_fallback(
            db, org_id, "What inventory should I reorder?"
        )

        assert result is not None
        assert result.summary
        # Schema preserved.
        assert hasattr(result, "priorities")
        assert hasattr(result, "confidence_scores")
        assert hasattr(result, "evidence_used")

    def test_unavailable_score_is_reported_as_unknown_not_invented(self, db):
        org_id = _workspace(db, with_revenue=False, with_clients=False)
        board = ExecutiveBoard(gemini_service=None)

        result = board.generate_deterministic_fallback(
            db, org_id, "What inventory should I reorder?"
        )

        evidence = result.evidence_used or {}
        if "business_health_score" in evidence:
            # None is the honest answer. A number here would be fabricated.
            assert evidence["business_health_score"] is None

        blob = result.summary + str(result.findings_by_agent) + str(result.expected_impact)
        # The old code rendered a bare "None" into merchant-facing prose.
        assert "None/100" not in blob
        assert "Health Score: None" not in blob
        assert "from None back above" not in blob

    def test_fallback_still_works_with_a_real_score(self, db):
        """The normal path must be unchanged by the None handling."""
        org_id = _workspace(db, with_revenue=True, with_clients=True)
        health = get_health_score(db, org_id)
        assert isinstance(health["score"], (int, float))

        board = ExecutiveBoard(gemini_service=None)
        result = board.generate_deterministic_fallback(
            db, org_id, "What inventory should I reorder?"
        )

        assert result.summary
        evidence = result.evidence_used or {}
        if evidence.get("business_health_score") is not None:
            assert isinstance(evidence["business_health_score"], int)

    def test_fallback_never_invents_a_sku(self, db):
        org_id = _workspace(db, with_revenue=False, with_clients=False)
        board = ExecutiveBoard(gemini_service=None)
        result = board.generate_deterministic_fallback(
            db, org_id, "Which products are at risk of stockout?"
        )
        blob = result.summary + str(result.findings_by_agent) + str(result.recommendations_by_agent)
        for invented in ("SKU-123", "ABC-001", "XYZ-999", "EXAMPLE-SKU"):
            assert invented not in blob


class TestOrchestratorSurvivesGeminiOutage:
    """End-to-end: a provider outage must degrade, not 503."""

    def test_gemini_failure_yields_an_answer_rather_than_503(self, db):
        import asyncio

        from fastapi import HTTPException

        from app.services.ai.agent_orchestrator import AgentOrchestrator

        org_id = _workspace(db, with_revenue=False, with_clients=False)
        orchestrator = AgentOrchestrator()

        with patch.object(
            ExecutiveBoard, "run_board", new_callable=AsyncMock
        ) as run_board:
            run_board.side_effect = RuntimeError("Gemini structured generation failed: 503")
            try:
                message = asyncio.run(orchestrator.orchestrate(
                    db=db, org_id=org_id,
                    question="What inventory should I reorder?",
                    developer_mode=False, depth="baseline",
                ))
            except HTTPException as exc:
                pytest.fail(
                    f"provider outage surfaced as HTTP {exc.status_code} instead of "
                    "falling back to the deterministic path"
                )

        assert message.content
        assert "None/100" not in message.content


class TestModelMigration:
    def test_single_source_of_truth_is_the_current_model(self):
        from app.services.gemini_service import DEFAULT_MODEL

        # gemini-2.5-flash is retired (shutdown 2026-10-16) and already refuses
        # new callers.
        assert not DEFAULT_MODEL.startswith("gemini-2.")
        assert DEFAULT_MODEL == "gemini-3.6-flash"

    def test_no_module_hardcodes_a_retired_model(self):
        """The 2.5 retirement was a repo-wide change; keep it a one-line one."""
        import pathlib

        root = pathlib.Path(__file__).resolve().parent.parent / "app"
        offenders = []
        for path in root.rglob("*.py"):
            text = path.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if "gemini-2." not in line:
                    continue
                # The PRICING table must retain retired models so historical
                # AIUsageLog rows still cost out correctly, and comments may
                # name them.
                stripped = line.strip()
                if stripped.startswith("#") or '("google", "gemini-2.' in line:
                    continue
                offenders.append(f"{path.name}:{lineno}: {stripped[:80]}")
        assert not offenders, "retired model hardcoded:\n" + "\n".join(offenders)

    def test_current_model_is_priced(self):
        """An unpriced model silently bills at the pessimistic fallback rate."""
        from app.core.ai_runtime import PRICING
        from app.services.gemini_service import DEFAULT_MODEL

        assert ("google", DEFAULT_MODEL) in PRICING

    def test_2027_price_increase_is_recorded(self):
        from app.core.ai_runtime import PRICING, PRICING_2027
        from app.services.gemini_service import DEFAULT_MODEL

        key = ("google", DEFAULT_MODEL)
        assert key in PRICING_2027
        # The announced change is a 2x step; margin modelling depends on it.
        assert PRICING_2027[key][0] > PRICING[key][0]
        assert PRICING_2027[key][1] > PRICING[key][1]
