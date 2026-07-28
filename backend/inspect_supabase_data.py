from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
print('=== SUPABASE AUTH USERS ===')
try:
    auth_users_count = db.execute(text('SELECT count(*) FROM auth.users')).scalar()
    print('auth.users count:', auth_users_count)
    users = db.execute(text('SELECT id, email, created_at, last_sign_in_at FROM auth.users')).fetchall()
    for u in users:
        print('  User:', u)
except Exception as e:
    print('Failed to query auth.users:', e)

print('\n=== ALL PUBLIC TABLES AND ROW COUNTS ===')
tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).fetchall()
for t in tables:
    tname = t[0]
    try:
        cnt = db.execute(text(f'SELECT count(*) FROM "{tname}"')).scalar()
        if cnt > 0:
            print(f'  [DATA] {tname:35s}: {cnt} rows')
        else:
            print(f'         {tname:35s}: 0 rows')
    except Exception as e:
        print(f'  [ERR]  {tname:35s}: Error ({e})')

db.close()
