import uuid

from sqlmodel import select

from app.models import Lease, LedgerEntry, Organization
from app.services import billing, jobs
from tests.helpers import d, make_lease, make_property, make_tenant, new_client, register


def _setup(**lease_kw):
    c, _ = register()
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]], **lease_kw)
    return c, prop, t, lease


def test_lease_overlap_rejected():
    c, prop, t, _ = _setup()
    r = c.post(
        "/api/leases",
        json={"unit_id": prop["units"][0]["id"], "tenant_ids": [t["id"]], "start_date": "2026-06-01", "rent_cents": 100000},
    )
    assert r.status_code == 409


def test_rent_posting_is_idempotent(session):
    _, _, _, lease_json = _setup(charges_start_on="2026-08-01")
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    # Creation already posted charges through the real "today"; re-running for a fixed date adds nothing twice.
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    first = session.exec(select(LedgerEntry).where(LedgerEntry.lease_id == lease.id, LedgerEntry.entry_type == "rent")).all()
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    again = session.exec(select(LedgerEntry).where(LedgerEntry.lease_id == lease.id, LedgerEntry.entry_type == "rent")).all()
    assert len(first) == len(again)
    periods = sorted(e.period for e in again)
    assert periods[:3] == ["2026-08", "2026-09", "2026-10"]


def test_charges_start_prevents_back_billing(session):
    _, _, _, lease_json = _setup(start_date="2020-01-01", charges_start_on="2026-10-01")
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    periods = {e.period for e in session.exec(select(LedgerEntry).where(LedgerEntry.lease_id == lease.id)).all()}
    assert "2026-09" not in periods and "2026-10" in periods


def test_recurring_charges_posted_with_rent(session):
    _, _, _, lease_json = _setup(
        charges_start_on="2026-10-01",
        recurring_charges=[{"charge_type": "parking", "description": "Parking", "amount_cents": 5000}],
    )
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    oct_entries = session.exec(select(LedgerEntry).where(LedgerEntry.lease_id == lease.id, LedgerEntry.period == "2026-10")).all()
    assert sorted(e.amount_cents for e in oct_entries) == [5000, 150000]


def test_late_fee_only_after_grace_and_only_once(session):
    _, _, _, lease_json = _setup(charges_start_on="2026-10-01", late_fee_type="flat", late_fee_amount=7500, grace_days=5)
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    billing.post_rent_for_lease(session, lease, d("2026-10-06"))
    assert billing.apply_late_fee_for_lease(session, lease, d("2026-10-06")) is False  # still within grace
    assert billing.apply_late_fee_for_lease(session, lease, d("2026-10-07")) is True
    assert billing.apply_late_fee_for_lease(session, lease, d("2026-10-08")) is False  # already charged
    session.commit()
    fees = session.exec(select(LedgerEntry).where(LedgerEntry.lease_id == lease.id, LedgerEntry.entry_type == "late_fee")).all()
    assert [f.amount_cents for f in fees] == [7500]


def test_no_late_fee_when_paid(session):
    c, _, _, lease_json = _setup(charges_start_on="2026-10-01", late_fee_type="percent", late_fee_amount=500)
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    owed = billing.lease_balance(session, lease.id)
    c.post(f"/api/leases/{lease.id}/payments", json={"amount_cents": owed, "method": "zelle", "received_on": "2026-10-02"})
    session.expire_all()
    assert billing.apply_late_fee_for_lease(session, lease, d("2026-10-17")) is False


def test_percent_late_fee_amount():
    lease = Lease(org_id=uuid.uuid4(), unit_id=uuid.uuid4(), start_date=d("2026-01-01"), rent_cents=200000,
                  late_fee_type="percent", late_fee_amount=500, charges_start_on=d("2026-01-01"))
    assert billing.late_fee_amount(lease) == 10000


