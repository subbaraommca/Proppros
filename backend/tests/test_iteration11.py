"""Iteration 11: property-scoped access, plans & billing, 2FA, Google sign-in, admin console, feedback."""
import json
import uuid

import pyotp
import pytest
from sqlmodel import select

from app.core.config import settings
from app.models import AuditLog, Feedback, Organization, User
from app.routers import auth as auth_router
from app.services import plans
from app.services import stripe_gateway as gateway
from tests.helpers import PASSWORD, make_lease, make_property, make_tenant, new_client, register, token_from


# ── Property-scoped team access ──────────────────────────────────────────────


def _two_properties_and_scoped_manager(outbox):
    owner, _ = register()
    a = make_property(owner, "Alpha House")
    b = make_property(owner, "Beta House")
    ta = make_tenant(owner, "Ann", "Alpha", "ann@example.com")
    tb = make_tenant(owner, "Bob", "Beta", "bob@example.com")
    loose = make_tenant(owner, "Nia", "Nolease", "nia@example.com")
    la = make_lease(owner, a["units"][0]["id"], [ta["id"]], charges_start_on="2026-10-01")
    lb = make_lease(owner, b["units"][0]["id"], [tb["id"]], charges_start_on="2026-10-01")
    owner.post("/api/expenses", json={"property_id": a["id"], "category": "repairs", "amount_cents": 1000, "expense_date": "2026-10-05"})
    eb = owner.post("/api/expenses", json={"property_id": b["id"], "category": "repairs", "amount_cents": 2000, "expense_date": "2026-10-05"}).json()
    owner.post("/api/work-orders", json={"property_id": b["id"], "title": "Beta leak"})
    r = owner.post("/api/org/invitations", json={"email": "mgr@example.com", "role": "manager", "property_ids": [a["id"]]})
    assert r.status_code == 200, r.text
    mgr = new_client()
    me = mgr.post("/api/auth/invitations/accept", json={"token": token_from(outbox, "/invite"), "name": "Mia", "password": PASSWORD}).json()
    mgr.headers["X-Org-Id"] = me["organizations"][0]["id"]
    return owner, mgr, a, b, la, lb, ta, tb, loose, eb


def test_scoped_manager_sees_only_assigned_properties(outbox):
    owner, mgr, a, b, la, lb, ta, tb, loose, eb = _two_properties_and_scoped_manager(outbox)
    assert [p["name"] for p in mgr.get("/api/properties").json()] == ["Alpha House"]
    assert {u["property_name"] for u in mgr.get("/api/units").json()} == {"Alpha House"}
    assert [l["id"] for l in mgr.get("/api/leases").json()] == [la["id"]]
    names = {t["first_name"] for t in mgr.get("/api/tenants").json()}
    assert names == {"Ann", "Nia"}  # Beta's tenant hidden; tenant without a lease visible
    assert [e["property_name"] for e in mgr.get("/api/expenses").json()] == ["Alpha House"]
    assert mgr.get("/api/work-orders").json() == []
    roll = mgr.get("/api/reports/rent-roll").json()
    assert {r["property_name"] for r in roll} == {"Alpha House"}
    pnl = mgr.get("/api/reports/pnl?start=2026-01-01&end=2026-12-31").json()
    assert pnl["totals"]["expense_cents"] == 1000
    dash = mgr.get("/api/dashboard").json()
    assert dash["units"] == 1 and dash["open_work_orders"]["total"] == 0


