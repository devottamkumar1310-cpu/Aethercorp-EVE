import asyncio
from fastapi import FastAPI, Request
from httpx import AsyncClient, ASGITransport

app = FastAPI()

@app.post("/api/auth/sync")
async def sync():
    return {"ok": True}

async def run():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.options("/api/auth/sync")
        print(f"Status: {r.status_code}")
        print(f"Headers: {r.headers}")

asyncio.run(run())
