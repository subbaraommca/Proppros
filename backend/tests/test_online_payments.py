"""Iteration 10 — online payments via Stripe Connect, with the Stripe gateway faked."""
import json
import uuid

import pytest
from sqlmodel import select

from app.core.config import settings
from app.models import AutopayEnrollment, Lease, LedgerEntry, Organization, Payment
from app.services import billing
from app.services import online_payments as op
from app.services import stripe_gateway as gateway
from tests.helpers import PASSWORD, d, make_lease, make_property, make_tenant, new_client, register, token_from


class FakeStripe:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.account_flags = {"charges_enabled": True, "payouts_enabled": True, "details_submitted": True}
        self.saved_method = {"id": "pm_card_visa", "type": "card", "label": "Visa •••• 4242"}
        self.decline_autopay = False

    def install(self, monkeypatch):
        monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
        monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_fake")
        for name in ("create_express_account", "onboarding_link", "dashboard_link", "account_status", "create_customer", "checkout_payment", "checkout_setup", "setup_intent_payment_method", "charge_saved_method", "detach_payment_method", "parse_webhook"):
            monkeypatch.setattr(gateway, name, getattr(self, name))

    def create_express_account(self, email, org_name, org_id):
        self.calls.append(("create_express_account", {"email": email}))
        return "acct_test123"

    def onboarding_link(self, account_id, return_url, refresh_url):
        self.calls.append(("onboarding_link", {"account": account_id}))
        return "https://connect.stripe.test/onboard"

    def dashboard_link(self, account_id):
        return "https://connect.stripe.test/dashboard"

    def account_status(self, account_id):
        return dict(self.account_flags)

    def create_customer(self, email, name, metadata):
        self.calls.append(("create_customer", {"email": email}))
        return "cus_test1"

    def checkout_payment(self, **kw):
        self.calls.append(("checkout_payment", kw))
        return "cs_test_pay", "https://checkout.stripe.test/pay"

    def checkout_setup(self, **kw):
        self.calls.append(("checkout_setup", kw))
        return "cs_test_setup", "https://checkout.stripe.test/setup"

    def setup_intent_payment_method(self, setup_intent_id):
        return dict(self.saved_method)

    def charge_saved_method(self, **kw):
        if self.decline_autopay:
            raise RuntimeError("card_declined")
        self.calls.append(("charge_saved_method", kw))
        return "pi_autopay_1"

    def detach_payment_method(self, pm_id):
        self.calls.append(("detach", {"pm": pm_id}))

    def parse_webhook(self, payload, signature):
        if signature != "valid":
            raise ValueError("bad signature")
        return json.loads(payload)

    def last(self, name):
        return next(kw for n, kw in reversed(self.calls) if n == name)


@pytest.fixture
def fake(monkeypatch):
    f = FakeStripe()
    f.install(monkeypatch)
    return f


def _event(kind: str, obj: dict, eid: str | None = None) -> dict:
    return {"id": eid or f"evt_{uuid.uuid4().hex[:12]}", "type": kind, "data": {"object": obj}}


def _send(client, event):
    return client.post("/api/stripe/webhook", content=json.dumps(event), headers={"stripe-signature": "valid", "content-type": "application/json"})


def _connected_owner(fake, outbox):
    """Owner with a connected Stripe account, online payments on, a lease, and an invited tenant."""
    c, _ = register()
    c.post("/api/online-payments/connect")
    c.post("/api/online-payments/connect/refresh")
    assert c.patch("/api/online-payments/settings", json={"online_payments_enabled": True}).status_code == 200
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]], charges_start_on="2026-10-01")
    c.post(f"/api/tenants/{t['id']}/invite")
    tc = new_client()
    me = tc.post("/api/auth/invitations/accept", json={"token": token_from(outbox, "/invite"), "name": "Tina", "password": PASSWORD}).json()
    tc.headers["X-Org-Id"] = me["organizations"][0]["id"]
    return c, tc, lease, t


def _pi(lease_id, tenant_id, org_id, rent=150000, fee=0, method="us_bank_account", pid="pi_1", source="online"):
    return {
        "id": pid,
        "object": "payment_intent",
        "amount": rent + fee,
        "payment_method_types": [method],
        "metadata": {"org_id": org_id, "lease_id": lease_id, "tenant_id": tenant_id, "rent_cents": str(rent), "fee_cents": str(fee), "source": source},
    }


# ── Configuration & onboarding ───────────────────────────────────────────────


def test_hidden_when_stripe_not_configured():
    c, _ = register()
    s = c.get("/api/online-payments/settings").json()
    assert s["stripe_configured"] is False and s["accepting"] is False
    assert c.post("/api/online-payments/connect").status_code == 404
    assert new_client().post("/api/stripe/webhook", content=b"{}").status_code == 404