def test_scoped_manager_cannot_reach_other_property_records(outbox):
    owner, mgr, a, b, la, lb, ta, tb, loose, eb = _two_properties_and_scoped_manager(outbox)
    assert mgr.get(f"/api/properties/{b['id']}").status_code == 404
    assert mgr.get(f"/api/leases/{lb['id']}").status_code == 404
    assert mgr.get(f"/api/leases/{lb['id']}/ledger").status_code == 404
    assert mgr.post(f"/api/leases/{lb['id']}/payments", json={"amount_cents": 100, "method": "cash", "received_on": "2026-10-03"}).status_code == 404
    assert mgr.patch(f"/api/expenses/{eb['id']}", json={"amount_cents": 1}).status_code == 404
    assert mgr.get(f"/api/tenants/{tb['id']}").status_code == 404
    assert mgr.post(f"/api/properties/{b['id']}/units", json={"name": "X"}).status_code == 404
    doc = owner.post("/api/documents", data={"owner_type": "lease", "owner_id": lb["id"]}, files={"file": ("b.pdf", b"%PDF", "application/pdf")}).json()
    assert mgr.get(f"/api/documents/{doc['id']}/file").status_code == 404
    assert doc["id"] not in [d["id"] for d in mgr.get("/api/documents").json()]
    # Org-wide actions need full access
    assert mgr.post("/api/properties", json={"name": "New", "address_line1": "1", "city": "c", "state": "s", "postal_code": "1"}).status_code == 403
    assert mgr.post("/api/org/invitations", json={"email": "x@example.com", "role": "accountant"}).status_code == 403
    assert mgr.get("/api/audit-log").status_code == 403
    # Owner widens access
    member = next(m for m in owner.get("/api/org/members").json()["members"] if m["email"] == "mgr@example.com")
    assert member["property_ids"] == [a["id"]]
    assert owner.patch(f"/api/org/members/{member['membership_id']}", json={"all_properties": True}).status_code == 200
    assert len(mgr.get("/api/properties").json()) == 2


def test_invite_rejects_foreign_property(outbox):
    owner, _ = register()
    other, _ = register("O", "o@example.com", "Other")
    foreign = make_property(other, "Foreign")
    r = owner.post("/api/org/invitations", json={"email": "m@example.com", "role": "manager", "property_ids": [foreign["id"]]})
    assert r.status_code == 400


# ── Plans, limits & subscriptions ────────────────────────────────────────────


@pytest.fixture
def billing_on(monkeypatch):
    monkeypatch.setattr(settings, "billing_enabled", True)
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_fake")
    monkeypatch.setattr(settings, "stripe_price_pro", "price_pro")
    monkeypatch.setattr(settings, "stripe_price_business", "price_biz")
    calls = []
    monkeypatch.setattr(gateway, "create_billing_customer", lambda email, name, org_id: "cus_billing")
    monkeypatch.setattr(gateway, "checkout_subscription", lambda **kw: calls.append(kw) or "https://checkout.stripe.test/sub")
    monkeypatch.setattr(gateway, "billing_portal", lambda customer, return_url: "https://billing.stripe.test/portal")
    monkeypatch.setattr(gateway, "set_subscription_quantity", lambda sub_id, qty: calls.append({"qty": qty}) or True)
    monkeypatch.setattr(gateway, "parse_webhook", lambda payload, sig: json.loads(payload))
    return calls


def test_limits_not_enforced_without_billing():
    c, _ = register()
    prop = make_property(c, "Fourplex", "multi_family")
    for i in range(5):
        assert c.post(f"/api/properties/{prop['id']}/units", json={"name": str(i)}).status_code == 201
    b = c.get("/api/billing").json()
    assert b["unit_limit"] is None and b["plan"] == "free" and b["billing_active"] is False


def test_free_plan_unit_and_seat_limits(billing_on, outbox):
    c, _ = register()
    prop = make_property(c, "Fourplex", "multi_family")
    for i in range(3):
        assert c.post(f"/api/properties/{prop['id']}/units", json={"name": str(i)}).status_code == 201
    r = c.post(f"/api/properties/{prop['id']}/units", json={"name": "4"})
    assert r.status_code == 402 and "Upgrade" in r.json()["detail"]
    assert c.post("/api/org/invitations", json={"email": "a@example.com", "role": "manager"}).status_code == 200  # owner + 1 = 2 seats
    assert c.post("/api/org/invitations", json={"email": "b@example.com", "role": "manager"}).status_code == 402


