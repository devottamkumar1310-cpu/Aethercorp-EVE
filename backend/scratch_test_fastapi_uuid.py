from fastapi import FastAPI
from fastapi.testclient import TestClient
import uuid

app = FastAPI()

@app.get("/test")
def test_route():
    return {"id": uuid.uuid4()}

client = TestClient(app)
response = client.get("/test")
print("Status:", response.status_code)
print("Text:", response.text)
