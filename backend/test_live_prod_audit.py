import httpx
import time
import os
import sys
import jwt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

base = "https://eve-backend-68416570138.us-central1.run.app"
owner_email = settings.OWNER_EMAIL  # devottamkumar1310@gmail.com

print(f"=== PRODUCTION LIVE AUDIT FOR OWNER ACCOUNT ({owner_email}) ===")

# Encode valid JWT token for owner email signed with SUPABASE_JWT_SECRET
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
    "/api/internal/health",
    "/api/internal/alerts",
    "/api/internal/ai",
    "/api/internal/events"
]

results = []

for ep in endpoints:
    url = f"{base}{ep}"
    t0 = time.time()
    res = httpx.get(url, headers=headers)
    t1 = time.time()
    latency_ms = round((t1 - t0) * 1000, 2)
    
    try:
        body_summary = str(res.json())[:140]
    except Exception:
        body_summary = res.text[:140]
    
    print(f"Endpoint:      {ep}")
    print(f"Request URL:   {url}")
    print(f"HTTP Status:   {res.status_code}")
    print(f"Response Time: {latency_ms} ms")
    print(f"Body Summary:  {body_summary}")
    print("-" * 65)
    
    results.append({
        "endpoint": ep,
        "status": res.status_code,
        "latency_ms": latency_ms,
        "success": res.status_code == 200
    })

all_passed = all(r["success"] for r in results)
print(f"\nProduction Verification Result: {'ALL 5/5 ENDPOINTS PASSED (200 OK)' if all_passed else 'SOME ENDPOINTS FAILED'}")
