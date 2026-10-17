from app.core.config import settings


def test_health_ok_locally(client):
    assert client.get("/api/health").json()["db"] == "ok"


def test_health_reports_missing_database_on_vercel(client, monkeypatch):
    """On Vercel with only the SQLite default, the app must start and explain instead of crashing."""
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr(settings, "database_url", "sqlite:///./proppros.db")
    body = client.get("/api/health").json()
    assert body["db"] == "not_configured" and "Neon" in body["hint"]


def test_postgres_url_fallback(monkeypatch):
    from app.core.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_URL", "postgres://u:p@host-pooler/db?sslmode=require")
    monkeypatch.setenv("POSTGRES_URL_NON_POOLING", "postgres://u:p@host/db?sslmode=require")
    s = Settings(_env_file=None)
    assert s.database_url == "postgresql+psycopg://u:p@host-pooler/db?sslmode=require"
    assert s.database_url_unpooled == "postgresql+psycopg://u:p@host/db?sslmode=require"
