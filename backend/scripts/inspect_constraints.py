"""READ-ONLY: inspect unique constraints/indexes on organizations & memberships,
and check for existing duplicate memberships or per-owner duplicate org names."""
import sys, os
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        for tbl in ("organizations", "memberships"):
            print(f"\n=== {tbl}: unique constraints & indexes ===")
            rows = db.execute(text("""
                SELECT con.conname, con.contype,
                       pg_get_constraintdef(con.oid) AS def
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = :t AND con.contype IN ('u','p')
            """), {"t": tbl}).fetchall()
            for r in rows:
                print(f"   [{r[1]}] {r[0]}: {r[2]}")
            idx = db.execute(text("""
                SELECT indexname, indexdef FROM pg_indexes
                WHERE tablename = :t AND indexdef ILIKE '%UNIQUE%'
            """), {"t": tbl}).fetchall()
            for r in idx:
                print(f"   [idx] {r[0]}: {r[1]}")

        print("\n=== duplicate memberships (organization_id, user_id) ===")
        dups = db.execute(text("""
            SELECT organization_id, user_id, COUNT(*)
            FROM memberships GROUP BY organization_id, user_id HAVING COUNT(*) > 1
        """)).fetchall()
        print(f"   {len(dups)} duplicate membership pair(s)")
        for r in dups:
            print(f"      org={r[0]} user={r[1]} count={r[2]}")

        print("\n=== per-owner duplicate org NAMES ===")
        namedups = db.execute(text("""
            SELECT m.user_id, o.name, COUNT(*)
            FROM memberships m JOIN organizations o ON o.id = m.organization_id
            WHERE m.role = 'owner'
            GROUP BY m.user_id, o.name HAVING COUNT(*) > 1
        """)).fetchall()
        print(f"   {len(namedups)} owner/name duplicate(s)")
        for r in namedups:
            print(f"      user={r[0]} name={r[1]!r} count={r[2]}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
