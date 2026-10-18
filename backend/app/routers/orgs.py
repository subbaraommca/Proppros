"""Organization settings, team members, invitations and notification preferences."""
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.core import audit
from app.core.config import settings
from app.core.deps import Ctx, admin_writer, get_ctx, owner_only, writer
from app.core.email import esc, layout, send_email
from app.core.security import new_url_token
from app.models import Invitation, Membership, Organization, Property, User, utcnow
from app.services import plans
from app.schemas import InviteIn, MemberUpdate, NotificationPrefs, OrgCreate, OrgUpdate

router = APIRouter(prefix="/org", tags=["organization"])

INVITE_DAYS = 7


def validate_property_ids(ctx: Ctx, ids: list[uuid.UUID] | None) -> list[str] | None:
    if ids is None:
        return None
    if not ids:
        raise HTTPException(status_code=422, detail="Choose at least one property, or give access to all properties.")
    found = {p for p in ctx.session.exec(select(Property.id).where(Property.org_id == ctx.org_id, Property.id.in_(ids))).all()}
    if len(found) != len(set(ids)):
        raise HTTPException(status_code=400, detail="One or more properties were not found.")
    return [str(i) for i in dict.fromkeys(ids)]


def create_invitation(
    ctx: Ctx, email: str, role: str, tenant_id: uuid.UUID | None = None, property_ids: list[str] | None = None
) -> tuple[Invitation, str, bool]:
    """Create (or refresh) an invitation and email the link.

    Returns (invitation, link, email_sent). The link is also shown to the inviter so it
    can be shared by text/WhatsApp when email isn't set up or doesn't arrive.
    """
    email = email.lower()
    for old in ctx.session.exec(
        select(Invitation).where(Invitation.org_id == ctx.org_id, Invitation.email == email, Invitation.accepted_at.is_(None))
    ).all():
        ctx.session.delete(old)
    raw, hashed = new_url_token()
    inv = Invitation(
        org_id=ctx.org_id,
        email=email,
        role=role,
        tenant_id=tenant_id,
        property_ids=property_ids,
        token_hash=hashed,
        invited_by_user_id=ctx.user.id,
        expires_at=utcnow() + timedelta(days=INVITE_DAYS),
    )
    ctx.session.add(inv)
    link = f"{settings.frontend_url}/invite?token={raw}"
    what = "your tenant portal" if role == "tenant" else f"the {esc(ctx.org.name)} team as {role}"
    email_sent, _ = send_email(
        email,
        f"You're invited to {ctx.org.name} on Proppros",
        layout(
            "You're invited",
            f"<p>{esc(ctx.user.name)} invited you to join {what} on Proppros.</p>"
            f"<p>This invitation expires in {INVITE_DAYS} days.</p>",
            "Accept invitation",
            link,
        ),
    )
    return inv, link, email_sent and settings.email_enabled


@router.get("")
def get_org(ctx: Ctx = Depends(get_ctx)):
    return ctx.org


@router.post("")
def create_org(payload: OrgCreate, ctx: Ctx = Depends(get_ctx)):
    """Create an additional portfolio (e.g. a separate LLC)."""
    session, user = ctx.session, ctx.user
    org = Organization(name=payload.name, timezone=payload.timezone)
    session.add(org)
    session.flush()
    session.add(Membership(org_id=org.id, user_id=user.id, role="owner"))
    audit.record(session, org.id, user.id, "organization", org.id, "create", f"Created {org.name}")
    session.commit()
    return org


@router.patch("")
def update_org(payload: OrgUpdate, ctx: Ctx = Depends(owner_only)):
    before = ctx.org.model_dump()
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(ctx.org, k, v)
    ctx.org.updated_at = utcnow()
    ctx.session.add(ctx.org)
    audit.log(ctx, "organization", ctx.org.id, "update", "Updated organization settings", audit.diff(before, ctx.org.model_dump()))
    ctx.session.commit()
    return ctx.org


@router.get("/members")
def list_members(ctx: Ctx = Depends(admin_writer)):
    rows = ctx.session.exec(
        select(Membership, User).join(User, User.id == Membership.user_id).where(Membership.org_id == ctx.org_id)
    ).all()
    members = [
        {"membership_id": str(m.id), "user_id": str(u.id), "name": u.name, "email": u.email, "role": m.role, "property_ids": m.property_ids}
        for m, u in rows
        if m.role != "tenant"
    ]
    invites = ctx.session.exec(
        select(Invitation).where(
            Invitation.org_id == ctx.org_id, Invitation.accepted_at.is_(None), Invitation.role != "tenant"
        )
    ).all()
    return {
        "members": members,
        "invitations": [{"id": str(i.id), "email": i.email, "role": i.role, "expires_at": i.expires_at, "property_ids": i.property_ids} for i in invites],
    }


