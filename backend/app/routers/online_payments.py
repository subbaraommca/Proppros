"""Online payments API: owner settings + Stripe onboarding, tenant pay/autopay, Stripe webhook."""
import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core import audit
from app.core.config import settings
from app.core.database import get_session
from app.core.deps import Ctx, owner_only, tenant_only, writer
from app.models import AutopayEnrollment, Lease, Tenant, utcnow
from app.services import billing
from app.services import online_payments as op
from app.services import stripe_gateway as gateway

logger = logging.getLogger(__name__)
router = APIRouter(tags=["online payments"])


class PaymentSettingsIn(BaseModel):
    online_payments_enabled: bool | None = None
    allow_partial_payments: bool | None = None
    pass_card_fee: bool | None = None
    returned_payment_fee_cents: int | None = Field(default=None, ge=0, le=100_00)


class PayIn(BaseModel):
    amount_cents: int = Field(gt=0, le=10_000_000)
    method: Literal["us_bank_account", "card"]


def _require_stripe() -> None:
    if not settings.stripe_enabled:
        raise HTTPException(status_code=404, detail="Online payments aren't set up on this server.")


def _settings_payload(ctx: Ctx) -> dict:
    o = ctx.org
    return {
        "stripe_configured": settings.stripe_enabled,
        "connected": bool(o.stripe_account_id),
        "charges_enabled": o.stripe_charges_enabled,
        "payouts_enabled": o.stripe_payouts_enabled,
        "details_submitted": o.stripe_details_submitted,
        "online_payments_enabled": o.online_payments_enabled,
        "allow_partial_payments": o.allow_partial_payments,
        "pass_card_fee": o.pass_card_fee,
        "returned_payment_fee_cents": o.returned_payment_fee_cents,
        "card_fee_bps": settings.stripe_card_fee_bps,
        "card_fee_fixed_cents": settings.stripe_card_fee_fixed_cents,
        "accepting": op.org_accepts_online(o),
    }


# ── Owner: settings & Stripe Connect onboarding ──────────────────────────────


@router.get("/online-payments/settings")
def get_settings(ctx: Ctx = Depends(writer)):
    return _settings_payload(ctx)


@router.patch("/online-payments/settings")
def update_settings(payload: PaymentSettingsIn, ctx: Ctx = Depends(owner_only)):
    data = payload.model_dump(exclude_none=True)
    if data.get("online_payments_enabled") and not ctx.org.stripe_charges_enabled:
        raise HTTPException(status_code=400, detail="Finish connecting your Stripe account before turning on online payments.")
    before = ctx.org.model_dump()
    for k, v in data.items():
        setattr(ctx.org, k, v)
    ctx.org.updated_at = utcnow()
    ctx.session.add(ctx.org)
    audit.log(ctx, "organization", ctx.org.id, "update", "Updated online payment settings", audit.diff(before, ctx.org.model_dump()))
    ctx.session.commit()
    return _settings_payload(ctx)


@router.post("/online-payments/connect")
def connect(ctx: Ctx = Depends(owner_only)):
    """Create the owner's Stripe Express account (once) and return an onboarding link."""
    _require_stripe()
    if not ctx.org.stripe_account_id:
        ctx.org.stripe_account_id = gateway.create_express_account(ctx.user.email, ctx.org.name, str(ctx.org.id))
        ctx.session.add(ctx.org)
        audit.log(ctx, "organization", ctx.org.id, "stripe_connect", "Created Stripe account for online payments")
        ctx.session.commit()
    url = gateway.onboarding_link(
        ctx.org.stripe_account_id,
        return_url=f"{settings.frontend_url}/settings?tab=payments&stripe=return",
        refresh_url=f"{settings.frontend_url}/settings?tab=payments&stripe=refresh",
    )
    return {"url": url}


@router.post("/online-payments/connect/refresh")
def refresh_status(ctx: Ctx = Depends(writer)):
    _require_stripe()
    if ctx.org.stripe_account_id:
        status = gateway.account_status(ctx.org.stripe_account_id)
        ctx.org.stripe_charges_enabled = status["charges_enabled"]
        ctx.org.stripe_payouts_enabled = status["payouts_enabled"]
        ctx.org.stripe_details_submitted = status["details_submitted"]
        ctx.session.add(ctx.org)
        ctx.session.commit()
    return _settings_payload(ctx)


