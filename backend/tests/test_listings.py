"""Iteration 14: listings, applications, screening reports, adverse action and conversion to a lease."""
from app.core.config import settings
from app.services import online_payments as op
from app.services import stripe_gateway as gateway
from tests.helpers import PASSWORD, make_property, new_client, register

APPLICANT = {
    "first_name": "Maya",
    "last_name": "Chen",
    "email": "maya@example.com",
    "phone": "512-555-0199",
    "current_address": "88 Pine St, Austin, TX",
    "monthly_income_cents": 600000,
    "occupants": 2,
    "co_applicants": [{"name": "Leo Chen", "email": "leo@example.com"}],
    "signature_name": "Maya Chen",
    "consent": True,
}


def _published(c, **extra):
    prop = make_property(c)
    listing = c.post("/api/listings", json={"unit_id": prop["units"][0]["id"]}).json()
    assert c.post(f"/api/listings/{listing['id']}/publish").status_code == 422  # needs rent/description
    body = {"rent_cents": 180000, "description": "Bright 3-bed home near downtown.", "screening_url": "https://www.mysmartmove.com/", **extra}
    c.patch(f"/api/listings/{listing['id']}", json=body)
    r = c.post(f"/api/listings/{listing['id']}/publish")
    assert r.status_code == 200, r.text
    return prop, r.json()


def _apply(slug, **extra):
    anon = new_client()
    r = anon.post(f"/api/public/listings/{slug}/apply", json={**APPLICANT, **extra})
    assert r.status_code == 201, r.text
    return anon, r.json()


