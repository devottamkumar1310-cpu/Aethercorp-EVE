import sys
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres.kqncbxoftcqvzslsmswf:Po6P8mo36Yf3NanQ@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        # Find user profile
        result = conn.execute(text("SELECT id, email, full_name FROM profiles WHERE email = :email"), {"email": "devkumardev560@gmail.com"})
        user = result.fetchone()
        if user:
            print(f"[+] Found User Profile: ID={user[0]}, Email={user[1]}, Name={user[2]}")
            # Find organization memberships
            mem_result = conn.execute(text("""
                SELECT o.id, o.name, o.slug, m.role 
                FROM organizations o
                JOIN memberships m ON o.id = m.organization_id
                WHERE m.user_id = :user_id
            """), {"user_id": user[0]})
            memberships = mem_result.fetchall()
            for mem in memberships:
                print(f"    [+] Org Membership: OrgID={mem[0]}, Name={mem[1]}, Slug={mem[2]}, Role={mem[3]}")
        else:
            print("[-] User Profile devkumardev560@gmail.com not found in PostgreSQL database.")
except Exception as e:
    print(f"[-] Database query failed: {e}")