def test_subscription_checkout_and_webhooks(billing_on, session):
    c, _ = register()
    org_id = c.headers["X-Org-Id"]
    r = c.post("/api/billing/checkout", json={"plan": "pro"})
    assert r.json()["url"] == "https://checkout.stripe.test/sub" and billing_on[0]["price_id"] == "price_pro"
    sub = {"id": "sub_1", "customer": "cus_billing", "status": "active", "metadata": {"org_id": org_id}, "items": {"data": [{"price": {"id": "price_pro"}, "quantity": 1, "current_period_end": 1793000000}]}}
    hook = new_client()
    out = hook.post("/api/stripe/webhook", content=json.dumps({"id": "evt_sub1", "type": "customer.subscription.updated", "data": {"object": sub}}), headers={"stripe-signature": "x"}).json()
    assert out["outcome"] == "subscription_active"
    b = c.get("/api/billing").json()
    assert b["plan"] == "pro" and b["unit_limit"] is None and b["seat_limit"] == 10
    assert c.post("/api/billing/portal").json()["url"].startswith("https://billing.stripe.test")
    org = session.get(Organization, uuid.UUID(org_id))
    make_property(c, "Duplex", "multi_family")
    assert plans.sync_quantity(session, org) is True  # quantity follows units
    hook.post("/api/stripe/webhook", content=json.dumps({"id": "evt_sub2", "type": "customer.subscription.deleted", "data": {"object": {**sub, "status": "canceled"}}}), headers={"stripe-signature": "x"})
    assert c.get("/api/billing").json()["plan"] == "free"


# ── Two-factor authentication ────────────────────────────────────────────────


def test_mfa_setup_login_recovery_and_disable():
    c, me = register()
    setup = c.post("/api/auth/mfa/setup").json()
    assert setup["otpauth_uri"].startswith("otpauth://totp/") and setup["qr_svg_data_uri"].startswith("data:image/svg+xml")
    assert c.post("/api/auth/mfa/enable", json={"code": "000000"}).status_code == 400
    totp = pyotp.TOTP(setup["secret"])
    codes = c.post("/api/auth/mfa/enable", json={"code": totp.now()}).json()["recovery_codes"]
    assert len(codes) == 10

    fresh = new_client()
    step1 = fresh.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).json()
    assert step1["mfa_required"] is True and "pp_token" not in fresh.cookies
    assert new_client().get("/api/auth/me", headers={"Authorization": f"Bearer {step1['mfa_token']}"}).status_code == 401  # not a session
    assert fresh.post("/api/auth/login/mfa", json={"mfa_token": step1["mfa_token"], "code": "123456"}).status_code == 401
    ok = fresh.post("/api/auth/login/mfa", json={"mfa_token": step1["mfa_token"], "code": totp.now()})
    assert ok.status_code == 200 and ok.json()["mfa_enabled"] is True
    assert fresh.get("/api/auth/me").status_code == 200

    other = new_client()
    t2 = other.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).json()["mfa_token"]
    assert other.post("/api/auth/login/mfa", json={"mfa_token": t2, "code": codes[0]}).status_code == 200  # recovery code
    again = new_client()
    t3 = again.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).json()["mfa_token"]
    assert again.post("/api/auth/login/mfa", json={"mfa_token": t3, "code": codes[0]}).status_code == 401  # single use

    assert c.post("/api/auth/mfa/disable", json={"password": "wrong-pass-1", "code": totp.now()}).status_code == 400
    assert c.post("/api/auth/mfa/disable", json={"password": PASSWORD, "code": totp.now()}).status_code == 200
    assert "mfa_required" not in new_client().post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).json()


# ── Google sign-in ───────────────────────────────────────────────────────────


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "client-123.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "google_client_secret", "secret")
    claims = {"sub": "google-sub-1", "email": "gina@example.com", "email_verified": True, "name": "Gina Green"}
    monkeypatch.setattr(auth_router, "exchange_google_code", lambda code: "id-token")
    monkeypatch.setattr(auth_router, "verify_google_id_token", lambda token: dict(claims))
    return claims


def _google_round_trip(client):
    start = client.get("/api/auth/google/start", follow_redirects=False)
    assert start.status_code == 302 and "accounts.google.com" in start.headers["location"]
    state = start.headers["location"].split("state=")[1].split("&")[0]
    return client.get(f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False)