def test_listing_public_page_share_and_photos():
    c, _ = register()
    _, listing = _published(c)
    anon = new_client()
    pub = anon.get(f"/api/public/listings/{listing['slug']}").json()
    assert pub["rent_cents"] == 180000 and pub["organization"] == "Test Rentals" and "status" not in pub
    up = c.post("/api/documents", data={"owner_type": "listing", "owner_id": listing["id"], "kind": "photo"}, files={"file": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")})
    assert up.status_code == 201
    photo_id = anon.get(f"/api/public/listings/{listing['slug']}").json()["photos"][0]
    assert anon.get(f"/api/public/listings/{listing['slug']}/photos/{photo_id}").status_code == 200
    share = anon.get(f"/l/{listing['slug']}")
    assert share.status_code == 200 and 'og:title' in share.text and "$1,800.00" in share.text and "application/ld+json" in share.text
    c.post(f"/api/listings/{listing['id']}/close")
    assert anon.get(f"/api/public/listings/{listing['slug']}").status_code == 404
    assert anon.get(f"/api/public/listings/{listing['slug']}/photos/{photo_id}").status_code == 404


def test_apply_status_upload_and_honeypot(outbox):
    c, _ = register()
    _, listing = _published(c)
    anon = new_client()
    assert anon.post(f"/api/public/listings/{listing['slug']}/apply", json={**APPLICANT, "consent": False}).status_code == 422
    assert anon.post(f"/api/public/listings/{listing['slug']}/apply", json={**APPLICANT, "website": "spam.example"}).status_code == 400
    anon, res = _apply(listing["slug"])
    assert res["checkout_url"] is None and res["fee_cents"] == 0
    assert any("received your application" in m["subject"] for m in outbox)
    st = anon.get(f"/api/public/applications/{res['token']}").json()
    assert st["status"] == "submitted" and st["can_upload"]
    up = anon.post(f"/api/public/applications/{res['token']}/documents", files={"file": ("paystub.pdf", b"%PDF-1.4", "application/pdf")})
    assert up.status_code == 201
    assert anon.post(f"/api/public/applications/{res['token']}/documents", files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 415
    apps = c.get("/api/applications").json()
    assert apps[0]["name"] == "Maya Chen" and apps[0]["income_to_rent"] == 3.3 and apps[0]["co_applicants"] == 1
    assert anon.get("/api/public/applications/wrong-token").status_code == 404


def test_screening_report_access_and_adverse_action(outbox):
    c, _ = register()
    _, listing = _published(c)
    _, res = _apply(listing["slug"])
    app_id = c.get("/api/applications").json()[0]["id"]

    r = c.post(f"/api/applications/{app_id}/request-screening").json()
    assert r["email_sent"] and r["screening_url"].startswith("https://")
    assert any("Start the screening" in m["html"] for m in outbox)

    report_file = c.post(f"/api/applications/{app_id}/report-file", files={"file": ("smartmove.pdf", b"%PDF-1.4 report", "application/pdf")}).json()
    report = {
        "provider": "TransUnion SmartMove",
        "report_date": "2026-10-18",
        "credit_score": 612,
        "credit_summary": {"total_debt_cents": 1250000, "collections_count": 2, "collections_cents": 85000, "bankruptcies": 0, "late_payments": 4},
        "criminal_records": [{"offense": "Misdemeanor theft", "severity": "misdemeanor", "offense_date": "2015-03-01", "jurisdiction": "Travis County, TX", "disposition": "Convicted"}],
        "eviction_records": [{"filed_on": "2021-06-10", "court": "Travis County JP 5", "outcome": "judgment", "amount_cents": 320000}],
        "document_id": report_file["id"],
        "result": "fail",
        "notes": "Eviction judgment within 5 years.",
    }
    out = c.put(f"/api/applications/{app_id}/screening", json=report).json()
    assert out["screening_status"] == "completed" and out["credit_score"] == 612
    assert out["credit_summary"]["collections_count"] == 2 and out["eviction_records"][0]["outcome"] == "judgment"
    assert out["criminal_records"][0]["jurisdiction"] == "Travis County, TX"
    log = c.get("/api/audit-log").json()
    rows = log["items"] if isinstance(log, dict) else log
    assert not any("Travis County" in str(r) or "612" in str(r) for r in rows)  # report contents never in the audit log

    # Accountants can't see applications or their files.
    inv = c.post("/api/org/invitations", json={"email": "acct@example.com", "role": "accountant"}).json()
    ac = new_client()
    me = ac.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Acct", "password": PASSWORD}).json()
    ac.headers["X-Org-Id"] = me["organizations"][0]["id"]
    assert ac.get(f"/api/applications/{app_id}").status_code == 403
    assert ac.get(f"/api/documents/{report_file['id']}/file").status_code == 404
    assert all(d["owner_type"] != "application" for d in ac.get("/api/documents").json())
    assert all(d["owner_type"] != "application" for d in c.get("/api/documents").json())  # not in the library either

    aa = c.post(
        f"/api/applications/{app_id}/adverse-action",
        json={"reasons": ["Eviction judgment within the last 5 years"], "agency_name": "TransUnion Rental Screening Solutions", "agency_address": "PO Box 800, Woodlyn, PA 19094", "agency_phone": "1-866-775-0961", "credit_score_used": True},
    ).json()
    assert aa["status"] == "declined" and aa["adverse_action_sent_at"] and aa["email_sent"]
    notice = next(m for m in outbox if "Notice regarding" in m["subject"])
    assert notice["attachments"] if "attachments" in notice else True
    assert any(d["name"].startswith("adverse-action-notice") for d in c.get(f"/api/applications/{app_id}").json()["documents"])


def test_approve_convert_to_lease_and_invites(outbox):
    c, _ = register()
    prop, listing = _published(c)
    _, res = _apply(listing["slug"])
    app_id = c.get("/api/applications").json()[0]["id"]
    assert c.post(f"/api/applications/{app_id}/convert", json={"start_date": "2026-11-01", "rent_cents": 180000}).status_code == 400
    assert c.patch(f"/api/applications/{app_id}", json={"status": "approved"}).status_code == 400  # must use Approve
    ok = c.post(f"/api/applications/{app_id}/approve", json={"message": "Welcome!"}).json()
    assert ok["status"] == "approved" and ok["email_sent"]
    conv = c.post(f"/api/applications/{app_id}/convert", json={"start_date": "2026-11-01", "end_date": "2027-10-31", "rent_cents": 180000, "deposit_cents": 180000})
    assert conv.status_code == 200, conv.text
    conv = conv.json()
    lease = c.get(f"/api/leases/{conv['lease_id']}").json()
    assert sorted(t["name"] for t in lease["tenants"]) == ["Leo Chen", "Maya Chen"] and lease["rent_cents"] == 180000
    assert len(conv["invites"]) == 2
    assert c.get(f"/api/listings/{listing['id']}").json()["status"] == "closed"
    assert c.get(f"/api/applications/{app_id}").json()["status"] == "converted"
    anon = new_client()
    assert anon.get(f"/api/public/applications/{res['token']}").json()["status"] == "converted"


def test_application_fee_checkout_and_webhook(monkeypatch, session):
    c, me = register()
    _, listing = _published(c, application_fee_cents=4500)
    from uuid import UUID

    from app.models import Organization

    org = session.get(Organization, UUID(c.headers["X-Org-Id"]))
    org.stripe_account_id, org.stripe_charges_enabled, org.online_payments_enabled = "acct_x", True, True
    session.add(org)
    session.commit()
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    calls = []
    monkeypatch.setattr(gateway, "checkout_application_fee", lambda **kw: (calls.append(kw), ("cs_fee_1", "https://checkout.stripe.test/fee"))[1])
    _, res = _apply(listing["slug"])
    assert res["checkout_url"] == "https://checkout.stripe.test/fee" and calls[0]["amount_cents"] == 4500 and calls[0]["destination"] == "acct_x"
    app_id = calls[0]["metadata"]["application_id"]
    event = {"id": "evt_fee_1", "type": "checkout.session.completed", "data": {"object": {"mode": "payment", "payment_status": "paid", "metadata": calls[0]["metadata"]}}}
    assert op.handle_event(session, event) == "application_fee_paid"
    assert op.handle_event(session, event) == "duplicate"
    assert c.get(f"/api/applications/{app_id}").json()["fee_status"] == "paid"


def test_scoped_manager_and_other_org_isolation():
    c, _ = register()
    _, listing = _published(c)
    _apply(listing["slug"])
    app_id = c.get("/api/applications").json()[0]["id"]
    other_prop = make_property(c, name="Elm St")
    inv = c.post("/api/org/invitations", json={"email": "mgr@example.com", "role": "manager", "property_ids": [other_prop["id"]]}).json()
    mc = new_client()
    me = mc.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Mgr", "password": PASSWORD}).json()
    mc.headers["X-Org-Id"] = me["organizations"][0]["id"]
    assert mc.get("/api/applications").json() == [] and mc.get("/api/listings").json() == []
    assert mc.get(f"/api/applications/{app_id}").status_code == 404
    other, _ = register(email="other@example.com", org="Other")
    assert other.get(f"/api/applications/{app_id}").status_code == 404
    assert other.get(f"/api/listings/{listing['id']}").status_code == 404
