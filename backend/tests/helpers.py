import re
from datetime import date

from fastapi.testclient import TestClient

from app.main import app

PASSWORD = "CorrectHorse9!"


def new_client() -> TestClient:
    return TestClient(app)


def register(name: str = "Owner One", email: str = "owner@example.com", org: str = "Test Rentals") -> tuple[TestClient, dict]:
    c = new_client()
    r = c.post("/api/auth/register", json={"name": name, "email": email, "password": PASSWORD, "organization_name": org})
    assert r.status_code == 200, r.text
    me = r.json()
    c.headers["X-Org-Id"] = me["organizations"][0]["id"]
    return c, me


def make_property(c: TestClient, name: str = "Oak St", property_type: str = "single_family") -> dict:
    r = c.post(
        "/api/properties",
        json={
            "name": name,
            "property_type": property_type,
            "address_line1": "1 Oak St",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78701",
        },
    )
    assert r.status_code == 201, r.text
    return c.get(f"/api/properties/{r.json()['id']}").json()


def make_tenant(c: TestClient, first: str = "Tina", last: str = "Tenant", email: str | None = "tina@example.com") -> dict:
    r = c.post("/api/tenants", json={"first_name": first, "last_name": last, "email": email})
    assert r.status_code == 201, r.text
    return r.json()


def make_lease(c: TestClient, unit_id: str, tenant_ids: list[str], **overrides) -> dict:
    body = {
        "unit_id": unit_id,
        "tenant_ids": tenant_ids,
        "start_date": "2026-01-01",
        "rent_cents": 150000,
        "due_day": 1,
        "deposit_cents": 150000,
        "charges_start_on": "2026-09-01",
    }
    body.update(overrides)
    r = c.post("/api/leases", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def token_from(outbox: list[dict], path: str) -> str:
    for msg in reversed(outbox):
        m = re.search(rf"{re.escape(path)}\?token=([A-Za-z0-9_\-]+)", msg["html"])
        if m:
            return m.group(1)
    raise AssertionError(f"no {path} link in outbox")


def d(s: str) -> date:
    return date.fromisoformat(s)
