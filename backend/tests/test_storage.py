"""Vercel Blob integration (HTTP mocked): private uploads, auth modes, permission-checked downloads."""
import httpx

from app.core import storage
from app.core.config import settings
from tests.helpers import make_lease, make_property, make_tenant, register

STORE_URL = "https://abc123.private.blob.vercel-storage.com"


class FakeBlob:
    def __init__(self):
        self.files: dict[str, bytes] = {}
        self.calls: list[tuple[str, str, dict]] = []

    def put(self, url, params=None, content=None, headers=None, timeout=None):
        self.calls.append(("PUT", url, dict(headers)))
        blob_url = f"{STORE_URL}/{params['pathname']}-rnd"
        self.files[blob_url] = content
        return httpx.Response(200, json={"url": blob_url}, request=httpx.Request("PUT", url))

    def get(self, url, headers=None, timeout=None):
        self.calls.append(("GET", url, dict(headers)))
        if url not in self.files:
            return httpx.Response(404, request=httpx.Request("GET", url))
        return httpx.Response(200, content=self.files[url], request=httpx.Request("GET", url))

    def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append(("POST", url, dict(headers)))
        for u in json["urls"]:
            self.files.pop(u, None)
        return httpx.Response(200, json={}, request=httpx.Request("POST", url))


def _use_fake(monkeypatch, **cfg):
    fake = FakeBlob()
    monkeypatch.setattr(storage.httpx, "put", fake.put)
    monkeypatch.setattr(storage.httpx, "get", fake.get)
    monkeypatch.setattr(storage.httpx, "post", fake.post)
    for k, v in cfg.items():
        monkeypatch.setattr(settings, k, v)
    return fake


def test_private_upload_and_permission_checked_download(monkeypatch, outbox):
    fake = _use_fake(monkeypatch, blob_read_write_token="vercel_blob_rw_abc123_secretpart", blob_access="private")
    c, _ = register()
    prop = make_property(c)
    t = make_tenant(c)
    lease = make_lease(c, prop["units"][0]["id"], [t["id"]])

    doc = c.post(
        "/api/documents",
        data={"owner_type": "lease", "owner_id": lease["id"], "kind": "lease"},
        files={"file": ("lease.pdf", b"%PDF-private", "application/pdf")},
    ).json()
    method, url, headers = fake.calls[0]
    assert method == "PUT" and url == "https://vercel.com/api/blob/"
    assert headers["x-vercel-blob-access"] == "private"
    assert headers["x-vercel-blob-store-id"] == "abc123"
    assert headers["authorization"] == "Bearer vercel_blob_rw_abc123_secretpart"

    # Owner gets the bytes streamed through the API — never a redirect to the blob URL
    r = c.get(f"/api/documents/{doc['id']}/file", follow_redirects=False)
    assert r.status_code == 200 and r.content == b"%PDF-private"
    assert "private" in r.headers["cache-control"]

    # Another org can't read it
    other, _ = register("B", "b@example.com", "B Rentals")
    assert other.get(f"/api/documents/{doc['id']}/file").status_code == 404

    assert c.delete(f"/api/documents/{doc['id']}").status_code == 200
    assert fake.calls[-1][0] == "POST" and fake.files == {}


def test_oidc_auth_uses_request_token_and_store_id(monkeypatch):
    fake = _use_fake(monkeypatch, blob_read_write_token="", blob_store_id="store_abc123", blob_access="private")
    c, _ = register()
    prop = make_property(c)
    r = c.post(
        "/api/documents",
        data={"owner_type": "property", "owner_id": prop["id"]},
        files={"file": ("a.pdf", b"%PDF", "application/pdf")},
        headers={"x-vercel-oidc-token": "oidc-xyz"},
    )
    assert r.status_code == 201, r.text
    headers = fake.calls[0][2]
    assert headers["authorization"] == "Bearer oidc-xyz" and headers["x-vercel-blob-store-id"] == "abc123"


def test_health_reports_storage(client, monkeypatch):
    assert client.get("/api/health").json()["storage"] == "local"
    monkeypatch.setattr(settings, "blob_read_write_token", "vercel_blob_rw_abc123_x")
    assert client.get("/api/health").json()["storage"] == "vercel-blob (private)"
