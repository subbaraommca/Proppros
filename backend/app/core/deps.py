"""Request context: current user, current organization and role checks.

The frontend sends the active organization in the `X-Org-Id` header (or `?org=`
on file links); if absent we fall back to the user's first membership.
"""
import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Query, Request, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import decode_token
from app.models import WRITE_ROLES, Membership, Organization, User

COOKIE_NAME = "pp_token"


@dataclass
class Ctx:
    user: User
    org: Organization
    membership: Membership
    session: Session

    @property
    def role(self) -> str:
        return self.membership.role

    @property
    def org_id(self) -> uuid.UUID:
        return self.org.id

    @property
    def can_write(self) -> bool:
        return self.role in WRITE_ROLES


def _token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    token = _token(request)
    payload = decode_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user = session.get(User, uuid.UUID(payload["sub"]))
    except (KeyError, ValueError):
        user = None
    if not user or payload.get("ver") != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")
    return user


def get_ctx(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    x_org_id: str | None = Header(default=None),
    org: str | None = Query(default=None, include_in_schema=False),  # for file links opened in a new tab
) -> Ctx:
    x_org_id = x_org_id or org
    query = select(Membership).where(Membership.user_id == user.id)
    if x_org_id:
        try:
            query = query.where(Membership.org_id == uuid.UUID(x_org_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid organization id")
    membership = session.exec(query.order_by(Membership.created_at)).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this organization.")
    org = session.get(Organization, membership.org_id)
    return Ctx(user=user, org=org, membership=membership, session=session)


def require_roles(*roles: str):
    def dependency(ctx: Ctx = Depends(get_ctx)) -> Ctx:
        if ctx.role not in roles:
            raise HTTPException(status_code=403, detail="You don't have permission to do that.")
        return ctx

    return dependency


# Common role sets
staff = require_roles("owner", "manager", "accountant", "maintenance")
finance_read = require_roles("owner", "manager", "accountant")
writer = require_roles("owner", "manager")
owner_only = require_roles("owner")
tenant_only = require_roles("tenant")


def get_owned(ctx: Ctx, model, obj_id: uuid.UUID, label: str = "Record"):
    """Fetch a row by id, 404 unless it belongs to the current organization."""
    obj = ctx.session.get(model, obj_id)
    if not obj or getattr(obj, "org_id", None) != ctx.org_id:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj
