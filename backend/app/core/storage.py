"""File storage: Vercel Blob in deployed environments, local disk in dev.

Uploads go through the API (multipart) so we can authorize them and record a
Document row. The Vercel function body limit (4.5 MB) caps file size.

Vercel Blob (mirrors the official @vercel/blob SDK's HTTP calls):
  • Auth: BLOB_READ_WRITE_TOKEN, or Vercel OIDC (per-request `x-vercel-oidc-token`
    header or VERCEL_OIDC_TOKEN) together with BLOB_STORE_ID.
  • Access: BLOB_ACCESS = "private" (default) or "public" — must match the store.
    Private files are only readable with the token, so downloads are streamed
    through our API after its permission checks; public files are redirected to.
"""
import contextvars
import logging
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BLOB_API = "https://vercel.com/api/blob"
BLOB_API_VERSION = "13"
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")

# Set per request by middleware in app.main (Vercel injects this header into functions).
oidc_token_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("vercel_oidc_token", default=None)


@dataclass
class StoredFile:
    key: str  # local relative path, or Blob URL
    backend: str  # "local" | "blob" (public) | "blobpriv" (private)


def blob_enabled() -> bool:
    return bool(settings.blob_read_write_token or settings.blob_store_id)


def _auth() -> tuple[str, str]:
    """Return (bearer_token, store_id) for Vercel Blob."""
    if settings.blob_read_write_token:
        # Format: vercel_blob_rw_<storeId>_<secret>
        parts = settings.blob_read_write_token.split("_")
        return settings.blob_read_write_token, parts[3] if len(parts) > 3 else ""
    token = oidc_token_var.get() or os.environ.get("VERCEL_OIDC_TOKEN", "")
    if not token or not settings.blob_store_id:
        raise RuntimeError("Vercel Blob credentials missing: set BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with Vercel OIDC")
    store_id = settings.blob_store_id
    return token, store_id.removeprefix("store_")


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    token, store_id = _auth()
    headers = {"authorization": f"Bearer {token}", "x-api-version": BLOB_API_VERSION}
    if store_id:
        headers["x-vercel-blob-store-id"] = store_id
    headers.update(extra or {})
    return headers


def _safe_name(filename: str) -> str:
    name = _SAFE.sub("-", os.path.basename(filename or "file")).strip("-.")
    return name[:120] or "file"


def put(org_id: uuid.UUID, filename: str, data: bytes, content_type: str) -> StoredFile:
    pathname = f"{org_id}/{uuid.uuid4().hex}/{_safe_name(filename)}"
    if blob_enabled():
        access = "public" if settings.blob_access == "public" else "private"
        resp = httpx.put(
            f"{BLOB_API}/",
            params={"pathname": pathname},
            content=data,
            headers=_headers(
                {
                    "x-vercel-blob-access": access,
                    "x-content-type": content_type or "application/octet-stream",
                    "x-add-random-suffix": "1",
                    "x-content-length": str(len(data)),
                }
            ),
            timeout=30,
        )
        if resp.status_code >= 400:
            logger.error("Blob upload failed %s: %s", resp.status_code, resp.text[:300])
            resp.raise_for_status()
        return StoredFile(key=resp.json()["url"], backend="blob" if access == "public" else "blobpriv")

    root = Path(settings.local_upload_dir)
    target = root / pathname
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return StoredFile(key=pathname, backend="local")


def read_private(url: str) -> bytes:
    """Fetch a private blob's bytes (files are capped at 4 MB, so buffering is fine)."""
    resp = httpx.get(url, headers=_headers(), timeout=30)
    if resp.status_code == 404:
        raise FileNotFoundError(url)
    resp.raise_for_status()
    return resp.content


def local_path(key: str) -> Path:
    root = Path(settings.local_upload_dir).resolve()
    path = (root / key).resolve()
    if root not in path.parents:
        raise ValueError("invalid storage key")
    return path


def delete(stored_key: str, backend: str) -> None:
    try:
        if backend in ("blob", "blobpriv"):
            httpx.post(
                f"{BLOB_API}/delete",
                json={"urls": [stored_key]},
                headers=_headers({"content-type": "application/json"}),
                timeout=15,
            )
        else:
            local_path(stored_key).unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001 — deleting the blob is best-effort
        logger.warning("Failed to delete stored file %s: %s", stored_key, exc)
