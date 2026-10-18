"""Iteration 18: mobile sign-in with bearer tokens, push device registration and push notifications."""
import pyotp

from tests.helpers import PASSWORD, make_lease, make_property, make_tenant, new_client, register

TOKEN = "ExponentPushToken[abc123DEF456]"


def _bearer(email: str, password: str = PASSWORD):
    c = new_client()
    r = c.post("/api/auth/token", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body and not r.cookies.get("pp_session")
    c.headers["Authorization"] = f"Bearer {body['access_token']}"
    c.headers["X-Org-Id"] = body["me"]["organizations"][0]["id"]
    return c, body


def test_token_login_works_without_cookies():
    register()
    assert new_client().post("/api/auth/token", json={"email": "owner@example.com", "password": "wrong"}).status_code == 401
    c, body = _bearer("owner@example.com")
    assert body["me"]["email"] == "owner@example.com"
    assert c.get("/api/auth/me").status_code == 200
    assert c.get("/api/properties").status_code == 200
    # Signing out anywhere invalidates the token.
    c.post("/api/auth/logout")
    assert c.get("/api/auth/me").status_code == 401


def test_token_login_with_2fa():
    owner, _ = register()
    setup = owner.post("/api/auth/mfa/setup").json()
    owner.post("/api/auth/mfa/enable", json={"code": pyotp.TOTP(setup["secret"]).now()})
    r = new_client().post("/api/auth/token", json={"email": "owner@example.com", "password": PASSWORD}).json()
    assert r["mfa_required"] and "access_token" not in r
    # The 2FA token is not a session.
    assert new_client().get("/api/auth/me", headers={"Authorization": f"Bearer {r['mfa_token']}"}).status_code == 401
    ok = new_client().post("/api/auth/token/mfa", json={"mfa_token": r["mfa_token"], "code": pyotp.TOTP(setup["secret"]).now()})
    assert ok.status_code == 200 and ok.json()["access_token"]


def test_push_devices_and_notifications(push_outbox):
    owner, _ = register()
    prop = make_property(owner)
    t = make_tenant(owner)
    make_lease(owner, prop["units"][0]["id"], [t["id"]])
    inv = owner.post(f"/api/tenants/{t['id']}/invite").json()
    new_client().post("/api/auth/invitations/accept", json={"token": inv["invite_url"].split("token=")[1], "name": "Tina Tenant", "password": PASSWORD})

    staff, _ = _bearer("owner@example.com")
    tenant, _ = _bearer("tina@example.com")
    assert staff.post("/api/auth/devices", json={"token": "not-a-token"}).status_code == 422
    assert staff.post("/api/auth/devices", json={"token": TOKEN, "platform": "ios"}).status_code == 201
    tenant.post("/api/auth/devices", json={"token": "ExponentPushToken[tenantPhone1]", "platform": "android"})

    # Tenant submits a request → staff phone gets a push.
    r = tenant.post("/api/portal/work-orders", json={"title": "Leaking tap", "category": "plumbing"})
    assert r.status_code == 201, r.text
    assert any(m["to"] == TOKEN and "Leaking tap" in m["body"] for m in push_outbox)
    # Staff updates it → tenant phone gets a push.
    staff.patch(f"/api/work-orders/{r.json()['id']}", json={"status": "in_progress"})
    assert any(m["to"] == "ExponentPushToken[tenantPhone1]" and m["data"]["type"] == "portal_work_order" for m in push_outbox)
    # Messages both ways.
    th = staff.post("/api/messages/threads", json={"tenant_id": t["id"], "subject": "Hello", "body": "Welcome!"}).json()
    assert any(m["to"] == "ExponentPushToken[tenantPhone1]" and m["data"] == {"type": "portal_thread", "id": th["id"]} for m in push_outbox)
    # Same token re-registered by another user moves to them; unregister removes it.
    tenant.post("/api/auth/devices", json={"token": TOKEN, "platform": "ios"})
    push_outbox.clear()
    staff.post(f"/api/messages/threads/{th['id']}", json={"body": "Another"})
    assert {m["to"] for m in push_outbox} == {TOKEN, "ExponentPushToken[tenantPhone1]"}
    tenant.post("/api/auth/devices/unregister", json={"token": TOKEN, "platform": "ios"})
    push_outbox.clear()
    staff.post(f"/api/messages/threads/{th['id']}", json={"body": "Third"})
    assert {m["to"] for m in push_outbox} == {"ExponentPushToken[tenantPhone1]"}
