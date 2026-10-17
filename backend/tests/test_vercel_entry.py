"""The Vercel entrypoint must route correctly whether the runtime passes the
original path or the rewrite destination (/api/index?__path=...)."""
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

_spec = importlib.util.spec_from_file_location("vercel_entry", Path(__file__).resolve().parents[2] / "api" / "index.py")
entry = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(entry)


def test_original_path_passthrough():
    c = TestClient(entry.app)
    assert c.get("/api/health").json()["db"] == "ok"


def test_rewritten_destination_is_restored():
    c = TestClient(entry.app)
    r = c.get("/api/index?__path=health")
    assert r.status_code == 200 and r.json()["db"] == "ok"
    # Nested path + original query string preserved
    r = c.get("/api/index?__path=reports/pnl&group_by=month")
    assert r.status_code == 401  # reached the real route (auth required), not a 404


def test_restore_path_unit():
    scope = {"type": "http", "path": "/api/index", "query_string": b"__path=leases/abc/ledger&x=1"}
    out = entry.restore_path(scope)
    assert out["path"] == "/api/leases/abc/ledger" and out["query_string"] == b"x=1"
