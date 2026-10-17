"""Health check, audit log viewer, notification log and cron endpoints."""
import hmac
import os
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlmodel import Session, select

from app.core import storage
from app.core.config import settings
from app.core.database import check_db_connection, get_session
from app.core.deps import Ctx, writer
from app.models import AuditLog, Notification, User
from app.services.jobs import run_daily, run_daily_for_org

router = APIRouter(tags=["system"])


def _storage_status() -> str:
    if storage.blob_enabled():
        return f"vercel-blob ({'public' if settings.blob_access == 'public' else 'private'})"
    # Vercel's filesystem is read-only, so uploads need Blob there.
    return "not_configured" if settings.on_vercel else "local"


def _deployment_info() -> dict:
    """Setup diagnostics shown only while the database is unconfigured: presence flags, never values."""
    names = ("DATABASE_URL", "DATABASE_URL_UNPOOLED", "ENVIRONMENT", "JWT_SECRET", "CRON_SECRET", "COOKIE_SECURE", "FRONTEND_URL")
    return {
        "vercel_env": os.environ.get("VERCEL_ENV"),
        "commit": (os.environ.get("VERCEL_GIT_COMMIT_SHA") or "")[:7] or None,
        "variables_present": {n: bool(os.environ.get(n)) for n in names},
    }


def _email_status() -> dict:
    sender = settings.email_from
    domain = sender.split("@")[-1].strip(" >") if "@" in sender else None
    return {"provider": "resend" if settings.email_enabled else "log-only", "from_domain": domain}


@router.get("/health")
def health():
    if not settings.database_configured:
        return {
            "status": "degraded",
            "db": "not_configured",
            "hint": "Connect Neon Postgres in Vercel → Storage so DATABASE_URL is set, then redeploy.",
            # Names only (never values) of database-like variables this deployment can see.
            "database_env_names_seen": sorted(
                k for k in os.environ if any(w in k.upper() for w in ("DATABASE", "POSTGRES", "NEON", "PGHOST"))
            ),
            "storage": _storage_status(),
            "environment": settings.environment,
            "deployment": _deployment_info(),
        }
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "unreachable",
        "storage": _storage_status(),
        "email": _email_status(),
        "environment": settings.environment,
    }


@router.get("/audit-log")
def audit_log(
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    ctx: Ctx = Depends(writer),
):
    q = select(AuditLog, User.name).outerjoin(User, User.id == AuditLog.actor_user_id).where(AuditLog.org_id == ctx.org_id)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    rows = ctx.session.exec(q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)).all()
    return [{**a.model_dump(), "actor_name": name or "System"} for a, name in rows]


@router.get("/notifications/log")
def notification_log(limit: int = Query(default=100, le=500), ctx: Ctx = Depends(writer)):
    return ctx.session.exec(
        select(Notification).where(Notification.org_id == ctx.org_id).order_by(Notification.created_at.desc()).limit(limit)
    ).all()


@router.post("/automation/run")
def run_now(ctx: Ctx = Depends(writer)):
    """Let an owner trigger today's automation for their org (same idempotent job as the cron)."""
    return run_daily_for_org(ctx.session, ctx.org, trigger="manual", actor_user_id=ctx.user.id)


def _check_cron(authorization: str | None) -> None:
    if not settings.cron_secret:
        if settings.is_production:
            raise HTTPException(status_code=500, detail="CRON_SECRET not configured")
        return  # local dev convenience
    expected = f"Bearer {settings.cron_secret}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/cron/daily")
def cron_daily(authorization: str | None = Header(default=None), session: Session = Depends(get_session)):
    """Called by Vercel Cron (GET with Authorization: Bearer $CRON_SECRET)."""
    _check_cron(authorization)
    if not settings.database_configured:
        raise HTTPException(status_code=503, detail="Database not configured")
    return {"ok": True, "results": run_daily(session)}