@router.get("/assignees")
def list_assignees(ctx: Ctx = Depends(get_ctx)):
    """Staff who can be assigned work orders."""
    if ctx.role == "tenant":
        raise HTTPException(status_code=403, detail="Not allowed")
    rows = ctx.session.exec(
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.org_id == ctx.org_id, Membership.role.in_(("owner", "manager", "maintenance")))
    ).all()
    return [{"user_id": str(u.id), "name": u.name, "role": m.role} for m, u in rows]


@router.post("/invitations")
def invite_member(payload: InviteIn, ctx: Ctx = Depends(admin_writer)):
    existing = ctx.session.exec(
        select(Membership).join(User, User.id == Membership.user_id).where(
            Membership.org_id == ctx.org_id, User.email == payload.email.lower()
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="That person is already a member.")
    plans.check_seat_limit(ctx.session, ctx.org)
    scope = validate_property_ids(ctx, payload.property_ids)
    inv, link, email_sent = create_invitation(ctx, payload.email, payload.role, property_ids=scope)
    audit.log(ctx, "invitation", inv.id, "create", f"Invited {payload.email} as {payload.role}")
    ctx.session.commit()
    return {"id": str(inv.id), "email": inv.email, "role": inv.role, "invite_url": link, "email_sent": email_sent}


@router.delete("/invitations/{invitation_id}")
def revoke_invitation(invitation_id: uuid.UUID, ctx: Ctx = Depends(admin_writer)):
    inv = ctx.session.get(Invitation, invitation_id)
    if not inv or inv.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    ctx.session.delete(inv)
    audit.log(ctx, "invitation", invitation_id, "delete", f"Revoked invitation for {inv.email}")
    ctx.session.commit()
    return {"ok": True}


def _owner_count(ctx: Ctx) -> int:
    return len(ctx.session.exec(select(Membership.id).where(Membership.org_id == ctx.org_id, Membership.role == "owner")).all())


@router.patch("/members/{membership_id}")
def update_member(membership_id: uuid.UUID, payload: MemberUpdate, ctx: Ctx = Depends(owner_only)):
    m = ctx.session.get(Membership, membership_id)
    if not m or m.org_id != ctx.org_id or m.role == "tenant":
        raise HTTPException(status_code=404, detail="Member not found")
    new_role = payload.role or m.role
    if m.role == "owner" and new_role != "owner" and _owner_count(ctx) <= 1:
        raise HTTPException(status_code=400, detail="An organization needs at least one owner.")
    before = {"role": m.role, "property_ids": m.property_ids}
    m.role = new_role
    if payload.all_properties or new_role == "owner":
        m.property_ids = None
    elif payload.property_ids is not None:
        m.property_ids = validate_property_ids(ctx, payload.property_ids)
    ctx.session.add(m)
    audit.log(ctx, "membership", m.id, "update", f"Access updated ({new_role})", audit.diff(before, {"role": m.role, "property_ids": m.property_ids}))
    ctx.session.commit()
    return {"ok": True}


@router.delete("/members/{membership_id}")
def remove_member(membership_id: uuid.UUID, ctx: Ctx = Depends(owner_only)):
    m = ctx.session.get(Membership, membership_id)
    if not m or m.org_id != ctx.org_id or m.role == "tenant":
        raise HTTPException(status_code=404, detail="Member not found")
    if m.role == "owner" and _owner_count(ctx) <= 1:
        raise HTTPException(status_code=400, detail="An organization needs at least one owner.")
    ctx.session.delete(m)
    audit.log(ctx, "membership", m.id, "delete", "Removed team member")
    ctx.session.commit()
    return {"ok": True}


@router.get("/notification-preferences")
def get_prefs(ctx: Ctx = Depends(get_ctx)):
    return NotificationPrefs(**(ctx.membership.notification_prefs or {}))


@router.put("/notification-preferences")
def set_prefs(payload: NotificationPrefs, ctx: Ctx = Depends(get_ctx)):
    ctx.membership.notification_prefs = payload.model_dump()
    ctx.session.add(ctx.membership)
    ctx.session.commit()
    return payload