def test_google_creates_account_and_links_existing(google):
    assert new_client().get("/api/auth/providers").json() == {"google": True}
    c = new_client()
    r = _google_round_trip(c)
    assert r.status_code == 302 and r.headers["location"].endswith("/")
    me = c.get("/api/auth/me").json()
    assert me["email"] == "gina@example.com" and me["google_linked"] and me["organizations"][0]["role"] == "owner"
    # Existing password account with the same email gets linked, not duplicated
    register("Owner", "owner@example.com")
    google.update({"sub": "google-sub-2", "email": "owner@example.com"})
    c2 = new_client()
    _google_round_trip(c2)
    assert c2.get("/api/auth/me").json()["email"] == "owner@example.com"


def test_google_rejects_bad_state_and_unverified_email(google):
    c = new_client()
    c.get("/api/auth/google/start", follow_redirects=False)
    bad = c.get("/api/auth/google/callback?code=abc&state=forged", follow_redirects=False)
    assert "error=google" in bad.headers["location"]
    google["email_verified"] = False
    assert "error=google" in _google_round_trip(new_client()).headers["location"]


# ── Admin console & impersonation ────────────────────────────────────────────


def test_admin_console_and_impersonation(monkeypatch, session):
    admin, _ = register("Ada Admin", "ada@example.org", "Proppros HQ")
    customer, cme = register("Cara Customer", "cara@example.com", "Cara Rentals")
    assert admin.get("/api/admin/overview").status_code == 403
    monkeypatch.setattr(settings, "superadmin_emails", "ada@example.org")
    assert admin.get("/api/auth/me").json()["is_superadmin"] is True
    ov = admin.get("/api/admin/overview").json()
    assert ov["organizations"] == 2 and ov["users"] == 2
    orgs = admin.get("/api/admin/orgs?q=Cara").json()
    assert orgs[0]["owner_email"] == "cara@example.com"
    assert admin.patch(f"/api/admin/orgs/{orgs[0]['id']}", json={"plan": "business", "plan_comped": True}).json()["effective_plan"] == "business"
    assert customer.get("/api/admin/orgs").status_code == 403

    r = admin.post(f"/api/admin/impersonate/{cme['id']}")
    assert r.status_code == 200 and r.json()["email"] == "cara@example.com" and r.json()["impersonated_by"] == "ada@example.org"
    assert admin.get("/api/auth/me").json()["email"] == "cara@example.com"
    logs = session.exec(select(AuditLog).where(AuditLog.action == "support_access")).all()
    assert logs and "ada@example.org" in logs[0].summary
    back = admin.post("/api/admin/impersonate/stop")
    assert back.status_code == 200 and back.json()["email"] == "ada@example.org"
    admin_user = session.exec(select(User).where(User.email == "ada@example.org")).one()
    assert admin.post(f"/api/admin/impersonate/{admin_user.id}").status_code == 400


def test_feedback_flow(monkeypatch, outbox):
    monkeypatch.setattr(settings, "superadmin_emails", "ada@example.org")
    c, _ = register()
    assert c.post("/api/feedback", json={"kind": "bug", "message": "The rent roll CSV is empty", "page": "/reports"}).status_code == 201
    assert any("[Proppros feedback] bug" in m["subject"] for m in outbox)
    admin, _ = register("Ada", "ada@example.org", "HQ")
    items = admin.get("/api/admin/feedback").json()
    assert items[0]["message"] == "The rent roll CSV is empty" and items[0]["user_email"] == "owner@example.com"
    assert admin.patch(f"/api/admin/feedback/{items[0]['id']}", json={"status": "done"}).json()["status"] == "done"


def test_invite_accept_with_mfa_requires_code(outbox):
    owner, _ = register()
    other, _ = register("Max", "max@example.com", "Max Co")
    secret = other.post("/api/auth/mfa/setup").json()["secret"]
    other.post("/api/auth/mfa/enable", json={"code": pyotp.TOTP(secret).now()})
    owner.post("/api/org/invitations", json={"email": "max@example.com", "role": "manager"})
    r = new_client().post("/api/auth/invitations/accept", json={"token": token_from(outbox, "/invite"), "password": PASSWORD}).json()
    assert r["mfa_required"] is True


def test_public_plans():
    data = new_client().get("/api/public/plans").json()
    assert [p["id"] for p in data["plans"]] == ["free", "pro", "business"]
    assert data["billing_active"] is False
    _ = Feedback  # model registered
