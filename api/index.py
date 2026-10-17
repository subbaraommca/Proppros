"""Vercel Python Function entrypoint.

vercel.json rewrites `/api/<rest>` → `/api/index?__path=<rest>`. Since
@vercel/python 6.52 the function sees the rewrite *destination* as its path,
so this thin ASGI wrapper restores the original `/api/<rest>` path before
FastAPI routes the request. (If the runtime passes the original path, the
wrapper is a no-op.)
"""
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app as fastapi_app  # noqa: E402

_REWRITE_TARGETS = {"/api/index", "/api/index.py", "/api"}


def restore_path(scope: dict) -> dict:
    if scope.get("type") not in ("http", "websocket") or scope.get("path") not in _REWRITE_TARGETS:
        return scope
    params = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
    rest = next((v for k, v in params if k == "__path"), None)
    if rest is None:
        return scope
    path = "/api/" + rest.lstrip("/")
    query = urlencode([(k, v) for k, v in params if k != "__path"])
    return {**scope, "path": path, "raw_path": path.encode(), "query_string": query.encode()}


async def app(scope, receive, send):
    await fastapi_app(restore_path(scope), receive, send)
