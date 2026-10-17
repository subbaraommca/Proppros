"""Expenses, reports, dashboard, work orders, documents and the tenant portal."""
from tests.helpers import PASSWORD, make_lease, make_property, make_tenant, new_client, register, token_from


def _portfolio():
    c, _ = register()
    prop = make_property(c)
    unit_id = prop["units"][0]["id"]
    t = make_tenant(c)
    lease = make_lease(c, unit_id, [t["id"]], charges_start_on="2026-10-01")
    return c, prop, unit_id, t, lease


# ── Expenses & reports ───────────────────────────────────────────────────────


def test_expenses_and_pnl():
    c, prop, unit_id, _, lease = _portfolio()
    c.post(f"/api/leases/{lease['id']}/payments", json={"amount_cents": 150000, "method": "zelle", "received_on": "2026-10-02", "send_receipt": False})
    for amount, cat in ((20000, "repairs"), (8000, "utilities")):
        r = c.post("/api/expenses", json={"property_id": prop["id"], "category": cat, "amount_cents": amount, "expense_date": "2026-10-05"})
        assert r.status_code == 201
    pnl = c.get("/api/reports/pnl?start=2026-01-01&end=2026-12-31").json()
    assert pnl["totals"] == {"income_cents": 150000, "expense_cents": 28000, "net_cents": 122000}
    assert pnl["expenses_by_category"]["repairs"] == 20000
    by_month = c.get("/api/reports/pnl?start=2026-01-01&end=2026-12-31&group_by=month").json()
    assert by_month["rows"][0]["key"] == "2026-10"
    csv = c.get("/api/reports/pnl?start=2026-01-01&end=2026-12-31&format=csv")
    assert csv.headers["content-type"].startswith("text/csv") and "Total,1500.00,280.00,1220.00" in csv.text


def test_expense_unit_must_match_property():
    c, prop, _, _, _ = _portfolio()
    other = make_property(c, "Pine")
    r = c.post("/api/expenses", json={"property_id": prop["id"], "unit_id": other["units"][0]["id"], "category": "repairs", "amount_cents": 100, "expense_date": "2026-10-01"})
    assert r.status_code == 400


def test_rent_roll_and_outstanding_and_dashboard():
    c, _, _, _, lease = _portfolio()
    roll = c.get("/api/reports/rent-roll").json()
    assert roll[0]["tenants"] == "Tina Tenant" and roll[0]["rent_cents"] == 150000
    owed = c.get("/api/reports/outstanding").json()
    assert owed[0]["lease_id"] == lease["id"]
    dash = c.get("/api/dashboard").json()
    assert dash["units"] == 1 and dash["occupancy_pct"] == 100
    assert len(dash["cash_flow"]) == 12
    assert dash["outstanding_cents"] == owed[0]["balance_cents"]


# ── Work orders ──────────────────────────────────────────────────────────────


def test_work_order_lifecycle_and_expense():
    c, prop, unit_id, _, _ = _portfolio()
    wo = c.post("/api/work-orders", json={"property_id": prop["id"], "unit_id": unit_id, "title": "Leaky faucet", "category": "plumbing"}).json()
    assert wo["status"] == "new" and wo["number"] == 1
    for status in ("assigned", "scheduled", "in_progress"):
        r = c.patch(f"/api/work-orders/{wo['id']}", json={"status": status})
        assert r.status_code == 200, r.text
    r = c.post(f"/api/work-orders/{wo['id']}/complete-with-expense", json={"amount_cents": 12500, "vendor": "Joe Plumbing", "expense_date": "2026-10-10"})
    assert r.json()["status"] == "completed"
    detail = c.get(f"/api/work-orders/{wo['id']}").json()
    assert detail["expenses"][0]["amount_cents"] == 12500
    assert any("Completed" in cm["body"] for cm in detail["comments"] if cm["is_system"])
    assert c.patch(f"/api/work-orders/{wo['id']}", json={"status": "closed"}).json()["status"] == "closed"
    # Can't jump from closed back to new
    assert c.patch(f"/api/work-orders/{wo['id']}", json={"status": "new"}).status_code == 400


