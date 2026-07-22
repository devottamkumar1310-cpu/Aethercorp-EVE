"""Add organizations.scenario_type column and backfill the canonical business
scenario for the three demo workspaces. Idempotent."""
import sys, os
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import SessionLocal
from app.core.scenario import ScenarioType

# slug -> canonical scenario_type
BACKFILL = {
    "luma-and-co": ScenarioType.GROWTH,
    "drift-collective": ScenarioType.CASH_FLOW,
    "basecamp-basics": ScenarioType.SEASONAL,
}

def main():
    db = SessionLocal()
    try:
        # 1. Add column if missing.
        exists = db.execute(text("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name='organizations' AND column_name='scenario_type'
        """)).scalar()
        if exists:
            print("✓ Column organizations.scenario_type already present.")
        else:
            db.execute(text("ALTER TABLE organizations ADD COLUMN scenario_type VARCHAR"))
            db.commit()
            print("✓ Added column organizations.scenario_type VARCHAR (nullable).")

        # 2. Backfill the three demos.
        for slug, stype in BACKFILL.items():
            res = db.execute(
                text("UPDATE organizations SET scenario_type = :s WHERE slug = :slug"),
                {"s": stype, "slug": slug},
            )
            print(f"  {slug:20} -> {stype:10} ({res.rowcount} row updated)")
        db.commit()

        # 3. Verify.
        print("\n=== organizations.scenario_type ===")
        rows = db.execute(text("SELECT name, slug, scenario_type FROM organizations ORDER BY created_at")).fetchall()
        for r in rows:
            flag = "✓" if (r[1] not in BACKFILL or r[2] == BACKFILL[r[1]]) else "✗"
            print(f"  {flag} {r[0]!r:22} slug={r[1]:18} scenario_type={r[2]}")

        missing = [r[1] for r in rows if r[1] in BACKFILL and r[2] != BACKFILL[r[1]]]
        print(f"\nRESULT: {'✅ all demos stamped correctly' if not missing else f'❌ mismatch: {missing}'}")
    except Exception as e:
        print(f"✗ Failed, rolling back: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
