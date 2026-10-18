"""Iteration 12: lease templates, e-signature, renewals, inspections and deposit statements."""
import base64
import io
import re
from uuid import UUID

from PIL import Image
from sqlmodel import select

from app.models import Lease, RenewalOffer
from app.services import jobs
from app.services import leasing as L
from tests.helpers import PASSWORD, d, make_lease, make_property, make_tenant, new_client, register


def _setup(**lease_overrides):
    c, me = register()
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]], end_date="2026-12-31", **lease_overrides)
    return c, me, prop, t, lease


def _png() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (300, 100), "white").save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _tenant_client(c, t):
    inv = c.post(f"/api/tenants/{t['id']}/invite").json()
    tc = new_client()
    r = tc.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Tina Tenant", "password": PASSWORD})
    assert r.status_code == 200, r.text
    tc.headers["X-Org-Id"] = r.json()["organizations"][0]["id"]
    return tc


def _sign_token(outbox) -> str:
    for msg in reversed(outbox):
        m = re.search(r"/sign/([A-Za-z0-9_\-]+)", msg["html"])
        if m:
            return m.group(1)
    raise AssertionError("no signing link emailed")


# ── Templates ────────────────────────────────────────────────────────────────


def test_template_starter_render_and_unknown_fields():
    c, _, _, _, lease = _setup()
    tpl = c.post("/api/lease-templates", json={"name": "Standard"}).json()
    assert "{{monthly_rent}}" in tpl["body"]
    r = c.post(f"/api/leases/{lease['id']}/render", json={"template_id": tpl["id"]}).json()
    assert "$1,500.00" in r["body"] and "Tina Tenant" in r["body"] and "{{" not in r["body"]
    assert "from January 1, 2026 to December 31, 2026" in r["body"]

    bad = c.post("/api/lease-templates", json={"name": "Bad", "body": "Rent {{montly_rent}}"})
    assert bad.status_code == 422 and "montly_rent" in bad.json()["detail"]
    assert c.patch(f"/api/lease-templates/{tpl['id']}", json={"body": "Hi {{tenant_names}}"}).status_code == 200
    assert len(c.get("/api/lease-templates/fields").json()) == len(L.MERGE_FIELDS)


# ── E-signature ──────────────────────────────────────────────────────────────


def test_signature_flow_tenant_link_then_landlord(outbox):
    c, me, _, _, lease = _setup()
    tpl = c.post("/api/lease-templates", json={"name": "Standard"}).json()
    req = c.post(f"/api/leases/{lease['id']}/signature-requests", json={"title": "Lease 2026", "template_id": tpl["id"]})
    assert req.status_code == 201, req.text
    req = req.json()
    assert len(req["signers"]) == 2 and req["links"][0]["url"].startswith("http")
    token = _sign_token(outbox)

    anon = new_client()
    view = anon.get(f"/api/sign/{token}").json()
    assert view["request"]["title"] == "Lease 2026" and "$1,500.00" in view["request"]["body"]
    assert anon.post(f"/api/sign/{token}", json={"signature_name": "Tina Tenant", "consent": False}).status_code == 422
    r = anon.post(f"/api/sign/{token}", json={"signature_name": "Tina Tenant", "signature_image": _png(), "consent": True})
    assert r.status_code == 200, r.text
    # The link is single-use.
    assert anon.get(f"/api/sign/{token}").status_code == 404

    status = c.get(f"/api/signature-requests/{req['id']}").json()
    assert status["status"] == "sent"
    done = c.post(f"/api/signature-requests/{req['id']}/sign", json={"signature_name": me["name"], "consent": True}).json()
    assert done["status"] == "completed" and done["document_id"]
    docs = c.get(f"/api/documents?owner_type=lease&owner_id={lease['id']}").json()
    signed = next(x for x in docs if x["id"] == done["document_id"])
    assert signed["visible_to_tenant"] and signed["content_type"] == "application/pdf"
    pdf = c.get(f"/api/documents/{signed['id']}/file")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert any("Signed: Lease 2026" in m["subject"] for m in outbox)


def test_signature_void_remind_and_bad_image(outbox):
    c, _, _, _, lease = _setup()
    req = c.post(f"/api/leases/{lease['id']}/signature-requests", json={"title": "Addendum", "body": "Pets allowed for {{tenant_names}}.", "landlord_signs": False}).json()
    first = _sign_token(outbox)
    links = c.post(f"/api/signature-requests/{req['id']}/remind").json()["links"]
    assert len(links) == 1
    anon = new_client()
    assert anon.get(f"/api/sign/{first}").status_code == 404  # replaced by the reminder link
    second = links[0]["url"].rsplit("/", 1)[1]
    bad = anon.post(f"/api/sign/{second}", json={"signature_name": "Tina", "signature_image": "data:image/png;base64,AAAA", "consent": True})
    assert bad.status_code == 422
    assert c.post(f"/api/signature-requests/{req['id']}/void").json()["status"] == "voided"
    assert anon.get(f"/api/sign/{second}").status_code == 404


