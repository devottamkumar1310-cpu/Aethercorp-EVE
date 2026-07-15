import json
import uuid
from app.database import Base, engine
from tests.test_executive import TestingSessionLocal, seed_business_data
from app.models.organization import Organization
from app.models.project import Project
from app.services.analytics_service import AnalyticsService

def run():
    print("Setting up in-memory DB...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="NovaWear Fashion", slug="novawear")
    db.add(org)
    db.commit()
    
    seed_business_data(db, org.id)
    
    inv_analysis = AnalyticsService.get_inventory_analysis(db, org.id)
    
    print("\n====== E2E PAYLOAD VERIFICATION ======")
    found = False
    for item in inv_analysis.get("items_at_risk", []):
        if item.get("stockout_risk_score", 0) >= 50 and not item.get("is_dead_stock"):
            print("\n[REVENUE RISK CARD]")
            print(f"Title: Reorder {item.get('name', item.get('sku'))}")
            print(f"Action: Order {item.get('reorder_quantity', 0)} units today.")
            
            print("\n[SIZE RUN]")
            print(json.dumps(item.get("size_distribution"), indent=2))
            
            print("\n[REASONING]")
            print(json.dumps(item.get("reasoning", []), indent=2))
            
            print("\n[EXPLAIN PANEL - TRACE DATA]")
            print(json.dumps(item.get("trace_data"), indent=2))
            
            found = True
            break
            
    if not found:
        print("No revenue risks found for NovaWear.")
    
    db.close()

if __name__ == "__main__":
    run()
