import sys
import requests
import jwt
import time

# Add backend directory to sys.path
sys.path.append(r"c:\Users\Devottam\OneDrive\Pictures\Desktop\Project\aethercorp-eve\backend")

from app.config import settings

def test_delete_api():
    url = "http://127.0.0.1:8000/api/profile/me"
    print(f"Target URL: {url}")
    
    # Generate a mock token for verification using the configured secret key
    payload = {
        "sub": "59020629-fe01-4251-8cec-ba53d7f77836", # From our previous temp user
        "email": "perf_audit_user@test.com",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Origin": "http://localhost:3000"
    }
    
    print("\n--- Sending OPTIONS Preflight Request ---")
    try:
        opt_headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "authorization"
        }
        res_opt = requests.options(url, headers=opt_headers)
        print(f"Status Code: {res_opt.status_code}")
        print("Response Headers:")
        for k, v in res_opt.headers.items():
            print(f"  {k}: {v}")
    except Exception as e:
        print(f"Preflight request failed: {e}")

    print("\n--- Sending DELETE Request ---")
    try:
        res = requests.delete(url, headers=headers)
        print(f"Status Code: {res.status_code}")
        print("Response Headers:")
        for k, v in res.headers.items():
            print(f"  {k}: {v}")
        print("Response Body:")
        print(res.text)
    except Exception as e:
        print(f"DELETE request failed: {e}")

if __name__ == "__main__":
    test_delete_api()
