from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.core.config import Settings
from app.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_presence_script():
    client = TestClient(app)
    response = client.get("/v1/presence.js")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/javascript")
    assert "window.ObservaPresence" in response.text


def test_dashboard_mutation_rejects_untrusted_origin():
    client = TestClient(app)
    response = client.post("/auth/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_dashboard_mutation_allows_configured_origin():
    client = TestClient(app)
    response = client.post("/auth/logout", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 204


def test_production_settings_reject_wildcard_cors():
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            jwt_secret_key="x" * 32,
            auth_cookie_secure=True,
            cors_origins=["*"],
        )
