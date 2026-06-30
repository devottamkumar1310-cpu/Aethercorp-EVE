import asyncio
import httpx
from app.main import app
from httpx import ASGITransport

async def test():
    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url='http://localhost:8000') as client:
        r = await client.options(
            '/api/auth/sync',
            headers={
                'Origin': 'https://aethercorp-eve.vercel.app',
                'Access-Control-Request-Method': 'POST'
            }
        )
        print(f'Status: {r.status_code}, Body: {r.text}')

asyncio.run(test())
