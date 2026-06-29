# ==============================================================================
# PURPOSE: Integration tests for EVE Recommendation Evidence Snapshots.
# DATA FLOW: Creates trace with evidence snapshot, modifies underlying data values,
#            and asserts that the trace data snapshot remains immutable.
# ==============================================================================

import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.organization import Organization
from app.models.product import Product
from app.models.inventory import InventoryItem
from app.services.recommendation_trace_service import RecommendationTraceService

# 1. Setup isolated memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def test_evidence_snapshot_immutability():
    """
    Verifies that changes to underlying live database records do not affect
    the stored immutable evidence snapshot.
    """
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    product_id = uuid.uuid4()

    try:
        # 1. Setup tenant organization
        org = Organization(id=org_id, name="Snapshot Corp", slug="snap-corp")
        db.add(org)

        # 2. Setup product
        prod = Product(
            id=product_id,
            organization_id=org_id,
            sku="SKU-SNAP-1",
            name="Snapshot Tee",
            category="Tops",
            unit_cost=10.0,
            selling_price=25.0
        )
        db.add(prod)

        # 3. Setup inventory item (stock = 10)
        item = InventoryItem(
            id=uuid.uuid4(),
            organization_id=org_id,
            product_id=product_id,
            stock_on_hand=10,
            reorder_point=50,
            safety_stock=20
        )
        db.add(item)
        db.commit()

        # 4. Generate recommendation trace containing evidence snapshot
        trace = RecommendationTraceService.create_trace(
            db=db,
            org_id=org_id,
            rec_type="inventory",
            action="Order 500 units of Snapshot Tee",
            confidence=0.94,
            sources=[f"InventoryItem (SKU-SNAP-1)"],
            metrics={"current_stock": item.stock_on_hand},
            reasoning=["Stock level fell below safety limit."],
            evidence_snapshot={
                "stock_on_hand": item.stock_on_hand,
                "reorder_point": item.reorder_point,
                "daily_velocity": 3,
                "lead_time_days": 15
            }
        )

        # Confirm snapshot values
        assert trace.evidence_snapshot["stock_on_hand"] == 10

        # 5. Modify original live database record (increase stock to 100)
        item.stock_on_hand = 100
        db.add(item)
        db.commit()

        # Refresh trace from database
        db.refresh(trace)

        # 6. Assert database change has NOT mutated the trace snapshot
        assert item.stock_on_hand == 100
        assert trace.evidence_snapshot["stock_on_hand"] == 10
        assert trace.evidence_snapshot["reorder_point"] == 50

    finally:
        db.close()