def test_maintenance_role_can_only_edit_assigned(outbox):
    owner, me = register()
    prop = make_property(owner)
    owner.post("/api/org/invitations", json={"email": "fix@example.com", "role": "maintenance"})
    tech = new_client()
    tech_me = tech.post("/api/auth/invitations/accept", json={"token": token_from(outbox, "/invite"), "name": "Fixer", "password": PASSWORD}).json()
    tech.headers["X-Org-Id"] = tech_me["organizations"][0]["id"]
    wo1 = owner.post("/api/work-orders", json={"property_id": prop["id"], "title": "Mine", "assigned_to_user_id": tech_me["id"]}).json()
    wo2 = owner.post("/api/work-orders", json={"property_id": prop["id"], "title": "Not mine"}).json()
    assert wo1["status"] == "assigned"
    assert tech.patch(f"/api/work-orders/{wo1['id']}", json={"status": "in_progress"}).status_code == 200
    assert tech.patch(f"/api/work-orders/{wo2['id']}", json={"status": "in_progress"}).status_code == 403
    assert tech.get("/api/dashboard").status_code == 403  # no finance access
    assert tech.get("/api/payments").status_code == 403


# ── Documents ────────────────────────────────────────────────────────────────


def test_document_upload_download_and_validation():
    c, prop, _, _, _ = _portfolio()
    r = c.post(
        "/api/documents",
        data={"owner_type": "property", "owner_id": prop["id"], "kind": "insurance", "expires_on": "2026-11-01"},
        files={"file": ("policy.pdf", b"%PDF-1.4 test", "application/pdf")},
    )
    assert r.status_code == 201, r.text
    doc = r.json()
    assert "storage_key" not in doc and doc["owner_label"] == "Oak St"
    f = c.get(f"/api/documents/{doc['id']}/file")
    assert f.status_code == 200 and f.content == b"%PDF-1.4 test"
    bad = c.post("/api/documents", data={"owner_type": "property", "owner_id": prop["id"]}, files={"file": ("x.exe", b"MZ", "application/x-msdownload")})
    assert bad.status_code == 415
    expiring = c.get("/api/documents?expiring_within_days=60").json()
    assert [d["id"] for d in expiring] == [doc["id"]]
    assert c.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert c.get(f"/api/documents/{doc['id']}/file").status_code == 404


