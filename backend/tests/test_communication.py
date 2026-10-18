"""Iteration 15: messages, announcements, notices, move-out notices, renter's insurance and SMS."""
import base64
import hashlib
import hmac
from datetime import date, timedelta
from uuid import UUID

from app.core.config import settings
from app.models import Organization
from app.services import jobs
from app.services.sms import normalize_phone
from tests.helpers import PASSWORD, d, make_lease, make_property, make_tenant, new_client, register


def _setup():
    c, me = register()
    prop = make_property(c)
    t = make_tenant(c)
    c.patch(f"/api/tenants/{t['id']}", json={"phone": "(602) 555-0110"})
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]], end_date="2026-12-31")
    inv = c.post(f"/api/tenants/{t['id']}/invite").json()
    tc = new_client()
    r = tc.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Tina Tenant", "password": PASSWORD})
    tc.headers["X-Org-Id"] = r.json()["organizations"][0]["id"]
    return c, tc, prop, t, lease


def test_normalize_phone():
    assert normalize_phone("(602) 555-0110") == "+16025550110"
    assert normalize_phone("1-602-555-0110") == "+16025550110"
    assert normalize_phone("+44 20 7946 0958") == "+442079460958"
    assert normalize_phone("12345") is None


def test_threads_unread_and_notifications(outbox):
    c, tc, _, t, _ = _setup()
    th = c.post("/api/messages/threads", json={"tenant_id": t["id"], "subject": "Gutter cleaning", "body": "We'll clean the gutters Friday."}).json()
    assert th["delivered"]["email"] and th["property_name"] == "Oak St"
    assert any("Gutter cleaning" in m["subject"] for m in outbox)
    mine = tc.get("/api/portal/messages").json()
    assert mine[0]["unread"] is True
    tc.get(f"/api/portal/messages/{th['id']}")
    assert tc.get("/api/portal/messages").json()[0]["unread"] is False
    tc.post(f"/api/portal/messages/{th['id']}", json={"body": "Thanks! Gate code is the same."})
    assert c.get("/api/messages/unread-count").json()["count"] == 1
    full = c.get(f"/api/messages/threads/{th['id']}").json()
    assert [m["author_role"] for m in full["messages"]] == ["staff", "tenant"]
    assert c.get("/api/messages/unread-count").json()["count"] == 0
    new = tc.post("/api/portal/messages", json={"subject": "Parking", "body": "Can I use the second spot?"}).json()
    assert len(c.get("/api/messages/threads").json()) == 2
    c.patch(f"/api/messages/threads/{new['id']}", json={"archived": True})
    assert len(c.get("/api/messages/threads").json()) == 1
    other, _ = register(email="other@example.com", org="Other")
    assert other.get(f"/api/messages/threads/{th['id']}").status_code == 404


def test_announcement_email_and_sms(outbox, sms_outbox):
    c, tc, prop, t, _ = _setup()
    assert tc.get("/api/portal/sms").json()["opt_in"] is False
    assert tc.put("/api/portal/sms", json={"opt_in": True, "phone": "abc"}).status_code == 422
    assert tc.put("/api/portal/sms", json={"opt_in": True}).json()["opt_in"] is True
    assert sms_outbox[-1]["to"] == "+16025550110" and "STOP" in sms_outbox[-1]["body"]
    a = c.post("/api/announcements", json={"property_id": prop["id"], "title": "Water shut-off Tuesday", "body": "9am–1pm for a pipe repair.", "send_sms": True}).json()
    assert a["tenant_count"] == 1 and a["email_count"] == 1 and a["sms_count"] == 1
    assert "Water shut-off" in sms_outbox[-1]["body"]
    assert tc.get("/api/portal/announcements").json()[0]["title"] == "Water shut-off Tuesday"


def test_notices_render_pdf_and_portal(outbox):
    c, tc, _, _, lease = _setup()
    tpl = c.get("/api/notice-templates").json()
    assert set(tpl["templates"]) == {"rent_increase", "entry", "violation", "pay_or_quit", "general"}
    pre = c.post(f"/api/leases/{lease['id']}/notices/preview", json={"kind": "rent_increase", "new_rent_cents": 160000, "effective_date": "2027-01-01"}).json()
    assert "$1,600.00" in pre["body"] and "January 1, 2027" in pre["body"] and "Tina Tenant" in pre["body"]
    bad = c.post(f"/api/leases/{lease['id']}/notices/preview", json={"kind": "general", "body": "Hi {{nope}}"})
    assert bad.status_code == 422
    pq = c.post(f"/api/leases/{lease['id']}/notices/preview", json={"kind": "pay_or_quit"}).json()
    assert "3 days" in pq["body"]
    n = c.post(f"/api/leases/{lease['id']}/notices", json={"kind": "entry", "title": "Notice of entry", "entry_date": "2026-11-03", "entry_window": "9am-12pm", "entry_reason": "smoke detector test"}).json()
    assert n["emailed_to"] == ["tina@example.com"] and n["document_id"]
    msg = next(m for m in outbox if "Notice of entry" in m["subject"])
    assert msg["attachments"][0]["filename"].endswith(".pdf")
    assert c.get(f"/api/documents/{n['document_id']}/file").content[:4] == b"%PDF"
    portal = tc.get("/api/portal/notices").json()
    assert portal[0]["title"] == "Notice of entry"
    assert c.get(f"/api/leases/{lease['id']}/notices").json()[0]["viewed_at"]