def test_tenant_signs_in_portal(outbox):
    c, _, _, t, lease = _setup()
    tc = _tenant_client(c, t)
    c.post(f"/api/leases/{lease['id']}/signature-requests", json={"title": "Lease", "body": "Hello {{tenant_names}}", "landlord_signs": False})
    pending = tc.get("/api/portal/signatures").json()
    assert len(pending) == 1
    view = tc.get(f"/api/portal/signatures/{pending[0]['signer_id']}").json()
    assert view["request"]["body"] == "Hello Tina Tenant"
    done = tc.post(f"/api/portal/signatures/{pending[0]['signer_id']}/sign", json={"signature_name": "Tina Tenant", "consent": True}).json()
    assert done["request"]["status"] == "completed"
    assert tc.get("/api/portal/signatures").json() == []
    # Staff of another org can't see it.
    other, _ = register(email="other@example.com", org="Other")
    assert other.get(f"/api/signature-requests/{view['request']['id']}").status_code == 404


# ── Renewals ─────────────────────────────────────────────────────────────────


def test_renewal_accept_creates_lease_and_old_one_ends(session, outbox):
    c, _, prop, _, lease = _setup()
    c.post(f"/api/leases/{lease['id']}/charges", json={"charge_type": "parking", "description": "Parking", "amount_cents": 5000})
    bad = c.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 160000, "start_date": "2026-12-01", "respond_by": "2026-11-15"})
    assert bad.status_code == 422  # starts before the current lease ends
    offer = c.post(
        f"/api/leases/{lease['id']}/renewals",
        json={"rent_cents": 160000, "start_date": "2027-01-01", "end_date": "2027-12-31", "respond_by": "2026-12-15", "message": "Thanks!"},
    )
    assert offer.status_code == 201, offer.text
    offer = offer.json()
    assert any("renewal offer" in m["subject"].lower() for m in outbox)
    assert c.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 1, "start_date": "2027-01-01", "respond_by": "2026-12-15"}).status_code == 409

    accepted = c.post(f"/api/renewals/{offer['id']}/respond", json={"accept": True, "note": "By phone"}).json()
    assert accepted["status"] == "accepted" and accepted["new_lease_id"]
    new = c.get(f"/api/leases/{accepted['new_lease_id']}").json()
    assert new["rent_cents"] == 160000 and new["start_date"] == "2027-01-01" and new["tenants"][0]["name"] == "Tina Tenant"
    assert [x["description"] for x in new["recurring_charges"]] == ["Parking"]
    assert new["renewal_of_id"] == lease["id"]

    org = session.get(Lease, UUID(lease["id"])).org_id
    from app.models import Organization

    jobs.run_daily_for_org(session, session.get(Organization, org), today=d("2027-01-02"))
    session.expire_all()
    assert session.get(Lease, UUID(lease["id"])).status == "ended"
    assert c.get(f"/api/leases/{new['id']}/ledger").json()[0]["description"].startswith("Rent")


def test_renewal_month_to_month_decline_expire_and_portal(session):
    c, _, _, t, lease = _setup()
    tc = _tenant_client(c, t)

    offer = c.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 155000, "start_date": "2027-01-01", "respond_by": "2026-12-01"}).json()
    seen = tc.get(f"/api/portal/leases/{lease['id']}/renewal").json()
    assert seen["id"] == offer["id"] and "created_by_user_id" not in seen
    declined = tc.post(f"/api/portal/renewals/{offer['id']}/respond", json={"accept": False, "note": "Moving"}).json()
    assert declined["status"] == "declined"

    offer2 = c.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 150000, "start_date": "2027-01-01", "respond_by": "2026-12-01"}).json()
    from app.models import Organization

    jobs.run_daily_for_org(session, session.get(Organization, session.get(Lease, UUID(lease["id"])).org_id), today=d("2026-12-05"))
    session.expire_all()
    assert session.get(RenewalOffer, UUID(offer2["id"])).status == "expired"
    assert tc.post(f"/api/portal/renewals/{offer2['id']}/respond", json={"accept": True}).status_code == 400


def test_month_to_month_renewal_sets_old_end_date():
    c, me = register()
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]])  # month-to-month
    offer = c.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 150000, "start_date": "2027-03-01", "end_date": "2028-02-29", "respond_by": "2027-02-01"}).json()
    c.post(f"/api/renewals/{offer['id']}/respond", json={"accept": True})
    assert c.get(f"/api/leases/{lease['id']}").json()["end_date"] == "2027-02-28"


# ── Inspections & deposit ────────────────────────────────────────────────────