def test_document_owner_must_be_in_org():
    a, _ = register("A", "a@example.com")
    b, _ = register("B", "b@example.com")
    prop = make_property(a)
    r = b.post("/api/documents", data={"owner_type": "property", "owner_id": prop["id"]}, files={"file": ("a.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 404


# ── Tenant portal ────────────────────────────────────────────────────────────


def _portal_tenant(outbox):
    c, prop, unit_id, t, lease = _portfolio()
    assert c.post(f"/api/tenants/{t['id']}/invite").status_code == 200
    tc = new_client()
    me = tc.post("/api/auth/invitations/accept", json={"token": token_from(outbox, "/invite"), "name": "Tina", "password": PASSWORD}).json()
    assert me["organizations"][0]["role"] == "tenant"
    tc.headers["X-Org-Id"] = me["organizations"][0]["id"]
    return c, tc, prop, unit_id, t, lease


def test_portal_home_and_isolation(outbox):
    c, tc, prop, _, t, lease = _portal_tenant(outbox)
    home = tc.get("/api/portal/home").json()
    assert home["leases"][0]["id"] == lease["id"]
    assert home["leases"][0]["balance_cents"] == c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    assert "notes" not in home["leases"][0]
    # Tenant can't use staff endpoints
    assert tc.get("/api/properties").status_code == 403
    assert tc.get(f"/api/leases/{lease['id']}").status_code == 403
    # Another lease in the same org is invisible
    other_t = make_tenant(c, "Other", "Person", "other@example.com")
    other_prop = make_property(c, "Pine")
    other_lease = make_lease(c, other_prop["units"][0]["id"], [other_t["id"]])
    assert tc.get(f"/api/portal/leases/{other_lease['id']}").status_code == 404
    assert tc.get(f"/api/portal/leases/{other_lease['id']}/ledger").status_code == 404


def test_portal_receipts_and_documents(outbox):
    c, tc, _, unit_id, _, lease = _portal_tenant(outbox)
    pay = c.post(f"/api/leases/{lease['id']}/payments", json={"amount_cents": 50000, "method": "cash", "received_on": "2026-10-03"}).json()
    assert tc.get("/api/portal/payments").json()[0]["id"] == pay["id"]
    assert tc.get(f"/api/portal/payments/{pay['id']}/receipt.pdf").content[:4] == b"%PDF"
    shared = c.post("/api/documents", data={"owner_type": "lease", "owner_id": lease["id"], "kind": "lease", "visible_to_tenant": "true"}, files={"file": ("lease.pdf", b"%PDF", "application/pdf")}).json()
    private = c.post("/api/documents", data={"owner_type": "lease", "owner_id": lease["id"], "kind": "other"}, files={"file": ("notes.pdf", b"%PDF", "application/pdf")}).json()
    ids = [d["id"] for d in tc.get("/api/portal/documents").json()]
    assert shared["id"] in ids and private["id"] not in ids
    assert tc.get(f"/api/documents/{shared['id']}/file").status_code == 200
    assert tc.get(f"/api/documents/{private['id']}/file").status_code == 404


def test_portal_maintenance_request_flow(outbox):
    c, tc, prop, unit_id, _, _ = _portal_tenant(outbox)
    outbox.clear()
    r = tc.post("/api/portal/work-orders", json={"title": "No hot water", "category": "plumbing", "priority": "high", "permission_to_enter": True})
    assert r.status_code == 201
    wo = r.json()
    assert wo["unit_id"] == unit_id
    assert any("New maintenance request" in m["subject"] for m in outbox)  # owner notified
    photo = tc.post(f"/api/portal/work-orders/{wo['id']}/attachments", files={"file": ("heater.jpg", b"\xff\xd8\xff", "image/jpeg")})
    assert photo.status_code == 201
    # Staff internal note is hidden from tenant; public comment is visible and emails the tenant
    c.post(f"/api/work-orders/{wo['id']}/comments", json={"body": "Check warranty first", "is_internal": True})
    outbox.clear()
    c.post(f"/api/work-orders/{wo['id']}/comments", json={"body": "Plumber coming Tuesday"})
    assert outbox and outbox[-1]["to"] == ["tina@example.com"]
    c.patch(f"/api/work-orders/{wo['id']}", json={"status": "scheduled"})
    detail = tc.get(f"/api/portal/work-orders/{wo['id']}").json()
    bodies = [cm["body"] for cm in detail["comments"]]
    assert "Plumber coming Tuesday" in bodies and "Check warranty first" not in bodies
    assert detail["status"] == "scheduled"
    assert len(detail["attachments"]) == 1
    tc.post(f"/api/portal/work-orders/{wo['id']}/comments", json={"body": "Thanks!"})
    staff_view = c.get(f"/api/work-orders/{wo['id']}").json()
    assert any(cm["body"] == "Thanks!" for cm in staff_view["comments"])


def test_invite_returns_shareable_link_without_email():
    c, prop, unit_id, t, lease = _portfolio()
    r = c.post(f"/api/tenants/{t['id']}/invite").json()
    assert r["email_sent"] is False  # no email provider configured in tests
    token = r["invite_url"].split("token=")[1]
    tc = new_client()
    me = tc.post("/api/auth/invitations/accept", json={"token": token, "name": "Tina", "password": PASSWORD}).json()
    assert me["organizations"][0]["role"] == "tenant"
