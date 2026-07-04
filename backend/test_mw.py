import asyncio
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from httpx import AsyncClient, ASGITransport

app = FastAPI()

class OuterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print("OuterMiddleware IN")
        response = await call_next(request)
        print("OuterMiddleware OUT")
        return response

class InnerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        print("InnerMiddleware IN")
        response = await call_next(request)
        print("InnerMiddleware OUT")
        return response

app.add_middleware(InnerMiddleware)
app.add_middleware(OuterMiddleware)

@app.options("/test")
async def test():
    return {"message": "ok"}

async def run():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("--- Sending Request ---")
        await client.options("/test")
        print("--- Done ---")

asyncio.run(run())
