"""Iteration 13: vendors, quotes & invoices, preventive maintenance, assets, keys & codes."""
from uuid import UUID

from app.models import MaintenanceSchedule, Organization, WorkOrder
from app.routers.vendors import add_months
from app.services import jobs
from tests.helpers import PASSWORD, d, make_property, new_client, register


def _wo(c, prop, **extra):
    r = c.post("/api/work-orders", json={"property_id": prop["id"], "title": "Leaking sink", "category": "plumbing", **extra})
    assert r.status_code == 201, r.text
    return r.json()


def _vendor(c, **extra):
    body = {"name": "Ace Plumbing", "email": "ace@example.com", "trades": ["plumbing"], "hourly_rate_cents": 9500, **extra}
    r = c.post("/api/vendors", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_add_months_clamps_month_end():
    assert add_months(d("2026-01-31"), 1) == d("2026-02-28")
    assert add_months(d("2026-11-15"), 3) == d("2027-02-15")
    assert add_months(d("2024-02-29"), 12) == d("2025-02-28")


def test_vendor_directory_and_email(outbox):
    c, _ = register()
    prop = make_property(c)
    v = _vendor(c, insurance_expires_on="2020-01-01")
    _vendor(c, name="Bright Electric", trades=["electrical"], email="")
    assert [x["name"] for x in c.get("/api/vendors?trade=plumbing").json()] == ["Ace Plumbing"]
    assert c.get("/api/vendors").json()[0]["insurance_status"] == "expired"
    assert c.post("/api/vendors", json={"name": "Bad", "trades": ["juggling"]}).status_code == 422

    wo = _wo(c, prop)
    r = c.put(f"/api/work-orders/{wo['id']}/vendor", json={"vendor_id": v["id"], "email_vendor": True, "message": "Kitchen sink"})
    assert r.status_code == 200 and r.json()["email_sent"] is True
    msg = next(m for m in outbox if m["to"] == ["ace@example.com"])
    assert "Leaking sink" in msg["subject"] and "1 Oak St" in msg["html"]
    detail = c.get(f"/api/work-orders/{wo['id']}").json()
    assert detail["vendor"]["name"] == "Ace Plumbing" and detail["status"] == "assigned"

    c.patch(f"/api/vendors/{v['id']}", json={"archived": True})
    assert c.get("/api/vendors").json()[0]["name"] == "Bright Electric"
    wo2 = _wo(c, prop)
    assert c.put(f"/api/work-orders/{wo2['id']}/vendor", json={"vendor_id": v["id"]}).status_code == 400


def test_quotes_invoice_becomes_expense_and_rating():
    c, _ = register()
    prop = make_property(c)
    a, b = _vendor(c), _vendor(c, name="Budget Plumbing")
    wo = _wo(c, prop)
    c.post(f"/api/work-orders/{wo['id']}/quotes", json={"vendor_id": a["id"], "amount_cents": 45000})
    r = c.post(f"/api/work-orders/{wo['id']}/quotes", json={"vendor_id": b["id"], "amount_cents": 38000, "description": "Replace trap"})
    quotes = r.json()["quotes"]
    cheap = next(q for q in quotes if q["vendor_name"] == "Budget Plumbing")
    out = c.post(f"/api/quotes/{cheap['id']}/approve").json()
    assert {q["vendor_name"]: q["status"] for q in out["quotes"]} == {"Ace Plumbing": "declined", "Budget Plumbing": "approved"}
    assert out["vendor"]["name"] == "Budget Plumbing"
    assert c.post(f"/api/quotes/{cheap['id']}/approve").status_code == 400

    inv = c.post(f"/api/work-orders/{wo['id']}/invoices", json={"invoice_number": "B-17", "amount_cents": 38000, "invoice_date": "2026-10-10"})
    assert inv.status_code == 201, inv.text
    invoice = inv.json()["invoices"][0]
    assert invoice["status"] == "unpaid" and invoice["expense_id"]
    detail = c.get(f"/api/work-orders/{wo['id']}").json()
    assert detail["status"] == "completed"
    assert detail["expenses"][0]["amount_cents"] == 38000 and detail["expenses"][0]["vendor"] == "Budget Plumbing"
    assert "B-17" in detail["expenses"][0]["description"]

    paid = c.post(f"/api/invoices/{invoice['id']}/paid", json={"paid_on": "2026-10-15"}).json()
    assert paid["invoices"][0]["status"] == "paid"
    assert c.post(f"/api/work-orders/{wo['id']}/rating", json={"rating": 6}).status_code == 422
    c.post(f"/api/work-orders/{wo['id']}/rating", json={"rating": 4})
    vend = c.get(f"/api/vendors/{b['id']}").json()
    assert vend["rating"] == 4.0 and vend["job_count"] == 1 and vend["total_billed_cents"] == 38000 and vend["unpaid_cents"] == 0

    gone = c.delete(f"/api/invoices/{invoice['id']}").json()
    assert gone["invoices"] == []
    assert c.get(f"/api/work-orders/{wo['id']}").json()["expenses"] == []


def test_preventive_schedule_creates_work_orders(session, outbox):
    c, _ = register()
    prop = make_property(c)
    v = _vendor(c, name="Cool Air", trades=["hvac"])
    asset = c.post("/api/assets", json={"property_id": prop["id"], "name": "Furnace", "category": "hvac", "make": "Carrier"}).json()
    s = c.post(
        "/api/maintenance-schedules",
        json={"property_id": prop["id"], "title": "Replace HVAC filter", "category": "hvac", "interval_months": 3, "next_due_on": "2026-11-01", "lead_days": 7, "vendor_id": v["id"], "asset_id": asset["id"]},
    )
    assert s.status_code == 201, s.text
    s = s.json()
    org = session.get(Organization, UUID(c.headers["X-Org-Id"]))

    jobs.run_daily_for_org(session, org, today=d("2026-10-20"))  # before the lead window
    assert c.get("/api/work-orders").json() == []
    stats = jobs.run_daily_for_org(session, org, today=d("2026-10-26"))
    assert stats["preventive_work_orders"] == 1
    wos = c.get("/api/work-orders").json()
    assert len(wos) == 1 and wos[0]["title"] == "Replace HVAC filter" and wos[0]["vendor_name"] == "Cool Air" and wos[0]["status"] == "assigned"
    session.expire_all()
    assert session.get(MaintenanceSchedule, UUID(s["id"])).next_due_on == d("2027-02-01")
    jobs.run_daily_for_org(session, org, today=d("2026-10-27"))  # idempotent
    assert len(c.get("/api/work-orders").json()) == 1
    assert c.get(f"/api/assets/{asset['id']}").json()["work_orders"][0]["title"] == "Replace HVAC filter"

    # Long overdue schedule → one work order, next date moves past today.
    s2 = c.post("/api/maintenance-schedules", json={"property_id": prop["id"], "title": "Test smoke detectors", "interval_months": 6, "next_due_on": "2025-01-01"}).json()
    jobs.run_daily_for_org(session, org, today=d("2026-10-28"))
    session.expire_all()
    assert session.get(MaintenanceSchedule, UUID(s2["id"])).next_due_on == d("2027-01-01")
    assert len(c.get("/api/work-orders").json()) == 2

    run = c.post(f"/api/maintenance-schedules/{s['id']}/run-now").json()
    assert run["schedule"]["next_due_on"] == "2027-05-01"
    c.patch(f"/api/maintenance-schedules/{s['id']}", json={"active": False})
    assert c.delete(f"/api/maintenance-schedules/{s['id']}").json()["ok"]
    assert session.get(WorkOrder, UUID(run["work_order_id"])) is not None


def test_assets_warranty_alert_and_vendor_insurance_alert(session, outbox):
    c, _ = register()
    prop = make_property(c)
    a = c.post("/api/assets", json={"property_id": prop["id"], "name": "Dishwasher", "warranty_expires_on": "2026-11-10"}).json()
    assert a["warranty_status"] in ("expiring", "ok", "expired")
    _vendor(c, insurance_expires_on="2026-11-05")
    org = session.get(Organization, UUID(c.headers["X-Org-Id"]))
    stats = jobs.run_daily_for_org(session, org, today=d("2026-10-20"))
    assert stats["maintenance_alerts"] == 2
    subjects = [m["subject"] for m in outbox]
    assert any("Warranty ending" in s for s in subjects) and any("Insurance expiring" in s for s in subjects)
    assert jobs.run_daily_for_org(session, org, today=d("2026-10-21"))["maintenance_alerts"] == 0  # deduplicated
    c.patch(f"/api/assets/{a['id']}", json={"archived": True})
    assert c.get(f"/api/assets?property_id={prop['id']}").json() == []


def test_access_codes_hidden_from_accountant_and_scoped_members():
    c, _ = register()
    prop = make_property(c)
    other = make_property(c, name="Elm St")
    item = c.post("/api/access-items", json={"property_id": prop["id"], "kind": "lockbox", "label": "Lockbox", "code": "4821", "holder": "Office"}).json()
    assert item["code"] == "4821"
    upd = c.patch(f"/api/access-items/{item['id']}", json={"code": "9055"}).json()
    assert upd["code"] == "9055"
    log = c.get("/api/audit-log").json()
    rows = log["items"] if isinstance(log, dict) else log
    assert not any("9055" in str(r) for r in rows)

    inv = c.post("/api/org/invitations", json={"email": "acct@example.com", "role": "accountant"}).json()
    ac = new_client()
    me = ac.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Acct", "password": PASSWORD}).json()
    ac.headers["X-Org-Id"] = me["organizations"][0]["id"]
    assert ac.get("/api/access-items").json()[0]["code"] == "••••"
    assert ac.post("/api/access-items", json={"property_id": prop["id"], "label": "x"}).status_code == 403

    inv = c.post("/api/org/invitations", json={"email": "mgr@example.com", "role": "manager", "property_ids": [other["id"]]}).json()
    mc = new_client()
    me = mc.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Mgr", "password": PASSWORD}).json()
    mc.headers["X-Org-Id"] = me["organizations"][0]["id"]
    assert mc.get("/api/access-items").json() == []
    assert mc.patch(f"/api/access-items/{item['id']}", json={"label": "x"}).status_code == 404


def test_vendor_documents_and_other_org_isolation():
    c, _ = register()
    v = _vendor(c)
    up = c.post("/api/documents", data={"owner_type": "vendor", "owner_id": v["id"], "kind": "w9"}, files={"file": ("w9.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert up.status_code == 201, up.text
    other, _ = register(email="other@example.com", org="Other")
    assert other.get(f"/api/vendors/{v['id']}").status_code == 404
    assert other.post("/api/documents", data={"owner_type": "vendor", "owner_id": v["id"], "kind": "w9"}, files={"file": ("w9.pdf", b"%PDF", "application/pdf")}).status_code == 404