def test_inspections_and_deposit_statement(outbox):
    c, _, prop, _, lease = _setup()
    mi = c.post(f"/api/leases/{lease['id']}/inspections", json={"kind": "move_in", "inspected_on": "2026-01-01"})
    assert mi.status_code == 201, mi.text
    mi = mi.json()
    assert len(mi["items"]) > 20 and mi["items"][0]["area"] == "Entry & living room"
    items = mi["items"]
    items[0].update(condition="good", notes="Fresh paint")
    c.patch(f"/api/inspections/{mi['id']}", json={"items": items})
    buf = io.BytesIO()
    Image.new("RGB", (80, 60), "blue").save(buf, "JPEG")
    up = c.post(f"/api/inspections/{mi['id']}/photos", data={"item_id": items[0]["id"]}, files={"file": ("wall.jpg", buf.getvalue(), "image/jpeg")})
    assert up.status_code == 201, up.text
    assert len(up.json()["items"][0]["photo_ids"]) == 1
    # Photo ids can't be injected through PATCH.
    items = up.json()["items"]
    items[1]["photo_ids"] = ["00000000-0000-0000-0000-000000000000"]
    assert c.patch(f"/api/inspections/{mi['id']}", json={"items": items}).json()["items"][1]["photo_ids"] == []
    done = c.post(f"/api/inspections/{mi['id']}/complete", json={"share_with_tenant": True}).json()
    assert done["status"] == "completed" and done["document_id"]
    assert c.patch(f"/api/inspections/{mi['id']}", json={"notes": "x"}).status_code == 400

    mo = c.post(f"/api/leases/{lease['id']}/inspections", json={"kind": "move_out", "inspected_on": "2026-12-31"}).json()
    assert len(mo["items"]) == len(mi["items"])
    assert mo["baseline"]["Entry & living room|Walls & paint"]["condition"] == "good"
    mo_items = mo["items"]
    mo_items[0].update(condition="damaged", notes="Hole in wall")
    c.patch(f"/api/inspections/{mo['id']}", json={"items": mo_items})
    c.post(f"/api/inspections/{mo['id']}/complete", json={})

    draft = c.get(f"/api/leases/{lease['id']}/deposit").json()
    assert draft["saved"] is False and draft["deposit_cents"] == 150000
    assert draft["deductions"][0]["description"].startswith("Entry & living room - Walls & paint")
    assert draft["balance_applied_cents"] == 150000  # September+ rent unpaid, capped at the deposit

    saved = c.put(
        f"/api/leases/{lease['id']}/deposit",
        json={"deductions": [{"description": "Patch and paint wall", "amount_cents": 20000}], "balance_applied_cents": 50000, "forwarding_address": "9 New St"},
    ).json()
    assert saved["refund_cents"] == 80000
    before = c.get(f"/api/leases/{lease['id']}").json()["balance_cents"]
    assert c.get(f"/api/leases/{lease['id']}/deposit/preview.pdf").content[:4] == b"%PDF"
    sent = c.post(f"/api/leases/{lease['id']}/deposit/send").json()
    assert sent["status"] == "sent" and sent["document_id"]
    assert c.get(f"/api/leases/{lease['id']}").json()["balance_cents"] == before - 50000
    assert c.post(f"/api/leases/{lease['id']}/deposit/send").status_code == 400
    assert any("deposit statement" in m["subject"].lower() for m in outbox)


def test_pdf_handles_unicode_and_markdown():
    from app.models import Organization, SignatureRequest, Signer

    org = Organization(name="Muppaneni Portfolio — Rentals")
    body = "# Lease\n\n## 1. Rent\nRent is **$1,500** — due “1st”.\n- Item one\n- Item two\n\n---\n*Note: not legal advice*\nCafé résumé 日本"
    req = SignatureRequest(org_id=org.id, lease_id=org.id, title="Lease", body=body, content_hash="x" * 64)
    pdf = L.signed_pdf(org, req, [Signer(request_id=req.id, name="Ana", signature_name="Ana", signed_at=None)])
    assert pdf[:4] == b"%PDF"


def test_scoped_member_cannot_reach_other_property_workflows():
    c, _, prop, t, lease = _setup()
    other_prop = make_property(c, name="Elm St")
    inv = c.post("/api/org/invitations", json={"email": "mgr@example.com", "role": "manager", "property_ids": [other_prop["id"]]}).json()
    mc = new_client()
    me = mc.post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Mgr", "password": PASSWORD}).json()
    mc.headers["X-Org-Id"] = me["organizations"][0]["id"]
    assert mc.get(f"/api/leases/{lease['id']}/inspections").status_code == 404
    assert mc.get(f"/api/leases/{lease['id']}/deposit").status_code == 404
    assert mc.post(f"/api/leases/{lease['id']}/renewals", json={"rent_cents": 1, "start_date": "2027-01-01", "respond_by": "2026-12-01"}).status_code == 404
