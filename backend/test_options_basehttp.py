import asyncio
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from httpx import AsyncClient, ASGITransport

app = FastAPI()

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method == "OPTIONS":
            return response
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

app.add_middleware(SecurityHeadersMiddleware)

@app.post("/api/auth/sync")
async def sync():
    return {"ok": True}

async def run():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.options("/api/auth/sync")
        print(f"Status: {r.status_code}")
        print(f"Headers: {r.headers}")

asyncio.run(run())