def test_move_out_notice_and_acknowledge(outbox):
    c, tc, _, _, lease = _setup()
    assert tc.post(f"/api/portal/leases/{lease['id']}/move-out", json={"move_out_date": "2020-01-01"}).status_code == 422
    future = (date.today() + timedelta(days=45)).isoformat()
    n = tc.post(f"/api/portal/leases/{lease['id']}/move-out", json={"move_out_date": future, "forwarding_address": "9 New St", "reason": "Buying a house"})
    assert n.status_code == 201, n.text
    assert tc.post(f"/api/portal/leases/{lease['id']}/move-out", json={"move_out_date": future}).status_code == 409
    assert any("Move-out notice" in m["subject"] for m in outbox)
    staff_view = c.get(f"/api/leases/{lease['id']}/move-out-notices").json()
    assert staff_view[0]["tenant_name"] == "Tina Tenant" and staff_view[0]["status"] == "submitted"
    ack = c.post(f"/api/move-out-notices/{staff_view[0]['id']}/acknowledge", json={"set_lease_end": True}).json()
    assert ack["status"] == "acknowledged"
    assert c.get(f"/api/leases/{lease['id']}").json()["end_date"] == future
    assert tc.post(f"/api/portal/move-out/{ack['id']}/withdraw").status_code == 400


def test_renters_insurance_upload_status_and_reminder(session, outbox):
    c, tc, _, _, lease = _setup()
    assert c.get(f"/api/leases/{lease['id']}/insurance").json()[0]["status"] == "missing"
    soon = (date.today() + timedelta(days=10)).isoformat()
    up = tc.post("/api/portal/insurance", data={"expires_on": soon, "provider": "Lemonade"}, files={"file": ("policy.pdf", b"%PDF-1.4", "application/pdf")})
    assert up.status_code == 201, up.text
    assert "Lemonade" in up.json()["name"]
    assert c.get(f"/api/leases/{lease['id']}/insurance").json()[0]["status"] == "expiring"
    assert tc.get("/api/portal/insurance").json()[0]["expires_on"] == soon
    org = session.get(Organization, UUID(c.headers["X-Org-Id"]))
    stats = jobs.run_daily_for_org(session, org, today=date.today())
    assert stats["insurance_reminders"] == 1
    assert jobs.run_daily_for_org(session, org, today=date.today())["insurance_reminders"] == 0


def test_twilio_inbound_signature_stop_and_reply(monkeypatch, sms_outbox):
    c, tc, _, t, _ = _setup()
    tc.put("/api/portal/sms", json={"opt_in": True})
    monkeypatch.setattr(settings, "twilio_account_sid", "AC123")
    monkeypatch.setattr(settings, "twilio_auth_token", "secret-token")
    monkeypatch.setattr(settings, "twilio_from_number", "+16025550100")
    url = f"{settings.frontend_url}/api/twilio/inbound"

    def signed(params):
        payload = url + "".join(f"{k}{params[k]}" for k in sorted(params))
        return base64.b64encode(hmac.new(b"secret-token", payload.encode(), hashlib.sha1).digest()).decode()

    anon = new_client()
    params = {"From": "+16025550110", "Body": "The dishwasher is leaking"}
    assert anon.post("/api/twilio/inbound", data=params, headers={"X-Twilio-Signature": "bad"}).status_code == 403
    r = anon.post("/api/twilio/inbound", data=params, headers={"X-Twilio-Signature": signed(params)})
    assert r.status_code == 200 and "<Response/>" in r.text
    threads = c.get("/api/messages/threads").json()
    assert threads[0]["preview"] == "The dishwasher is leaking" and threads[0]["unread"]
    stop = {"From": "+16025550110", "Body": "STOP"}
    anon.post("/api/twilio/inbound", data=stop, headers={"X-Twilio-Signature": signed(stop)})
    assert tc.get("/api/portal/sms").json()["opt_in"] is False
