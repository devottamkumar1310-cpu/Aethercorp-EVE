"""Add operational tasks to the three demo workspaces (one-time patch after seed_scenarios.py update)."""
import sys, os, uuid, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.task import Task
from app.models.project import Project

# Org IDs as seeded in Supabase for devottamkumar1310@gmail.com
WORKSPACES = {
    uuid.UUID("353651d7-d9fa-4a95-b2d7-a2f771db7cc0"): "luma",
    uuid.UUID("a26d5acf-32fc-4cc7-b3bf-9e1cfbe39178"): "drift",
    uuid.UUID("58b728a7-9fe7-40b9-b271-e7e35044918d"): "basecamp",
}

TASKS = {
    "luma": [
        ("Submit Q3 demand forecast to procurement team", "completed", "high"),
        ("Update safety stock thresholds for hero SKUs", "completed", "high"),
        ("Issue PO for Sculpted Blazer — 150 units (LM-1001)", "completed", "high"),
        ("Negotiate Q4 freight rates with logistics partner", "completed", "medium"),
        ("Conduct mid-quarter inventory audit across all 18 SKUs", "completed", "medium"),
        ("Update sell-through targets for Q3 hero products", "completed", "medium"),
        ("Initiate emergency air freight for Silk Wrap Dress LM-1002", "in_progress", "critical"),
        ("Raise reorder point for Merino Turtleneck to 65 units", "todo", "high"),
    ],
    "drift": [
        ("Complete dead stock audit — four collab SKUs identified", "completed", "high"),
        ("Warehouse cost analysis: $1,037/month carrying charge confirmed", "completed", "high"),
        ("Brief brand team on collab failure root causes", "completed", "medium"),
        ("Initiate 45% markdown campaign for Neon Moto Vest DR-9001", "in_progress", "critical"),
        ("Set up Summer Pack bundle: Tie-Dye Short + Cargo Jogger", "todo", "high"),
        ("Engage off-price buyer for Holographic Bucket Hat — 940 units", "todo", "high"),
        ("List Oversized Puffer on outlet at 50% discount", "todo", "high"),
        ("Prepare cash flow bridge memo for upcoming core-line PO", "todo", "critical"),
    ],
    "basecamp": [
        ("Season transition audit: 3 summer OOS, 5 winter dead stock confirmed", "completed", "high"),
        ("Draft winter clearance campaign brief", "completed", "medium"),
        ("Submit emergency air freight PO for French Terry Short — 400 units", "completed", "critical"),
        ("Mark down Thermal Base Layer 40% — live on storefront", "completed", "high"),
        ("Initiate off-price inquiry for Wool Blend Beanies — 680 units", "completed", "medium"),
        ("Place rush reorder for Heavyweight Tee White — 500 units (BC-S001)", "in_progress", "critical"),
        ("Dual-source Black Heavyweight Tee from domestic backup supplier", "in_progress", "high"),
        ("Route Heavyweight Fleece Hoodie to outlet channel", "todo", "high"),
    ],
}

def main():
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    try:
        for org_id, scenario in WORKSPACES.items():
            project = db.query(Project).filter(Project.organization_id == org_id).first()
            if not project:
                print(f"  ⚠ No project found for {scenario} — skipping")
                continue

            # Remove any existing tasks for this workspace
            db.query(Task).filter(Task.organization_id == org_id).delete()
            db.flush()

            for title, status, priority in TASKS[scenario]:
                db.add(Task(
                    id=uuid.uuid4(), organization_id=org_id, project_id=project.id,
                    title=title, status=status, priority=priority,
                    due_date=now + datetime.timedelta(days=30),
                ))
            db.flush()

            completed = sum(1 for _, s, _ in TASKS[scenario] if s == "completed")
            total = len(TASKS[scenario])
            print(f"  ✓ {scenario}: {total} tasks seeded ({completed}/{total} completed = {completed/total*100:.0f}%)")

        db.commit()
        print("\n✓ All demo workspace tasks seeded successfully.")
    except Exception as e:
        print(f"\n✗ Failed: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
