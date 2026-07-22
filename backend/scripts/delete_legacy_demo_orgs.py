"""Delete legacy/duplicate demo organizations — server-side CASCADE, single transaction.

Every FK to organizations.id is ON DELETE CASCADE (verified), and nested children
cascade through their parents, so one `DELETE FROM organizations` removes all
associated data atomically with no orphans and no FK violations.

Flow:
  1. Print orgs that WILL be deleted (id, name, slug, owner).
  2. Print PROTECTED orgs.
  3. Delete inside a single transaction.
  4. Post-commit verification audit.
  5. Final cleanup report.
"""
import sys, os, uuid
sys.stdout.reconfigure(line_buffering=True)  # unbuffered even when backgrounded
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import SessionLocal
from app.models.organization import Organization, Membership
from app.models.profile import Profile

TARGET_IDS = [
    "ea337dee-5c68-41ae-bb08-45afe771db8a",  # NovaWear Fashion (novawear)
    "dbbb6f95-f4e7-4bb4-b8c3-b776aca126cf",  # Urban Threads (urban_threads)
    "c1e2d3f4-a5b6-7890-abcd-ef1234567890",  # Basecamp Basics duplicate (basecamp)
]

PROTECTED_SLUGS = {"luma-and-co", "drift-collective", "basecamp-basics"}
PROTECTED_IDS = {
    "353651d7-d9fa-4a95-b2d7-a2f771db7cc0",
    "a26d5acf-32fc-4cc7-b3bf-9e1cfbe39178",
    "58b728a7-9fe7-40b9-b271-e7e35044918d",
}
PRIMARY_ACCOUNT = "devottamkumar1310@gmail.com"

ORG_SCOPED_TABLES = [
    "products", "inventory_items", "sales_records", "suppliers", "artifacts",
    "recommendation_traces", "reports", "intelligence_snapshots", "forecasts",
    "system_errors", "feedback_submissions", "business_goals", "clients",
    "audit_logs", "ai_recommendations", "revenues", "executive_conversations",
    "activity_logs", "memory_entries", "expenses", "projects", "memberships",
    "recommendations", "conversation_sessions", "processed_documents", "tasks",
]
# Nested children (no organization_id) — verify they don't reference deleted parents.
NESTED_CHECKS = {
    "chat_messages": "session_id IN (SELECT id FROM conversation_sessions WHERE organization_id IN :ids)",
    "executive_messages": "conversation_id IN (SELECT id FROM executive_conversations WHERE organization_id IN :ids)",
    "recommendation_audit_events": "trace_id IN (SELECT id FROM recommendation_traces WHERE organization_id IN :ids)",
}

def owners(db, org_id):
    out = []
    for m in db.query(Membership).filter(Membership.organization_id == org_id).all():
        p = db.query(Profile).filter(Profile.id == m.user_id).first()
        out.append(f"{p.email if p else '?'}({m.role})")
    return out

def rule(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)

