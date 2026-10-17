"""File storage: Vercel Blob in deployed environments, local disk in dev.

Uploads go through the API (multipart) so we can authorize them and record a
Document row. The Vercel function body limit (4.5 MB) caps file size; switch
to Blob client-uploads if larger files are ever needed.
"""
import logging
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BLOB_API = "https://blob.vercel-storage.com"
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass
class StoredFile:
    key: str  # local relative path, or Blob URL
    backend: str  # "local" | "blob"


def _safe_name(filename: str) -> str:
    name = _SAFE.sub("-", os.path.basename(filename or "file")).strip("-.")
    return name[:120] or "file"


def put(org_id: uuid.UUID, filename: str, data: bytes, content_type: str) -> StoredFile:
    pathname = f"{org_id}/{uuid.uuid4().hex}/{_safe_name(filename)}"
    if settings.blob_read_write_token:
        resp = httpx.put(
            f"{BLOB_API}/{pathname}",
            content=data,
            headers={
                "authorization": f"Bearer {settings.blob_read_write_token}",
                "x-api-version": "7",
                "x-content-type": content_type or "application/octet-stream",
                "x-add-random-suffix": "1",
            },
            timeout=30,
        )
        resp.raise_for_status()
        return StoredFile(key=resp.json()["url"], backend="blob")

    root = Path(settings.local_upload_dir)
    target = root / pathname
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return StoredFile(key=pathname, backend="local")


def local_path(key: str) -> Path:
    root = Path(settings.local_upload_dir).resolve()
    path = (root / key).resolve()
    if root not in path.parents:
        raise ValueError("invalid storage key")
    return path


def delete(stored_key: str, backend: str) -> None:
    try:
        if backend == "blob":
            httpx.post(
                f"{BLOB_API}/delete",
                json={"urls": [stored_key]},
                headers={"authorization": f"Bearer {settings.blob_read_write_token}", "x-api-version": "7"},
                timeout=15,
            )
        else:
            local_path(stored_key).unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001 — deleting the blob is best-effort
        logger.warning("Failed to delete stored file %s: %s", stored_key, exc)
