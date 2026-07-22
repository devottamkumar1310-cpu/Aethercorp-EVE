"""READ-ONLY diagnostic: list every organization, its members, and data counts.
No writes. Used to plan safe legacy-demo cleanup."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.organization import Organization, Membership
from app.models.profile import Profile
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.recommendation_trace import RecommendationTrace
from app.models.executive_conversation import ExecutiveConversation
from app.models.task import Task
from app.models.client import Client
from app.models.finance import Revenue, Expense
from app.models.project import Project
from app.models.intelligence_snapshot import IntelligenceSnapshot

LEGACY_NAMES = ["novawear", "urban threads", "urban-threads", "essentials co", "essentials-co", "essentials"]

def count(db, model, org_id):
    try:
        return db.query(model).filter(model.organization_id == org_id).count()
    except Exception as e:
        return f"err:{e}"

def main():
    db = SessionLocal()
    try:
        orgs = db.query(Organization).order_by(Organization.created_at).all()
        print(f"=== TOTAL ORGANIZATIONS: {len(orgs)} ===\n")
        for o in orgs:
            members = db.query(Membership).filter(Membership.organization_id == o.id).all()
            emails = []
            for m in members:
                p = db.query(Profile).filter(Profile.id == m.user_id).first()
                emails.append(f"{p.email if p else '?'}({m.role})")
            is_legacy = any(l in (o.name or "").lower() or l in (o.slug or "").lower() for l in LEGACY_NAMES)
            flag = "  <<< LEGACY MATCH" if is_legacy else ""
            print(f"[{o.id}]{flag}")
            print(f"   name={o.name!r}  slug={o.slug!r}  created={o.created_at}")
            print(f"   members={emails or '(none)'}")
            print(f"   products={count(db,Product,o.id)} inventory={count(db,InventoryItem,o.id)} "
                  f"sales={count(db,SalesRecord,o.id)} traces={count(db,RecommendationTrace,o.id)}")
            print(f"   convos={count(db,ExecutiveConversation,o.id)} tasks={count(db,Task,o.id)} "
                  f"clients={count(db,Client,o.id)} revenue={count(db,Revenue,o.id)} "
                  f"expense={count(db,Expense,o.id)} projects={count(db,Project,o.id)} "
                  f"snapshots={count(db,IntelligenceSnapshot,o.id)}")
            print()

        # Explicit legacy summary
        legacy = [o for o in orgs if any(l in (o.name or "").lower() or l in (o.slug or "").lower() for l in LEGACY_NAMES)]
        print(f"=== LEGACY-NAMED ORGS FOUND: {len(legacy)} ===")
        for o in legacy:
            print(f"   {o.name!r} ({o.slug}) id={o.id}")

        # Slug/name duplicate check
        from collections import Counter
        name_counts = Counter((o.name or "").lower() for o in orgs)
        dupes = {n: c for n, c in name_counts.items() if c > 1}
        print(f"\n=== DUPLICATE NAMES: {dupes or 'none'} ===")
    finally:
        db.close()

if __name__ == "__main__":
    main()