def test_connect_onboarding_and_enable(fake):
    c, _ = register()
    assert c.patch("/api/online-payments/settings", json={"online_payments_enabled": True}).status_code == 400  # not connected yet
    r = c.post("/api/online-payments/connect").json()
    assert r["url"].startswith("https://connect.stripe.test")
    c.post("/api/online-payments/connect")  # second call reuses the account
    assert [n for n, _ in fake.calls].count("create_express_account") == 1
    s = c.post("/api/online-payments/connect/refresh").json()
    assert s["charges_enabled"] and s["connected"]
    s = c.patch("/api/online-payments/settings", json={"online_payments_enabled": True, "pass_card_fee": True}).json()
    assert s["accepting"] and s["pass_card_fee"]


def test_account_updated_webhook_syncs_flags(fake):
    c, _ = register()
    c.post("/api/online-payments/connect")
    _send(new_client(), _event("account.updated", {"id": "acct_test123", "charges_enabled": True, "payouts_enabled": False, "details_submitted": True}))
    s = c.get("/api/online-payments/settings").json()
    assert s["charges_enabled"] and not s["payouts_enabled"]


def test_webhook_rejects_bad_signature(fake):
    r = new_client().post("/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "forged"})
    assert r.status_code == 400


# ── Tenant pays ──────────────────────────────────────────────────────────────


def test_tenant_checkout_rules(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    opts = tc.get("/api/portal/online-payments").json()
    assert opts["enabled"] and opts["leases"][0]["available"] and opts["leases"][0]["payable_cents"] == 150000

    r = tc.post(f"/api/portal/leases/{lease['id']}/pay", json={"amount_cents": 150000, "method": "us_bank_account"})
    assert r.status_code == 200 and r.json()["url"].startswith("https://checkout.stripe.test")
    kw = fake.last("checkout_payment")
    assert kw["destination"] == "acct_test123" and kw["fee_cents"] == 0 and kw["metadata"]["lease_id"] == lease["id"]

    assert tc.post(f"/api/portal/leases/{lease['id']}/pay", json={"amount_cents": 999999, "method": "card"}).status_code == 422  # over balance
    c.patch("/api/online-payments/settings", json={"allow_partial_payments": False})
    assert tc.post(f"/api/portal/leases/{lease['id']}/pay", json={"amount_cents": 50000, "method": "card"}).status_code == 422
    c.patch("/api/online-payments/settings", json={"allow_partial_payments": True, "pass_card_fee": True})
    tc.post(f"/api/portal/leases/{lease['id']}/pay", json={"amount_cents": 100000, "method": "card"})
    assert fake.last("checkout_payment")["fee_cents"] == op.card_fee(100000) == 2930

    c.patch(f"/api/leases/{lease['id']}", json={"block_online_payments": True})
    assert tc.post(f"/api/portal/leases/{lease['id']}/pay", json={"amount_cents": 1000, "method": "card"}).status_code == 400


def test_other_tenant_cannot_pay_my_lease(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    other = make_property(c, "Pine")
    t2 = make_tenant(c, "Other", "Person", "other@example.com")
    lease2 = make_lease(c, other["units"][0]["id"], [t2["id"]])
    assert tc.post(f"/api/portal/leases/{lease2['id']}/pay", json={"amount_cents": 100, "method": "card"}).status_code == 404


def test_ach_lifecycle_processing_then_succeeded(fake, outbox, session):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org_id = c.headers["X-Org-Id"]
    before = c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    pi = _pi(lease["id"], t["id"], org_id)

    assert _send(new_client(), _event("payment_intent.processing", pi)).json()["outcome"] == "processing"
    pays = c.get(f"/api/payments?lease_id={lease['id']}").json()
    assert pays[0]["status"] == "processing" and pays[0]["source"] == "online"
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before  # not credited yet
    assert tc.get("/api/portal/online-payments").json()["leases"][0]["payable_cents"] == before - 150000  # can't double-pay

    outbox.clear()
    ev = _event("payment_intent.succeeded", pi, eid="evt_success_1")
    assert _send(new_client(), ev).json()["outcome"] == "succeeded"
    assert _send(new_client(), ev).json()["outcome"] == "duplicate"  # Stripe retry
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before - 150000
    assert [p["status"] for p in c.get(f"/api/payments?lease_id={lease['id']}").json()] == ["succeeded"]
    assert any(m["subject"].startswith("Payment received") for m in outbox)  # receipt
    entries = session.exec(select(LedgerEntry).where(LedgerEntry.source_key == "stripe:pi_1")).all()
    assert len(entries) == 1


def test_card_success_records_fee_separately(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org_id = c.headers["X-Org-Id"]
    _send(new_client(), _event("payment_intent.succeeded", _pi(lease["id"], t["id"], org_id, rent=100000, fee=2930, method="card", pid="pi_card")))
    p = c.get(f"/api/payments?lease_id={lease['id']}").json()[0]
    assert p["amount_cents"] == 100000 and p["fee_cents"] == 2930 and p["method"] == "card"
    assert c.post(f"/api/payments/{p['id']}/void").status_code == 400  # refund in Stripe instead


def test_failed_payment_notifies_and_never_credits(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org_id = c.headers["X-Org-Id"]
    before = c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    pi = _pi(lease["id"], t["id"], org_id, pid="pi_fail")
    _send(new_client(), _event("payment_intent.processing", pi))
    outbox.clear()
    failed = {**pi, "last_payment_error": {"message": "Insufficient funds"}}
    assert _send(new_client(), _event("payment_intent.payment_failed", failed)).json()["outcome"] == "failed"
    p = c.get(f"/api/payments?lease_id={lease['id']}").json()[0]
    assert p["status"] == "failed" and "Insufficient" in p["failure_reason"]
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before
    recipients = {m["to"][0] for m in outbox}
    assert {"tina@example.com", "owner@example.com"} <= recipients


def test_returned_payment_reversed_with_fee(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org_id = c.headers["X-Org-Id"]
    c.patch("/api/online-payments/settings", json={"returned_payment_fee_cents": 3500})
    before = c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    _send(new_client(), _event("payment_intent.succeeded", _pi(lease["id"], t["id"], org_id, pid="pi_ret")))
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before - 150000
    dispute = {"object": "dispute", "payment_intent": "pi_ret"}
    assert _send(new_client(), _event("charge.dispute.created", dispute)).json()["outcome"] == "reversed"
    assert _send(new_client(), _event("charge.dispute.created", dispute)).json()["outcome"] == "ignored"  # already reversed
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before + 3500
    types = [r["entry_type"] for r in c.get(f"/api/leases/{lease['id']}/ledger").json()]
    assert "payment_reversal" in types and "returned_fee" in types


def test_unrelated_payment_intent_ignored(fake):
    register()
    ev = _event("payment_intent.succeeded", {"id": "pi_other", "metadata": {"source": "something-else"}})
    assert _send(new_client(), ev).json()["outcome"] == "ignored"


# ── Autopay ──────────────────────────────────────────────────────────────────


def test_autopay_enroll_charge_and_cancel(fake, outbox, session):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org_id = c.headers["X-Org-Id"]
    r = tc.post(f"/api/portal/leases/{lease['id']}/autopay")
    assert r.json()["url"].startswith("https://checkout.stripe.test/setup")
    meta = fake.last("checkout_setup")["metadata"]
    cs = {"id": "cs_setup", "mode": "setup", "customer": "cus_test1", "setup_intent": "seti_1", "metadata": meta}
    assert _send(new_client(), _event("checkout.session.completed", cs)).json()["outcome"] == "autopay_enabled"
    assert tc.get("/api/portal/online-payments").json()["leases"][0]["autopay"]["method_label"] == "Visa •••• 4242"

    org = session.get(Organization, uuid.UUID(org_id))
    lease_obj = session.get(Lease, uuid.UUID(lease["id"]))
    billing.post_rent_for_lease(session, lease_obj, d("2026-11-01"))
    session.commit()
    assert op.run_autopay_for_org(session, org, d("2026-11-02")) == 0  # not the due date
    assert op.run_autopay_for_org(session, org, d("2026-11-01")) == 1
    kw = fake.last("charge_saved_method")
    assert kw["idempotency_key"] == f"autopay:{lease['id']}:2026-11"
    assert kw["amount_cents"] == billing.lease_balance(session, lease_obj.id) and kw["metadata"]["source"] == "autopay"

    lease_obj.block_online_payments = True
    session.add(lease_obj)
    session.commit()
    assert op.run_autopay_for_org(session, org, d("2026-11-01")) == 0  # blocked

    assert tc.delete(f"/api/portal/leases/{lease['id']}/autopay").status_code == 200
    assert fake.last("detach")["pm"] == "pm_card_visa"
    session.expire_all()
    assert session.exec(select(AutopayEnrollment)).first().active is False


def test_autopay_decline_notifies(fake, outbox, session):
    c, tc, lease, t = _connected_owner(fake, outbox)
    org = session.get(Organization, uuid.UUID(c.headers["X-Org-Id"]))
    session.add(AutopayEnrollment(org_id=org.id, lease_id=uuid.UUID(lease["id"]), tenant_id=uuid.UUID(t["id"]), stripe_customer_id="cus", stripe_payment_method_id="pm", method_type="card"))
    lease_obj = session.get(Lease, uuid.UUID(lease["id"]))
    billing.post_rent_for_lease(session, lease_obj, d("2026-11-01"))
    session.commit()
    fake.decline_autopay = True
    outbox.clear()
    assert op.run_autopay_for_org(session, org, d("2026-11-01")) == 0
    assert any("Payment problem" in m["subject"] for m in outbox)


def test_daily_job_reports_autopay(fake, outbox):
    c, tc, lease, t = _connected_owner(fake, outbox)
    stats = c.post("/api/automation/run").json()
    assert "autopay" in stats


def test_manual_payments_unaffected(fake, outbox, session):
    c, tc, lease, t = _connected_owner(fake, outbox)
    p = c.post(f"/api/leases/{lease['id']}/payments", json={"amount_cents": 1000, "method": "cash", "received_on": "2026-10-03", "send_receipt": False}).json()
    assert p["status"] == "succeeded" and p["source"] == "manual"
    assert c.post(f"/api/payments/{p['id']}/void").status_code == 200
    assert session.exec(select(Payment)).first() is not None
