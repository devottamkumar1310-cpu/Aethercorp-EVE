"""Apply the uq_memberships_org_user UNIQUE(organization_id, user_id) constraint
to the live database. Idempotent: safe to run repeatedly."""
import sys, os
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import SessionLocal

CONSTRAINT = "uq_memberships_org_user"

def main():
    db = SessionLocal()
    try:
        # Guard: refuse if duplicate (organization_id, user_id) rows exist.
        dups = db.execute(text("""
            SELECT organization_id, user_id, COUNT(*)
            FROM memberships GROUP BY organization_id, user_id HAVING COUNT(*) > 1
        """)).fetchall()
        if dups:
            print(f"✗ ABORT: {len(dups)} duplicate membership pair(s) exist; resolve before adding constraint.")
            for r in dups:
                print(f"   org={r[0]} user={r[1]} count={r[2]}")
            return

        exists = db.execute(text("""
            SELECT 1 FROM pg_constraint WHERE conname = :c
        """), {"c": CONSTRAINT}).scalar()
        if exists:
            print(f"✓ Constraint {CONSTRAINT} already present — nothing to do.")
            return

        db.execute(text(
            f"ALTER TABLE memberships ADD CONSTRAINT {CONSTRAINT} UNIQUE (organization_id, user_id)"
        ))
        db.commit()
        print(f"✓ Added constraint {CONSTRAINT} UNIQUE(organization_id, user_id).")

        # Verify
        verify = db.execute(text("""
            SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = :c
        """), {"c": CONSTRAINT}).scalar()
        print(f"  Verified: {verify}")
    except Exception as e:
        print(f"✗ Failed, rolling back: {e}")
        import traceback; traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
