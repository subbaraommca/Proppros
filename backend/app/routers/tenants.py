import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.core import audit
from app.core.deps import Ctx, get_owned, staff, writer
from app.models import Invitation, Lease, LeaseTenant, Membership, Property, Tenant, Unit, User, utcnow
from app.routers.orgs import create_invitation
from app.schemas import TenantIn, TenantUpdate
from app.services.billing import balances_for

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _leases_for_tenants(ctx: Ctx, tenant_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[dict]]:
    if not tenant_ids:
        return {}
    rows = ctx.session.exec(
        select(LeaseTenant.tenant_id, Lease, Unit.name, Property.name)
        .join(Lease, Lease.id == LeaseTenant.lease_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .where(LeaseTenant.tenant_id.in_(tenant_ids))
        .order_by(Lease.start_date.desc())
    ).all()
    balances = balances_for(ctx.session, list({lease.id for _, lease, _, _ in rows}))
    out: dict[uuid.UUID, list[dict]] = {}
    for tid, lease, unit_name, prop_name in rows:
        out.setdefault(tid, []).append(
            {
                "lease_id": str(lease.id),
                "status": lease.status,
                "start_date": lease.start_date,
                "end_date": lease.end_date,
                "rent_cents": lease.rent_cents,
                "unit_name": unit_name,
                "property_name": prop_name,
                "balance_cents": balances.get(lease.id, 0),
            }
        )
    return out


def _portal_status(ctx: Ctx, tenant: Tenant) -> str:
    if tenant.user_id:
        return "active"
    if tenant.email:
        pending = ctx.session.exec(
            select(Invitation.id).where(
                Invitation.org_id == ctx.org_id, Invitation.tenant_id == tenant.id, Invitation.accepted_at.is_(None)
            )
        ).first()
        if pending:
            return "invited"
    return "none"


@router.get("")
def list_tenants(ctx: Ctx = Depends(staff)):
    tenants = ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id).order_by(Tenant.last_name, Tenant.first_name)).all()
    leases = _leases_for_tenants(ctx, [t.id for t in tenants])
    out = []
    for t in tenants:
        tl = leases.get(t.id, [])
        current = next((l for l in tl if l["status"] == "active"), None)
        out.append({**t.model_dump(), "current_lease": current, "portal_status": "active" if t.user_id else "none"})
    return out


@router.post("", status_code=201)
def create_tenant(payload: TenantIn, ctx: Ctx = Depends(writer)):
    tenant = Tenant(org_id=ctx.org_id, **payload.model_dump())
    if tenant.email:
        tenant.email = tenant.email.lower()
    ctx.session.add(tenant)
    ctx.session.flush()
    audit.log(ctx, "tenant", tenant.id, "create", f"Added tenant {tenant.first_name} {tenant.last_name}")
    ctx.session.commit()
    ctx.session.refresh(tenant)
    return tenant


@router.get("/{tenant_id}")
def get_tenant(tenant_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    t = get_owned(ctx, Tenant, tenant_id, "Tenant")
    return {**t.model_dump(), "leases": _leases_for_tenants(ctx, [t.id]).get(t.id, []), "portal_status": _portal_status(ctx, t)}


@router.patch("/{tenant_id}")
def update_tenant(tenant_id: uuid.UUID, payload: TenantUpdate, ctx: Ctx = Depends(writer)):
    t = get_owned(ctx, Tenant, tenant_id, "Tenant")
    before = t.model_dump()
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k in ("first_name", "last_name", "vehicles", "pets") and v is None:
            continue
        setattr(t, k, v.lower() if k == "email" and v else v)
    t.updated_at = utcnow()
    ctx.session.add(t)
    audit.log(ctx, "tenant", t.id, "update", f"Updated tenant {t.first_name} {t.last_name}", audit.diff(before, t.model_dump()))
    ctx.session.commit()
    ctx.session.refresh(t)
    return t


@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    t = get_owned(ctx, Tenant, tenant_id, "Tenant")
    if ctx.session.exec(select(LeaseTenant).where(LeaseTenant.tenant_id == t.id)).first():
        raise HTTPException(status_code=400, detail="This tenant is on a lease and can't be deleted.")
    for inv in ctx.session.exec(select(Invitation).where(Invitation.tenant_id == t.id)).all():
        ctx.session.delete(inv)
    ctx.session.delete(t)
    audit.log(ctx, "tenant", t.id, "delete", f"Deleted tenant {t.first_name} {t.last_name}")
    ctx.session.commit()
    return {"ok": True}


@router.post("/{tenant_id}/invite")
def invite_tenant(tenant_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Invite a tenant to the portal (Iteration 7)."""
    t = get_owned(ctx, Tenant, tenant_id, "Tenant")
    if not t.email:
        raise HTTPException(status_code=400, detail="Add an email address for this tenant first.")
    if t.user_id:
        raise HTTPException(status_code=409, detail="This tenant already has portal access.")
    staff_member = ctx.session.exec(
        select(Membership).join(User, User.id == Membership.user_id).where(
            Membership.org_id == ctx.org_id, User.email == t.email, Membership.role != "tenant"
        )
    ).first()
    if staff_member:
        raise HTTPException(status_code=400, detail="That email belongs to a team member of this organization.")
    inv = create_invitation(ctx, t.email, "tenant", tenant_id=t.id)
    audit.log(ctx, "tenant", t.id, "invite", f"Invited {t.email} to the tenant portal")
    ctx.session.commit()
    return {"ok": True, "invitation_id": str(inv.id)}
