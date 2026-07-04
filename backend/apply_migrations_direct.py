"""
Direct SQL migration script — bypasses Alembic's engine to apply missing columns.
Uses a fresh connection with explicit autocommit to avoid transaction state issues
with Supabase's PgBouncer pooler.

Run from backend/ directory:
    python apply_migrations_direct.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
import psycopg2

db_url = settings.DATABASE_URL
print(f"Connecting to: {db_url[:40]}...")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected OK")

    migrations = [
        # ─── Migration a1b2c3d4e5f6: audit_log fields ───────────────────────────
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS client_ip VARCHAR",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB",
        # ─── Migration b2c3d4e5f6a1: processed_documents.sha256_hash ────────────
        "ALTER TABLE processed_documents ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64)",
        # ─── Migration d4e5f6a1b2c3: profiles settings columns ──────────────────
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR NOT NULL DEFAULT 'UTC'",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language VARCHAR NOT NULL DEFAULT 'en'",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR",
    ]

    for sql in migrations:
        print(f"  Executing: {sql[:80]}...")
        try:
            cur.execute(sql)
            print("    OK")
        except Exception as e:
            print(f"    ERROR: {e}")

    # Stamp alembic_version to the merge head
    # First ensure alembic_version table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alembic_version (
            version_num VARCHAR(32) NOT NULL,
            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
        )
    """)
    print("alembic_version table ensured")

    # Check current versions
    cur.execute("SELECT version_num FROM alembic_version")
    current = [r[0] for r in cur.fetchall()]
    print(f"Current alembic versions: {current}")

    # Remove old branch heads and stamp the merge head
    heads_to_remove = ['e2a1e2c3f851', 'd4e5f6a1b2c3', 'a1b2c3d4e5f6', 'b2c3d4e5f6a1',
                        'c3d4e5f6a1b2', 'dd165cfe4281', '265dafce2062', 'f883444fdb64']
    for old in heads_to_remove:
        if old in current:
            cur.execute("DELETE FROM alembic_version WHERE version_num = %s", (old,))
            print(f"  Removed old version: {old}")

    # Stamp the merge head
    merge_head = 'e5f6a1b2c3d4'
    if merge_head not in current:
        cur.execute("INSERT INTO alembic_version (version_num) VALUES (%s)", (merge_head,))
        print(f"  Stamped merge head: {merge_head}")
    else:
        print(f"  Already at merge head: {merge_head}")

    cur.execute("SELECT version_num FROM alembic_version")
    final = [r[0] for r in cur.fetchall()]
    print(f"Final alembic versions: {final}")

    # Verify the critical columns exist
    print("\n--- Column Verification ---")
    checks = [
        ("audit_logs", ["user_id", "client_ip", "before_state", "after_state"]),
        ("processed_documents", ["sha256_hash"]),
        ("profiles", ["timezone", "language", "avatar_url"]),
    ]
    all_ok = True
    for table, cols in checks:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=%s AND column_name=ANY(%s)",
            (table, cols)
        )
        found = [r[0] for r in cur.fetchall()]
        missing = [c for c in cols if c not in found]
        if missing:
            print(f"  {table}: MISSING {missing}")
            all_ok = False
        else:
            print(f"  {table}: OK ({', '.join(found)})")

    cur.close()
    conn.close()
    print("\n" + ("SUCCESS — All columns present." if all_ok else "PARTIAL — See missing columns above."))
    sys.exit(0 if all_ok else 1)

except Exception as e:
    print(f"FATAL ERROR: {e}")
    sys.exit(1)
