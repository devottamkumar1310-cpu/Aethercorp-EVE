import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

@pytest.fixture(autouse=True)
def isolate_dependency_overrides():
    saved_overrides = app.dependency_overrides.copy()
    app.dependency_overrides.clear()
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved_overrides)


def test_account_delete_cors_preflight_returns_without_hanging():
    response = client.options(
        "/api/account/delete",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
        },
    )

    assert response.status_code in {200, 400}


def test_account_delete_rejects_missing_token_without_hanging():
    response = client.delete(
        "/api/account/delete",
        headers={
            "Origin": "http://localhost:3000",
        },
    )

    assert response.status_code in {400, 401}