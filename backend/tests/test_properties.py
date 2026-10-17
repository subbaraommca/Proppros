from tests.helpers import make_lease, make_property, make_tenant, register


def test_single_family_gets_default_unit():
    c, _ = register()
    prop = make_property(c)
    assert prop["unit_count"] == 1
    assert prop["units"][0]["name"] == "Main"


def test_multi_family_units_crud():
    c, _ = register()
    prop = make_property(c, "Elm Duplex", "multi_family")
    assert prop["unit_count"] == 0
    a = c.post(f"/api/properties/{prop['id']}/units", json={"name": "A", "beds": 2, "baths": 1, "market_rent_cents": 120000})
    b = c.post(f"/api/properties/{prop['id']}/units", json={"name": "B", "beds": 3, "baths": 2})
    assert a.status_code == 201 and b.status_code == 201
    r = c.patch(f"/api/units/{a.json()['id']}", json={"sqft": 900, "amenities": ["washer", "parking"]})
    assert r.json()["sqft"] == 900 and r.json()["amenities"] == ["washer", "parking"]
    assert c.delete(f"/api/units/{b.json()['id']}").status_code == 200
    assert c.get(f"/api/properties/{prop['id']}").json()["unit_count"] == 1


def test_unit_status_follows_lease():
    c, _ = register()
    prop = make_property(c)
    unit_id = prop["units"][0]["id"]
    t = make_tenant(c)
    lease = make_lease(c, unit_id, [t["id"]])
    assert c.get(f"/api/units/{unit_id}").json()["status"] == "occupied"
    # Can't mark an occupied unit vacant while the lease is active
    assert c.patch(f"/api/units/{unit_id}", json={"status": "vacant"}).json()["status"] == "occupied"
    c.post(f"/api/leases/{lease['id']}/end", json={"ended_on": "2026-10-31"})
    assert c.get(f"/api/units/{unit_id}").json()["status"] == "vacant"


def test_property_with_history_cannot_be_deleted_but_can_be_archived():
    c, _ = register()
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]])
    assert c.delete(f"/api/properties/{prop['id']}").status_code == 400
    assert c.post(f"/api/properties/{prop['id']}/archive").status_code == 400  # active lease
    c.post(f"/api/leases/{lease['id']}/end", json={"ended_on": "2026-10-31"})
    assert c.post(f"/api/properties/{prop['id']}/archive").status_code == 200
    assert c.get("/api/properties").json() == []
    assert len(c.get("/api/properties?include_archived=true").json()) == 1


def test_audit_log_records_changes():
    c, _ = register()
    prop = make_property(c)
    c.patch(f"/api/properties/{prop['id']}", json={"name": "Oak Street House"})
    log = c.get("/api/audit-log").json()
    update = next(e for e in log if e["action"] == "update" and e["entity_type"] == "property")
    assert update["changes"]["name"] == ["Oak St", "Oak Street House"]
    assert update["actor_name"] == "Owner One"
