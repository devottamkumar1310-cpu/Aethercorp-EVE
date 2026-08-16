# ==============================================================================
# PURPOSE: Prove that EVE's error responses do not reflect caller input or leak
#          server internals back to whoever is probing the API.
#
# METHOD: Every test drives a REAL request through the app and asserts on the
#         RESPONSE BODY. None of them assert that a handler exists; they assert
#         that a specific string the caller supplied, or a specific internal
#         detail, is absent from what the caller gets back.
#
# WHY THIS FILE EXISTS: FastAPI's default RequestValidationError rendering — and
#         the handler EVE previously shipped — embeds the rejected input value
#         for every failing field:
#             "... [type=int_parsing, input_value='<what the caller sent>']"
#         That turns a 422 into a reflection gadget and hands back any credential
#         a client posts into the wrong field. The handler now returns only the
#         field location and the reason.
# ==============================================================================

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# A value distinctive enough that finding it anywhere in a response is
# unambiguous proof the input was reflected.
CANARY = "CANARY-b4d9f1e2-do-not-reflect-this-value"


@pytest.fixture(scope="module")
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestValidationErrorsDoNotReflectInput:
    """
    A 422 must describe WHAT was wrong, never repeat WHAT WAS SENT.

    These deliberately target UNAUTHENTICATED routes that own a Pydantic body
    schema (/api/auth/forgot-password, /api/waitlist). An authenticated route is
    useless here: its auth dependency rejects the request before body validation
    ever runs, so no 422 is produced and the assertion passes vacuously against
    a vulnerable handler.
    """

    def _assert_422_is_sanitised(self, response):
        assert response.status_code == 422, (
            f"expected a validation error, got {response.status_code}: "
            "this route no longer produces a 422 and the test needs updating"
        )
        assert CANARY not in response.text
        assert "input_value" not in response.text
        assert "errors.pydantic.dev" not in response.text

        body = response.json()
        assert body["code"] == "VALIDATION_ERROR"
        assert body["message"] == "Request validation failed."
        assert body["detail"] == "Request validation failed."
        for item in body.get("errors", []):
            assert set(item.keys()) == {"field", "reason"}

    def test_forgot_password_does_not_echo_submitted_value(self, client):
        """`email` must be a string — send an object carrying the canary."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": {"nested": CANARY}, "redirect_to": "https://example.com"},
        )
        self._assert_422_is_sanitised(response)

    def test_missing_field_error_names_field_without_dumping_body(self, client):
        """A missing required field must not cause the whole body to be echoed."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"redirect_to": CANARY},  # `email` omitted entirely
        )
        self._assert_422_is_sanitised(response)
        fields = [e["field"] for e in response.json()["errors"]]
        assert any("email" in f for f in fields), "the failing field should still be named"

    def test_waitlist_does_not_echo_submitted_value(self, client):
        response = client.post(
            "/api/waitlist",
            json={"email": [CANARY], "name": CANARY},
        )
        self._assert_422_is_sanitised(response)


class TestErrorsDoNotLeakInternals:
    def test_unknown_route_does_not_leak_stack_or_paths(self, client):
        response = client.get(f"/api/does-not-exist-{uuid.uuid4().hex}")
        assert response.status_code == 404
        lowered = response.text.lower()
        assert "traceback" not in lowered
        assert "site-packages" not in lowered
        assert ".py" not in lowered

    def test_protected_route_rejects_anonymous_without_detail_leak(self, client):
        """A 401 should say 'not authorised', not describe the auth internals."""
        response = client.get("/api/integrations/shopify/status")
        assert response.status_code in (401, 403)
        lowered = response.text.lower()
        assert "traceback" not in lowered
        assert "jwt_secret" not in lowered
        assert "supabase_jwt" not in lowered

    def test_forged_bearer_token_is_rejected_without_echoing_it(self, client):
        forged = f"Bearer {CANARY}"
        response = client.get(
            "/api/integrations/channels/status",
            headers={"Authorization": forged},
        )
        assert response.status_code in (401, 403)
        assert CANARY not in response.text
