from app.core.config import settings


def test_health_ok_locally(client):
    assert client.get("/api/health").json()["db"] == "ok"


def test_health_reports_missing_database_on_vercel(client, monkeypatch):
    """On Vercel with only the SQLite default, the app must start and explain instead of crashing."""
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr(settings, "database_url", "sqlite:///./proppros.db")
    body = client.get("/api/health").json()
    assert body["db"] == "not_configured" and "Neon" in body["hint"]
