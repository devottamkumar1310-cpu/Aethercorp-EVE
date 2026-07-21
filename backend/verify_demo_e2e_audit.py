import time
import json
import random
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import Base, engine
from tests.test_executive import TestingSessionLocal
from app.models.profile import Profile

def test_run_audit():
    print("Initializing Database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    
    # 1. User Signup / Login Simulation
    import uuid
    test_user_id = uuid.uuid4()
    profile = Profile(
        id=test_user_id,
        email="founder@demo.com",
        full_name="Demo Founder",
        hashed_password="mockhash"
    )
    db.add(profile)
    db.commit()
    
    client = TestClient(app)
    
    # Need to override get_current_user dependency everywhere
    from app.routes.organization import get_current_user as o_gcu
    app.dependency_overrides[o_gcu] = lambda: profile
    from app.routes.inventory import get_current_user as i_gcu
    from app.routes.analytics import get_current_user as a_gcu
    from app.routes.executive import get_current_user as e_gcu
    try: app.dependency_overrides[i_gcu] = lambda: profile
    except: pass
    try: app.dependency_overrides[a_gcu] = lambda: profile
    except: pass
    try: app.dependency_overrides[e_gcu] = lambda: profile
    except: pass

    companies = ["novawear", "urban_threads", "essentials_co"]
    workspaces = {}
    
    results = {
        "onboard_latency": {},
        "idempotency": True,
        "ai_latency": {},
        "ai_responses": {},
        "inventory_checks": {}
    }

    # 2. Onboard Demos
    for company in companies:
        start = time.time()
        resp = client.post("/api/organization/onboard-demo", json={"demo_company": company})
        latency = time.time() - start
        
        assert resp.status_code == 200, f"Failed onboard for {company}"
        data = resp.json()
        workspaces[company] = data["organization_id"]
        results["onboard_latency"][company] = round(latency * 1000, 2)
        print(f"[{company}] Provisioned in {latency*1000:.2f}ms. Org ID: {workspaces[company]}")
        
        # Idempotency check
        resp2 = client.post("/api/organization/onboard-demo", json={"demo_company": company})
        if resp2.json()["organization_id"] != workspaces[company]:
            results["idempotency"] = False

    # 3. Inventory & AI Validation per workspace
    for company, org_id in workspaces.items():
        # Inventory fetch
        inv_start = time.time()
        inv_resp = client.get(f"/api/inventory/products?org_id={org_id}")
        results["inventory_checks"][company] = {
            "fetch_ms": round((time.time() - inv_start) * 1000, 2),
            "product_count": len(inv_resp.json().get("items", [])) if inv_resp.status_code == 200 else 0
        }

        # AI Context check
        ai_start = time.time()
        ai_req = {
            "organization_id": org_id,
            "message": "Which products should I reorder?",
            "conversation_id": None
        }
        ai_resp = client.post("/api/executive/chat", json=ai_req)
        results["ai_latency"][company] = round((time.time() - ai_start) * 1000, 2)
        if ai_resp.status_code == 200:
            results["ai_responses"][company] = ai_resp.json().get("response", "")[:100]
        else:
            results["ai_responses"][company] = f"Error: {ai_resp.status_code}"
            
    print("\n====== AUDIT RESULTS ======")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    run_audit()
