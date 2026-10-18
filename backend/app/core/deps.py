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

    @property
    def scope(self) -> set[uuid.UUID] | None:
        """Property ids this member may see, or None for full access (owners always have full access)."""
        if self.role == "owner" or self.membership.property_ids is None:
            return None
        return {uuid.UUID(x) for x in self.membership.property_ids}

    def can_see_property(self, property_id: uuid.UUID | None) -> bool:
        scope = self.scope
        return scope is None or (property_id is not None and property_id in scope)

    def require_property(self, property_id: uuid.UUID | None, label: str = "Record") -> None:
        """404 (not 403) so scoped members can't probe which records exist."""
        if not self.can_see_property(property_id):
            raise HTTPException(status_code=404, detail=f"{label} not found")


def _token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    token = _token(request)
    payload = decode_token(token) if token else None
    if not payload or payload.get("purpose"):  # purpose-scoped tokens (e.g. pending 2FA) are not sessions
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user = session.get(User, uuid.UUID(payload["sub"]))
    except (KeyError, ValueError):
        user = None
    if not user or payload.get("ver") != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")
    return user


def token_claims(request: Request) -> dict:
    token = _token(request)
    return (decode_token(token) if token else None) or {}


def is_superadmin(user: User) -> bool:
    from app.core.config import settings

    return user.is_superadmin or settings.is_superadmin_email(user.email)


def require_superadmin(user: User = Depends(get_current_user)) -> User:
    if not is_superadmin(user):
        raise HTTPException(status_code=403, detail="You don't have permission to do that.")
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


def full_access(*roles: str):
    """Role check that also requires an unscoped membership (org-wide actions: team, billing, audit)."""

    def dependency(ctx: Ctx = Depends(get_ctx)) -> Ctx:
        if ctx.role not in roles or ctx.scope is not None:
            raise HTTPException(status_code=403, detail="You don't have permission to do that.")
        return ctx

    return dependency


# Common role sets
staff = require_roles("owner", "manager", "accountant", "maintenance")
admin_writer = full_access("owner", "manager")  # writer with access to every property
finance_read = require_roles("owner", "manager", "accountant")
writer = require_roles("owner", "manager")
owner_only = require_roles("owner")
tenant_only = require_roles("tenant")


def property_id_of(session: Session, obj) -> uuid.UUID | None:
    """The property a record belongs to (for property-scoped access)."""
    from app.models import Lease, Property, Unit  # local import: models import nothing from deps

    if isinstance(obj, Property):
        return obj.id
    if hasattr(obj, "property_id"):  # Unit, Expense, WorkOrder, Listing, Asset...
        return obj.property_id
    if getattr(obj, "listing_id", None):  # Application
        from app.models import Listing

        listing = session.get(Listing, obj.listing_id)
        return listing.property_id if listing else None
    lease_id = getattr(obj, "lease_id", None) or (obj.id if isinstance(obj, Lease) else None)
    if lease_id:  # Lease, Payment, LedgerEntry, RecurringCharge
        lease = obj if isinstance(obj, Lease) else session.get(Lease, lease_id)
        unit = session.get(Unit, lease.unit_id) if lease else None
        return unit.property_id if unit else None
    return None


def tenant_in_scope(ctx: Ctx, tenant_id: uuid.UUID) -> bool:
    """Scoped members see tenants on leases at their properties, plus tenants with no lease yet."""
    scope = ctx.scope
    if scope is None:
        return True
    from app.models import Lease, LeaseTenant, Unit

    props = ctx.session.exec(
        select(Unit.property_id).join(Lease, Lease.unit_id == Unit.id).join(LeaseTenant, LeaseTenant.lease_id == Lease.id).where(LeaseTenant.tenant_id == tenant_id)
    ).all()
    return not props or any(p in scope for p in props)


def get_owned(ctx: Ctx, model, obj_id: uuid.UUID, label: str = "Record"):
    """Fetch a row by id, 404 unless it belongs to the current organization (and the member's property scope)."""
    from app.models import Tenant

    obj = ctx.session.get(model, obj_id)
    if not obj or getattr(obj, "org_id", None) != ctx.org_id:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    if ctx.scope is not None:
        if isinstance(obj, Tenant):
            if not tenant_in_scope(ctx, obj.id):
                raise HTTPException(status_code=404, detail=f"{label} not found")
        else:
            ctx.require_property(property_id_of(ctx.session, obj), label)
    return obj
