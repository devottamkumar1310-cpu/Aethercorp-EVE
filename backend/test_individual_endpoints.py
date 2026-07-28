import httpx
import time
import os
import sys
import jwt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

base = "https://eve-backend-68416570138.us-central1.run.app"
owner_email = settings.OWNER_EMAIL

print(f"=== PRODUCTION ENDPOINT LATENCY AUDIT FOR OWNER ({owner_email}) ===")

payload = {
    "sub": "00000000-0000-0000-0000-000000000001",
    "email": owner_email,
    "aud": "authenticated",
    "exp": int(time.time()) + 3600
}

owner_token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
headers = {"Authorization": f"Bearer {owner_token}"}

endpoints = [
    "/api/internal/overview",
    "/api/internal/users",
    "/api/internal/ai",
    "/api/internal/alerts",
    "/api/internal/health",
    "/api/internal/events"
]

for ep in endpoints:
    url = f"{base}{ep}"
    print(f"Testing {ep:25s} ... ", end="", flush=True)
    t0 = time.time()
    try:
        res = httpx.get(url, headers=headers, timeout=10.0)
        t1 = time.time()
        latency_ms = round((t1 - t0) * 1000, 2)
        print(f"Status: {res.status_code} | Latency: {latency_ms} ms")
        if res.status_code != 200:
            print(f"   Error Body: {res.text[:200]}")
    except Exception as e:
        print(f"FAILED: {e}")
