from fastapi import FastAPI
import uuid

app = FastAPI()

@app.get("/test")
def test_route():
    return {"id": uuid.uuid4()}
