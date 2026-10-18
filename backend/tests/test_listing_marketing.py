"""Vacancy marketing kit: ready-to-post ad text and the printable flyer for a published listing."""
import io
import re

from PIL import Image

from app.core.config import settings
from tests.helpers import make_property, make_tenant, new_client, register
from tests.test_leasing import _tenant_client
from tests.test_listings import _published

# Phrases that describe people rather than the home. None may appear in our generated text.
BANNED = [
    "family", "families", "children", "kids", "adults only", "couple", "singles", "mature", "seniors", "students",
    "professionals", "christian", "church", "english", "handicap", "able-bodied", "perfect for", "ideal for", "young",
]


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), (237, 175, 136)).save(buf, "PNG")
    return buf.getvalue()


def test_marketing_texts_use_listing_facts_and_share_url():
    c, _ = register()
    _, listing = _published(c, deposit_cents=150000, available_on="2099-06-01", pet_policy="Cats allowed", title="Sunny bungalow on Oak")
    r = c.get(f"/api/listings/{listing['id']}/marketing")
    assert r.status_code == 200, r.text
    data = r.json()
    share = f"{settings.frontend_url}/l/{listing['slug']}"
    assert data["share_url"] == share and data["fair_housing_flags"] == []
    t = data["texts"]
    site = t["listing_site"]
    assert len(site["title"]) <= 70 and "$1,800/mo" in site["title"]
    for text in (site["body"], t["social"], t["message"]):
        assert "$1,800" in text and share in text
    assert "Sunny bungalow on Oak" in site["body"] and "Sunny bungalow on Oak" in t["message"]
    assert "Deposit: $1,500" in site["body"] and "June 1, 2099" in site["body"] and "Cats allowed" in site["body"]
    assert "Austin, TX" in t["social"] and "#ForRent" in t["social"]
    everything = " ".join([site["title"], site["body"], t["social"], t["message"]]).lower()
    for phrase in BANNED:
        assert not re.search(rf"\b{re.escape(phrase)}\b", everything), phrase


def test_marketing_flags_risky_words_in_landlord_description():
    c, _ = register()
    _, listing = _published(c, description="Quiet home, perfect for a mature couple. No kids.")
    flags = c.get(f"/api/listings/{listing['id']}/marketing").json()["fair_housing_flags"]
    assert {"perfect for", "mature", "couple", "no kids"} <= set(flags)


def test_flyer_pdf_with_and_without_photo():
    c, _ = register()
    _, listing = _published(c)
    r = c.get(f"/api/listings/{listing['id']}/flyer.pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF")
    up = c.post("/api/documents", data={"owner_type": "listing", "owner_id": listing["id"], "kind": "photo"}, files={"file": ("a.png", _png(), "image/png")})
    assert up.status_code == 201, up.text
    with_photo = c.get(f"/api/listings/{listing['id']}/flyer.pdf")
    assert with_photo.status_code == 200 and with_photo.content.startswith(b"%PDF") and len(with_photo.content) > len(r.content)
    # A photo that can't be decoded is skipped instead of breaking the flyer.
    c.post("/api/documents", data={"owner_type": "listing", "owner_id": listing["id"], "kind": "photo"}, files={"file": ("b.png", b"\x89PNG\r\n\x1a\nfake", "image/png")})
    c.patch(f"/api/listings/{listing['id']}", json={"photo_order": [p["id"] for p in reversed(c.get(f"/api/listings/{listing['id']}").json()["photos"])]})
    assert c.get(f"/api/listings/{listing['id']}/flyer.pdf").content.startswith(b"%PDF")


def test_marketing_requires_published_listing():
    c, _ = register()
    prop = make_property(c)
    draft = c.post("/api/listings", json={"unit_id": prop["units"][0]["id"]}).json()
    for path in ("marketing", "flyer.pdf"):
        r = c.get(f"/api/listings/{draft['id']}/{path}")
        assert r.status_code == 409 and "Publish" in r.json()["detail"]


def test_marketing_permissions():
    c, _ = register()
    _, listing = _published(c)
    other, _ = register(email="other@example.com", org="Other")
    for path in ("marketing", "flyer.pdf"):
        assert other.get(f"/api/listings/{listing['id']}/{path}").status_code == 404
    tc = _tenant_client(c, make_tenant(c))
    for path in ("marketing", "flyer.pdf"):
        assert tc.get(f"/api/listings/{listing['id']}/{path}").status_code == 403
    assert new_client().get(f"/api/listings/{listing['id']}/marketing").status_code == 401