def main():
    db = SessionLocal()
    try:
        # ---- STEP 1: orgs that WILL be deleted --------------------------------
        rule("STEP 1 — ORGANIZATIONS TO BE DELETED")
        to_delete = []
        for tid in TARGET_IDS:
            if tid in PROTECTED_IDS:
                raise SystemExit(f"ABORT: {tid} is a PROTECTED id.")
            org = db.query(Organization).filter(Organization.id == uuid.UUID(tid)).first()
            if not org:
                print(f"  • {tid} — not present (already deleted), skipping")
                continue
            if org.slug in PROTECTED_SLUGS:
                raise SystemExit(f"ABORT: {tid} has protected slug {org.slug!r}.")
            o = owners(db, org.id)
            if PRIMARY_ACCOUNT in [e.split("(")[0] for e in o]:
                raise SystemExit(f"ABORT: {tid} owned by primary account {PRIMARY_ACCOUNT}.")
            print(f"  ✗ DELETE  id={org.id}")
            print(f"            name={org.name!r}  slug={org.slug!r}")
            print(f"            owner={o}")
            to_delete.append(org.id)

        # ---- STEP 2: protected orgs -------------------------------------------
        rule("STEP 2 — PROTECTED ORGANIZATIONS (WILL NOT BE TOUCHED)")
        for slug in sorted(PROTECTED_SLUGS):
            org = db.query(Organization).filter(Organization.slug == slug).first()
            if org:
                print(f"  ✓ KEEP    id={org.id}  name={org.name!r}  slug={org.slug!r}  owner={owners(db, org.id)}")
            else:
                print(f"  ⚠ MISSING protected slug {slug!r} — not found in DB!")

        if not to_delete:
            rule("NOTHING TO DELETE — DATABASE ALREADY CLEAN")
            return

        # ---- STEP 3: single-transaction deletion ------------------------------
        rule(f"STEP 3 — DELETING {len(to_delete)} ORG(S) IN ONE TRANSACTION")
        id_list = [str(x) for x in to_delete]
        res = db.execute(
            text("DELETE FROM organizations WHERE id::text = ANY(:ids)"),
            {"ids": id_list},
        )
        db.commit()
        print(f"  ✓ Committed. organizations rows deleted: {res.rowcount}")

        # ---- STEP 4: verification audit ---------------------------------------
        rule("STEP 4 — POST-COMMIT VERIFICATION AUDIT")

        all_orgs = db.query(Organization).order_by(Organization.created_at).all()
        print(f"\n  [org count] {len(all_orgs)} organizations remain")
        print("  [remaining organizations / demo workspaces]")
        for o in all_orgs:
            print(f"     - {o.name!r:22} slug={o.slug!r:18} id={o.id}  owner={owners(db, o.id)}")

        # duplicate names / slugs
        from collections import Counter
        name_dupes = {n: c for n, c in Counter(o.name for o in all_orgs).items() if c > 1}
        slug_dupes = {s: c for s, c in Counter(o.slug for o in all_orgs).items() if c > 1}
        print(f"\n  [duplicate names] {name_dupes or 'NONE ✓'}")
        print(f"  [duplicate slugs] {slug_dupes or 'NONE ✓'}")

        # deleted ids gone
        still = db.query(Organization).filter(Organization.id.in_(to_delete)).count()
        print(f"  [deleted org rows still present] {still}  {'✓' if still == 0 else '✗'}")

        # orphaned records in org-scoped tables
        print("\n  [orphan sweep — org-scoped tables]")
        orphans = 0
        for tbl in ORG_SCOPED_TABLES:
            n = db.execute(
                text(f"SELECT COUNT(*) FROM {tbl} WHERE organization_id::text = ANY(:ids)"),
                {"ids": id_list},
            ).scalar()
            if n:
                orphans += n
                print(f"     ✗ {tbl}: {n} orphaned rows")
        print(f"     {'✓ none' if orphans == 0 else f'✗ {orphans} total orphans'}")

        # nested child references (would be FK violations if any survived)
        print("\n  [orphan sweep — nested children / FK integrity]")
        nested = 0
        for tbl, cond in NESTED_CHECKS.items():
            sql = f"SELECT COUNT(*) FROM {tbl} WHERE " + cond.replace(":ids", "(:ids_csv)")
            # build explicit IN list
            in_list = ",".join(f"'{i}'" for i in id_list)
            sql = f"SELECT COUNT(*) FROM {tbl} WHERE " + cond.replace("IN :ids", f"IN ({in_list})")
            n = db.execute(text(sql)).scalar()
            if n:
                nested += n
                print(f"     ✗ {tbl}: {n} rows still reference deleted orgs")
        print(f"     {'✓ none' if nested == 0 else f'✗ {nested} dangling references'}")

        # protected orgs intact
        survivors = sorted(o.slug for o in all_orgs if o.slug in PROTECTED_SLUGS)
        print(f"\n  [protected demos intact] {survivors}  "
              f"{'✓' if set(survivors) == PROTECTED_SLUGS else '✗ MISSING SOME'}")

        # ---- STEP 5: final report ---------------------------------------------
        rule("STEP 5 — FINAL CLEANUP REPORT")
        clean = (still == 0 and orphans == 0 and nested == 0 and not name_dupes
                 and not slug_dupes and set(survivors) == PROTECTED_SLUGS)
        print(f"  Organizations deleted ......... {res.rowcount}")
        print(f"  Organizations remaining ....... {len(all_orgs)}")
        print(f"  Duplicate names ............... {len(name_dupes)}")
        print(f"  Duplicate slugs ............... {len(slug_dupes)}")
        print(f"  Orphaned records .............. {orphans}")
        print(f"  Dangling child references ..... {nested}")
        print(f"  Protected demos intact ........ {len(survivors)}/3")
        print(f"\n  RESULT: {'✅ CLEAN — ready for demo provisioning' if clean else '❌ ISSUES FOUND — review above'}")

    except Exception as e:
        print(f"\n✗ Failed, rolling back: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
