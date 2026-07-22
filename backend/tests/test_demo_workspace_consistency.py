import pytest
from sqlalchemy import text
from app.models.organization import Organization
from app.models.recommendation_trace import RecommendationTrace
from app.models.inventory import InventoryItem
from app.commands.seed_scenarios import seed_demo_workspace_data
from app.services.analytics_service import AnalyticsService
from app.database import Base, SessionLocal, engine

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_demo_workspace_startup_validation_and_consistency(db_session):
    """
    Verifies that:
    1. A demo workspace successfully generates traces and inventory.
    2. The Inventory Intelligence (dashboard metrics) reads from the exact same source 
       as Decision Traceability (RecommendationTrace), resulting in matching counts.
    """
    # 1. Provision a demo workspace
    org = Organization(name="Test Demo Consistency", slug="test-demo-consistency")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    # Seed the data
    seed_demo_workspace_data(db_session, org.id, "luma")
    
    # Assert validation rules
    inventory_count = db_session.query(InventoryItem).filter(InventoryItem.organization_id == org.id).count()
    trace_count = db_session.query(RecommendationTrace).filter(RecommendationTrace.organization_id == org.id).count()
    
    assert inventory_count > 0, "Inventory must be seeded."
    assert trace_count > 0, "Traces must be seeded to avoid silent failure."
    
    # 2. Get Inventory Intelligence metrics
    metrics = AnalyticsService.get_dashboard_metrics(db_session, org.id)
    
    # The sum of recommendations generated on the dashboard
    total_dashboard_recs = (
        len(metrics.get("reorder_recommendations", [])) + 
        len(metrics.get("pricing_recommendations", [])) + 
        len(metrics.get("dead_stock_items", []))
    )
    
    total_traces = db_session.query(RecommendationTrace).filter(RecommendationTrace.organization_id == org.id).count()
    
    assert total_dashboard_recs == total_traces, (
        f"Single Source of Truth violated: "
        f"Inventory Intelligence rendered {total_dashboard_recs} recommendations, "
        f"but Decision Traceability contains {total_traces} records."
    )
