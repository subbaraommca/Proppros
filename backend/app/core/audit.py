"""Audit trail helper — call from routers on every create/update/delete."""
import uuid
from datetime import date, datetime
from typing import Any

from sqlmodel import Session

from app.models import AuditLog


def _plain(value: Any) -> Any:
    if isinstance(value, (uuid.UUID, date, datetime)):
        return str(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Return {field: [old, new]} for fields that changed."""
    skip = {"updated_at", "created_at", "password_hash"}
    return {
        k: [_plain(before.get(k)), _plain(after.get(k))]
        for k in after
        if k not in skip and before.get(k) != after.get(k)
    }


def record(
    session: Session,
    org_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    entity_type: str,
    entity_id: uuid.UUID | None,
    action: str,
    summary: str = "",
    changes: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            org_id=org_id,
            actor_user_id=actor_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            summary=summary[:300],
            changes=_plain(changes or {}),
        )
    )


def log(ctx, entity_type: str, entity_id: uuid.UUID | None, action: str, summary: str = "", changes=None) -> None:
    """Shorthand using a request Ctx."""
    record(ctx.session, ctx.org_id, ctx.user.id, entity_type, entity_id, action, summary, changes)