@router.post("/online-payments/connect/dashboard")
def stripe_dashboard(ctx: Ctx = Depends(owner_only)):
    _require_stripe()
    if not ctx.org.stripe_account_id or not ctx.org.stripe_details_submitted:
        raise HTTPException(status_code=400, detail="Finish connecting your Stripe account first.")
    return {"url": gateway.dashboard_link(ctx.org.stripe_account_id)}


# ── Tenant: pay & autopay ────────────────────────────────────────────────────


def _my_lease(ctx: Ctx, lease_id: uuid.UUID) -> tuple[Lease, Tenant]:
    mine = op.tenant_lease_ids(ctx.session, ctx.user.id, ctx.org_id)
    if lease_id not in mine:
        raise HTTPException(status_code=404, detail="Lease not found")
    return ctx.session.get(Lease, lease_id), ctx.session.get(Tenant, mine[lease_id])


@router.get("/portal/online-payments")
def portal_payment_options(ctx: Ctx = Depends(tenant_only)):
    """What the portal should offer for each of the tenant's leases."""
    org = ctx.org
    out = []
    for lease_id, tenant_id in op.tenant_lease_ids(ctx.session, ctx.user.id, ctx.org_id).items():
        lease = ctx.session.get(Lease, lease_id)
        enrollment = ctx.session.exec(
            select(AutopayEnrollment).where(AutopayEnrollment.lease_id == lease_id, AutopayEnrollment.tenant_id == tenant_id, AutopayEnrollment.active == True)  # noqa: E712
        ).first()
        available = op.org_accepts_online(org) and lease.status == "active" and not lease.block_online_payments
        balance = billing.lease_balance(ctx.session, lease_id)
        pending = op.pending_cents(ctx.session, lease_id)
        out.append(
            {
                "lease_id": str(lease_id),
                "available": available,
                "blocked": lease.block_online_payments,
                "balance_cents": balance,
                "pending_cents": pending,
                "payable_cents": max(balance - pending, 0),
                "allow_partial": org.allow_partial_payments,
                "card_fee": {"bps": settings.stripe_card_fee_bps, "fixed_cents": settings.stripe_card_fee_fixed_cents} if org.pass_card_fee else None,
                "autopay": {"method_label": enrollment.method_label, "method_type": enrollment.method_type} if enrollment else None,
            }
        )
    return {"enabled": op.org_accepts_online(org), "leases": out}


@router.post("/portal/leases/{lease_id}/pay")
def pay(lease_id: uuid.UUID, payload: PayIn, ctx: Ctx = Depends(tenant_only)):
    _require_stripe()
    lease, tenant = _my_lease(ctx, lease_id)
    return {"url": op.start_checkout(ctx.session, ctx.org, lease, tenant, payload.amount_cents, payload.method)}


@router.post("/portal/leases/{lease_id}/autopay")
def enable_autopay(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    _require_stripe()
    lease, tenant = _my_lease(ctx, lease_id)
    return {"url": op.start_autopay_setup(ctx.session, ctx.org, lease, tenant)}


@router.delete("/portal/leases/{lease_id}/autopay")
def disable_autopay(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    lease, tenant = _my_lease(ctx, lease_id)
    e = ctx.session.exec(select(AutopayEnrollment).where(AutopayEnrollment.lease_id == lease.id, AutopayEnrollment.tenant_id == tenant.id)).first()
    if not e or not e.active:
        raise HTTPException(status_code=404, detail="Autopay isn't on for this lease.")
    e.active = False
    e.updated_at = utcnow()
    ctx.session.add(e)
    audit.log(ctx, "lease", lease.id, "autopay_off", f"Autopay turned off by {tenant.first_name}")
    ctx.session.commit()
    if settings.stripe_enabled:
        try:
            gateway.detach_payment_method(e.stripe_payment_method_id)
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup
            logger.warning("Could not detach payment method: %s", exc)
    return {"ok": True}


# ── Stripe webhook ───────────────────────────────────────────────────────────


@router.post("/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None), session: Session = Depends(get_session)):
    if not settings.stripe_enabled or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=404, detail="Not found")
    payload = await request.body()
    try:
        event = gateway.parse_webhook(payload, stripe_signature or "")
    except Exception:  # noqa: BLE001 — bad signature or malformed body
        raise HTTPException(status_code=400, detail="Invalid signature")
    outcome = op.handle_event(session, event)
    logger.info("Stripe event %s (%s): %s", event.get("id"), event.get("type"), outcome)
    return {"received": True, "outcome": outcome}
