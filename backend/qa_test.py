import json
from app.routes.executive import daily_brief
import asyncio
from app.database import SessionLocal
from app.models.profile import Profile
from app.models.organization import Organization

db = SessionLocal()

class MockUser:
    def __init__(self, uid):
        self.id = uid

for user in db.query(Profile).all():
    if not user.memberships:
        continue
    org_id = user.memberships[0].organization_id
    workspace = db.query(Organization).filter(Organization.id == org_id).first()
    if not workspace:
        continue
        
    brief = asyncio.run(daily_brief(workspace_id=workspace.id, current_user=MockUser(user.id), db=db))
    
    found_size = False
    for risk in brief.revenue_risks + brief.capital_risks:
        if risk.size_run or (risk.trace_data and risk.trace_data.size_curve_analysis):
            found_size = True
            print("\n" + "="*50)
            print(f"FOUND SIZE DATA FOR USER: {user.email}")
            print(f"[PRIORITY ITEM]: {risk.title}")
            print(f"Confidence Label: {risk.confidence_label}")
            print(f"Warnings: {risk.data_quality_warnings}")
            print(f"Size Run: {json.dumps(risk.size_run)}")
            
            trace = risk.trace_data
            if trace:
                print(f"\nTRACE DATA:")
                print(f"- Recommended Qty: {trace.eoq_adjustment}")
                print(f"- Unit Cost: {trace.unit_cost}")
                print(f"- Selling Price: {trace.selling_price}")
                print(f"- Size Curve Analysis: {json.dumps(trace.size_curve_analysis)}")
            print("="*50)
            break
            
    if found_size:
        break
