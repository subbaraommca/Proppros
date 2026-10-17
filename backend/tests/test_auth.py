from tests.helpers import PASSWORD, make_property, new_client, register, token_from


def test_register_creates_owner_org_and_session():
    c, me = register()
    assert me["email"] == "owner@example.com"
    assert me["organizations"][0]["role"] == "owner"
    assert me["organizations"][0]["name"] == "Test Rentals"
    assert c.get("/api/auth/me").status_code == 200


def test_duplicate_email_rejected():
    register()
    r = new_client().post("/api/auth/register", json={"name": "X", "email": "OWNER@example.com", "password": PASSWORD})
    assert r.status_code == 409


def test_weak_password_rejected():
    r = new_client().post("/api/auth/register", json={"name": "X", "email": "x@example.com", "password": "short"})
    assert r.status_code == 422


def test_login_and_wrong_password():
    register()
    c = new_client()
    assert c.post("/api/auth/login", json={"email": "owner@example.com", "password": "nope-nope-1"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).status_code == 200
    assert c.get("/api/auth/me").status_code == 200


def test_logout_invalidates_existing_tokens():
    c, _ = register()
    stolen = c.cookies.get("pp_token")
    assert c.post("/api/auth/logout").status_code == 200
    other = new_client()
    r = other.get("/api/auth/me", headers={"Authorization": f"Bearer {stolen}"})
    assert r.status_code == 401


def test_password_reset_flow(outbox):
    register()
    c = new_client()
    assert c.post("/api/auth/forgot-password", json={"email": "owner@example.com"}).status_code == 200
    token = token_from(outbox, "/reset-password")
    assert c.post("/api/auth/reset-password", json={"token": token, "password": "NewPassword42!"}).status_code == 200
    # Token is single-use
    assert c.post("/api/auth/reset-password", json={"token": token, "password": "Another42!xx"}).status_code == 400
    assert c.post("/api/auth/login", json={"email": "owner@example.com", "password": "NewPassword42!"}).status_code == 200


def test_forgot_password_does_not_reveal_unknown_email(outbox):
    r = new_client().post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert outbox == []


def test_unauthenticated_requests_rejected():
    assert new_client().get("/api/properties").status_code == 401


def test_org_isolation():
    a, _ = register("A", "a@example.com", "A Rentals")
    b, _ = register("B", "b@example.com", "B Rentals")
    prop = make_property(a)
    assert b.get(f"/api/properties/{prop['id']}").status_code == 404
    assert b.patch(f"/api/properties/{prop['id']}", json={"name": "Hijack"}).status_code == 404
    assert b.get("/api/properties").json() == []
    # Forging the org header for an org you're not in is rejected
    b.headers["X-Org-Id"] = a.headers["X-Org-Id"]
    assert b.get("/api/properties").status_code == 403


def test_team_invite_and_roles(outbox):
    owner, _ = register()
    r = owner.post("/api/org/invitations", json={"email": "acct@example.com", "role": "accountant"})
    assert r.status_code == 200
    token = token_from(outbox, "/invite")
    c = new_client()
    preview = c.get(f"/api/auth/invitations/{token}").json()
    assert preview["role"] == "accountant" and preview["has_account"] is False
    me = c.post("/api/auth/invitations/accept", json={"token": token, "name": "Acct", "password": PASSWORD}).json()
    c.headers["X-Org-Id"] = me["organizations"][0]["id"]
    # Accountant can read but not write
    assert c.get("/api/properties").status_code == 200
    assert c.get("/api/dashboard").status_code == 200
    assert c.post("/api/properties", json={"name": "x", "address_line1": "x", "city": "x", "state": "x", "postal_code": "1"}).status_code == 403


def test_last_owner_cannot_be_removed():
    owner, _ = register()
    members = owner.get("/api/org/members").json()["members"]
    r = owner.delete(f"/api/org/members/{members[0]['membership_id']}")
    assert r.status_code == 400


def test_rate_limit_on_login():
    register()
    c = new_client()
    codes = [c.post("/api/auth/login", json={"email": "owner@example.com", "password": "wrong-pass-1"}).status_code for _ in range(12)]
    assert 429 in codes
