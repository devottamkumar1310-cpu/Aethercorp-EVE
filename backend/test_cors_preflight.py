import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from httpx import AsyncClient, ASGITransport

allowed_origins = ["http://localhost:3000"]
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/test")
async def test():
    return {"message": "ok"}

async def run():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Preflight
        r = await client.options("/test", headers={"Origin": "https://aethercorp-eve.vercel.app", "Access-Control-Request-Method": "GET"})
        print(f"Preflight status: {r.status_code}")
        print(f"Preflight headers: {r.headers}")
        
        # Now what if the origin is NOT allowed?
        r = await client.options("/test", headers={"Origin": "https://bad.vercel.com", "Access-Control-Request-Method": "GET"})
        print(f"Bad Preflight status: {r.status_code}")
        print(f"Bad Preflight headers: {r.headers}")

asyncio.run(run())
