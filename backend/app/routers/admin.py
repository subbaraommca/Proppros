"""Super-admin console API: platform overview, organizations, users, feedback, support access (impersonation).

Super admins are users with `is_superadmin` or whose email is in SUPERADMIN_EMAILS.
Every impersonation is recorded in the target organization's audit log.
"""
import uuid
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlmodel import Session, func, or_, select

from app.core import audit
from app.core.config import settings
from app.core.database import get_session
from app.core.deps import COOKIE_NAME, is_superadmin, require_superadmin
from app.core.security import create_access_token, decode_token
from app.models import Feedback, Lease, Membership, Organization, Payment, Property, Unit, User, utcnow
from app.routers.auth import me_payload
from app.services import plans

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_COOKIE = "pp_admin"  # the admin's own session, kept while impersonating
IMPERSONATION_MINUTES = 60


class OrgAdminUpdate(BaseModel):
    plan: Literal["free", "pro", "business"] | None = None
    plan_comped: bool | None = None


class FeedbackUpdate(BaseModel):
    status: Literal["new", "reviewed", "done"]


@router.get("/overview")
def overview(_: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    count = lambda model, *where: int(session.exec(select(func.count()).select_from(model).where(*where)).one())  # noqa: E731
    since = utcnow() - timedelta(days=30)
    return {
        "organizations": count(Organization),
        "users": count(User),
        "units": count(Unit),
        "active_leases": count(Lease, Lease.status == "active"),
        "payments_30d": count(Payment, Payment.created_at >= since),
        "new_feedback": count(Feedback, Feedback.status == "new"),
        "billing_active": settings.billing_active,
    }


@router.get("/orgs")
def list_orgs(q: str = "", _: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    query = select(Organization).order_by(Organization.created_at.desc()).limit(200)
    if q:
        query = query.where(Organization.name.ilike(f"%{q}%"))
    out = []
    for org in session.exec(query).all():
        owner = session.exec(
            select(User.email).join(Membership, Membership.user_id == User.id).where(Membership.org_id == org.id, Membership.role == "owner")
        ).first()
        out.append(
            {
                "id": str(org.id),
                "name": org.name,
                "owner_email": owner,
                "plan": org.plan,
                "effective_plan": plans.effective_plan(org),
                "plan_comped": org.plan_comped,
                "subscription_status": org.subscription_status,
                "units": plans.unit_count(session, org.id),
                "members": plans.seat_count(session, org.id),
                "properties": int(session.exec(select(func.count()).select_from(Property).where(Property.org_id == org.id)).one()),
                "online_payments": org.online_payments_enabled,
                "created_at": org.created_at,
            }
        )
    return out


@router.patch("/orgs/{org_id}")
def update_org(org_id: uuid.UUID, payload: OrgAdminUpdate, admin: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    before = {"plan": org.plan, "plan_comped": org.plan_comped}
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(org, k, v)
    session.add(org)
    audit.record(session, org.id, admin.id, "organization", org.id, "admin_plan", f"Plan changed by Proppros support ({admin.email})", audit.diff(before, {"plan": org.plan, "plan_comped": org.plan_comped}))
    session.commit()
    return {"ok": True, "effective_plan": plans.effective_plan(org)}


@router.get("/users")
def list_users(q: str = "", _: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    query = select(User).order_by(User.created_at.desc()).limit(200)
    if q:
        query = query.where(or_(User.email.ilike(f"%{q}%"), User.name.ilike(f"%{q}%")))
    out = []
    for u in session.exec(query).all():
        memberships = session.exec(select(Membership, Organization.name).join(Organization, Organization.id == Membership.org_id).where(Membership.user_id == u.id)).all()
        out.append(
            {
                "id": str(u.id),
                "name": u.name,
                "email": u.email,
                "superadmin": is_superadmin(u),
                "mfa_enabled": u.mfa_enabled_at is not None,
                "created_at": u.created_at,
                "organizations": [{"name": name, "role": m.role} for m, name in memberships],
            }
        )
    return out


@router.get("/feedback")
def list_feedback(status: str | None = None, _: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    query = select(Feedback, User.name, User.email).join(User, User.id == Feedback.user_id).order_by(Feedback.created_at.desc()).limit(300)
    if status:
        query = query.where(Feedback.status == status)
    return [{**f.model_dump(), "user_name": n, "user_email": e} for f, n, e in session.exec(query).all()]


@router.patch("/feedback/{feedback_id}")
def update_feedback(feedback_id: uuid.UUID, payload: FeedbackUpdate, _: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    f = session.get(Feedback, feedback_id)
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    f.status = payload.status
    session.add(f)
    session.commit()
    return f


# ── Support access (impersonation) ───────────────────────────────────────────


@router.post("/impersonate/stop")
def stop_impersonating(request: Request, response: Response, session: Session = Depends(get_session)):
    original = request.cookies.get(ADMIN_COOKIE, "")
    claims = decode_token(original) if original else None
    admin = session.get(User, uuid.UUID(claims["sub"])) if claims and claims.get("sub") else None
    response.delete_cookie(ADMIN_COOKIE, path="/")
    if not admin or claims.get("ver") != admin.token_version or not is_superadmin(admin):
        response.delete_cookie(COOKIE_NAME, path="/")
        raise HTTPException(status_code=401, detail="Your admin session expired. Please sign in again.")
    response.set_cookie(COOKIE_NAME, original, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=settings.access_token_expire_minutes * 60, path="/")
    return me_payload(session, admin)


@router.post("/impersonate/{user_id}")
def impersonate(user_id: uuid.UUID, request: Request, response: Response, admin: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_superadmin(target) or target.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't impersonate another administrator.")
    if request.cookies.get(ADMIN_COOKIE):
        raise HTTPException(status_code=400, detail="Stop the current impersonation first.")
    for m in session.exec(select(Membership).where(Membership.user_id == target.id)).all():
        audit.record(session, m.org_id, admin.id, "membership", m.id, "support_access", f"Proppros support ({admin.email}) signed in as {target.email}")
    session.commit()
    # Keep the admin's own session aside, then switch to a short-lived session as the target.
    response.set_cookie(ADMIN_COOKIE, request.cookies.get(COOKIE_NAME, ""), httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=IMPERSONATION_MINUTES * 60, path="/")
    token = create_access_token(str(target.id), {"ver": target.token_version, "imp": str(admin.id), "imp_email": admin.email}, expires_minutes=IMPERSONATION_MINUTES)
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=IMPERSONATION_MINUTES * 60, path="/")
    return me_payload(session, target, {"imp_email": admin.email})