def test_payment_reduces_balance_and_void_restores(outbox):
    c, _, t, lease = _setup(charges_start_on="2026-10-01")
    before = c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    r = c.post(
        f"/api/leases/{lease['id']}/payments",
        json={"amount_cents": 100000, "method": "check", "received_on": "2026-10-03", "reference": "#1042"},
    )
    assert r.status_code == 201
    pay = r.json()
    assert pay["balance_cents"] == before - 100000
    assert pay["receipt_number"].startswith("R-2026-")
    assert pay["receipt_sent"] is True
    assert outbox[-1]["to"] == ["tina@example.com"]
    assert outbox[-1]["attachments"][0]["filename"].endswith(".pdf")
    pdf = c.get(f"/api/payments/{pay['id']}/receipt.pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert c.post(f"/api/payments/{pay['id']}/void").status_code == 200
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before


def test_ledger_running_balance_and_opening_balance():
    c, _, _, lease = _setup(charges_start_on="2026-10-01", opening_balance_cents=25000)
    c.post(f"/api/leases/{lease['id']}/ledger", json={"entry_type": "credit", "description": "Repair credit", "amount_cents": 10000, "entry_date": "2026-10-05"})
    rows = c.get(f"/api/leases/{lease['id']}/ledger").json()
    assert rows[0]["entry_type"] == "opening_balance"
    assert rows[-1]["balance_cents"] == sum(r["amount_cents"] for r in rows)
    credit = next(r for r in rows if r["entry_type"] == "credit")
    assert credit["amount_cents"] == -10000


def test_deleting_auto_rent_creates_reversal_not_repost(session):
    c, _, _, lease = _setup(charges_start_on="2026-10-01")
    rows = c.get(f"/api/leases/{lease['id']}/ledger").json()
    rent = next(r for r in rows if r["entry_type"] == "rent")
    assert c.delete(f"/api/leases/{lease['id']}/ledger/{rent['id']}").status_code == 200
    lease_obj = session.get(Lease, uuid.UUID(lease["id"]))
    billing.post_rent_for_lease(session, lease_obj, d("2026-10-17"))
    session.commit()
    rows = c.get(f"/api/leases/{lease['id']}/ledger").json()
    assert sum(r["amount_cents"] for r in rows if r["period"] == "2026-10" or r["entry_type"] == "adjustment") == 0


def test_cron_requires_secret_and_is_idempotent():
    _setup(charges_start_on="2026-10-01")
    c = new_client()
    assert c.get("/api/cron/daily").status_code == 401
    assert c.get("/api/cron/daily", headers={"Authorization": "Bearer wrong"}).status_code == 401
    ok = c.get("/api/cron/daily", headers={"Authorization": "Bearer test-cron-secret"})
    assert ok.status_code == 200
    again = c.get("/api/cron/daily", headers={"Authorization": "Bearer test-cron-secret"}).json()
    stats = next(iter(again["results"].values()))
    assert stats["rent_entries"] == 0 and stats["late_fees"] == 0


def test_rent_reminders_dedupe(session, outbox):
    c, _, _, lease_json = _setup(charges_start_on="2026-10-01")
    org = session.exec(select(Organization)).first()
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    billing.post_rent_for_lease(session, lease, d("2026-10-17"))
    session.commit()
    # Pay October so only the November reminders apply
    c.post(f"/api/leases/{lease.id}/payments", json={"amount_cents": billing.lease_balance(session, lease.id), "method": "cash", "received_on": "2026-10-02", "send_receipt": False})
    outbox.clear()
    # 3 days before Nov 1 → "upcoming"
    assert jobs.rent_reminders(session, org, lease, d("2026-10-29")) == 1
    assert jobs.rent_reminders(session, org, lease, d("2026-10-30")) == 0
    billing.post_rent_for_lease(session, lease, d("2026-11-01"))
    session.commit()
    assert jobs.rent_reminders(session, org, lease, d("2026-11-01")) == 1  # due today, unpaid
    assert jobs.rent_reminders(session, org, lease, d("2026-11-10")) == 1  # overdue after grace
    assert jobs.rent_reminders(session, org, lease, d("2026-11-11")) == 0
    subjects = [m["subject"] for m in outbox]
    assert any("due Nov 01" in s for s in subjects) and any("overdue" in s for s in subjects)


def test_lease_expiry_alerts(session, outbox):
    _, _, _, lease_json = _setup(charges_start_on="2026-10-01", end_date="2026-12-31")
    org = session.exec(select(Organization)).first()
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    outbox.clear()
    assert jobs.lease_expiry_alerts(session, org, lease, d("2026-10-05")) == 1  # 87 days → 90 threshold
    assert jobs.lease_expiry_alerts(session, org, lease, d("2026-10-06")) == 0
    assert jobs.lease_expiry_alerts(session, org, lease, d("2026-11-05")) == 1  # 56 days → 60
    assert jobs.lease_expiry_alerts(session, org, lease, d("2026-12-02")) == 1  # 29 days → 30
    assert outbox[0]["to"] == ["owner@example.com"]


def test_notification_prefs_respected(session, outbox):
    c, _, _, lease_json = _setup(charges_start_on="2026-10-01", end_date="2026-12-31")
    prefs = c.get("/api/org/notification-preferences").json()
    prefs["lease_expiry"] = False
    c.put("/api/org/notification-preferences", json=prefs)
    org = session.exec(select(Organization)).first()
    lease = session.get(Lease, uuid.UUID(lease_json["id"]))
    assert jobs.lease_expiry_alerts(session, org, lease, d("2026-10-05")) == 0
