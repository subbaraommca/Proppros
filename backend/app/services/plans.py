"""Proppros plans, limits and subscriptions (Stripe Billing on the platform account).

Prices are per unit per month and live in Stripe (STRIPE_PRICE_PRO / _BUSINESS);
the amounts below are for display on the pricing page — keep them in sync.
Limits are only enforced when billing is active (BILLING_ENABLED=true and
Stripe keys set), so self-hosted / pre-launch use is never blocked.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, func, select

from app.core.config import settings
from app.models import Invitation, Membership, Organization, Property, Unit

PLANS: dict[str, dict] = {
    "free": {"unit_limit": 3, "seat_limit": 2, "price_cents_per_unit": 0},
    "pro": {"unit_limit": None, "seat_limit": 10, "price_cents_per_unit": 200},
    "business": {"unit_limit": None, "seat_limit": None, "price_cents_per_unit": 300},
}
PAID_PLANS = ("pro", "business")
GOOD_STANDING = ("active", "trialing")


def price_id(plan: str) -> str:
    return {"pro": settings.stripe_price_pro, "business": settings.stripe_price_business}.get(plan, "")


def plan_for_price(price: str | None) -> str | None:
    if not price:
        return None
    for plan in PAID_PLANS:
        if price_id(plan) == price:
            return plan
    return None


def effective_plan(org: Organization) -> str:
    """Plan whose limits apply right now (paid plans fall back to free if the subscription lapses)."""
    if org.plan_comped:
        return org.plan if org.plan in PLANS else "business"
    if org.plan in PAID_PLANS and org.subscription_status in GOOD_STANDING:
        return org.plan
    return "free"


def unit_count(session: Session, org_id: uuid.UUID) -> int:
    return int(
        session.exec(
            select(func.count()).select_from(Unit).join(Property, Property.id == Unit.property_id).where(Unit.org_id == org_id, Property.archived_at.is_(None))
        ).one()
    )


def seat_count(session: Session, org_id: uuid.UUID) -> int:
    members = session.exec(select(func.count()).select_from(Membership).where(Membership.org_id == org_id, Membership.role != "tenant")).one()
    invites = session.exec(
        select(func.count()).select_from(Invitation).where(Invitation.org_id == org_id, Invitation.role != "tenant", Invitation.accepted_at.is_(None))
    ).one()
    return int(members) + int(invites)


def usage(session: Session, org: Organization) -> dict:
    plan = effective_plan(org)
    limits = PLANS[plan]
    return {
        "plan": plan,
        "billing_active": settings.billing_active,
        "subscription_status": org.subscription_status,
        "current_period_end": org.current_period_end,
        "comped": org.plan_comped,
        "units": unit_count(session, org.id),
        "unit_limit": limits["unit_limit"] if settings.billing_active else None,
        "seats": seat_count(session, org.id),
        "seat_limit": limits["seat_limit"] if settings.billing_active else None,
    }


def check_unit_limit(session: Session, org: Organization, adding: int = 1) -> None:
    if not settings.billing_active:
        return
    limit = PLANS[effective_plan(org)]["unit_limit"]
    if limit is not None and unit_count(session, org.id) + adding > limit:
        raise HTTPException(status_code=402, detail=f"Your plan includes up to {limit} units. Upgrade in Settings → Billing to add more.")


def check_seat_limit(session: Session, org: Organization) -> None:
    if not settings.billing_active:
        return
    limit = PLANS[effective_plan(org)]["seat_limit"]
    if limit is not None and seat_count(session, org.id) + 1 > limit:
        raise HTTPException(status_code=402, detail=f"Your plan includes up to {limit} team members. Upgrade in Settings → Billing to invite more.")


def public_plans() -> list[dict]:
    return [{"id": k, **v} for k, v in PLANS.items()]


# ── Webhook handling (called from online_payments.handle_event) ──────────────


def apply_subscription(session: Session, sub: dict) -> str:
    org = None
    org_id = (sub.get("metadata") or {}).get("org_id")
    if org_id:
        try:
            org = session.get(Organization, uuid.UUID(org_id))
        except ValueError:
            org = None
    if not org and sub.get("customer"):
        org = session.exec(select(Organization).where(Organization.billing_customer_id == sub["customer"])).first()
    if not org:
        return "ignored"
    items = ((sub.get("items") or {}).get("data")) or []
    plan = plan_for_price(((items[0].get("price") or {}).get("id")) if items else None)
    status = sub.get("status") or "none"
    if status in ("canceled", "incomplete_expired"):
        org.subscription_id = None
        org.subscription_status = "canceled"
        if not org.plan_comped:
            org.plan = "free"
    else:
        org.subscription_id = sub.get("id")
        org.subscription_status = status
        if plan and not org.plan_comped:
            org.plan = plan
    period_end = sub.get("current_period_end") or (items[0].get("current_period_end") if items else None)
    if period_end:
        org.current_period_end = datetime.fromtimestamp(int(period_end), tz=timezone.utc)
    session.add(org)
    return f"subscription_{org.subscription_status}"


def sync_quantity(session: Session, org: Organization) -> bool:
    """Keep the subscription's unit quantity equal to the org's active units (daily job)."""
    if not settings.billing_active or not org.subscription_id or org.subscription_status not in GOOD_STANDING:
        return False
    from app.services import stripe_gateway as gateway

    return gateway.set_subscription_quantity(org.subscription_id, max(unit_count(session, org.id), 1))
