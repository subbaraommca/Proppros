"""Plans, usage, subscription checkout and the Stripe billing portal; public plans + feedback."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core import audit
from app.core.config import settings
from app.core.database import get_session
from app.core.deps import Ctx, full_access, get_current_user
from app.core.email import esc, layout, send_email
from app.core.limiter import rate_limit
from app.models import Feedback, Membership, User
from app.services import plans
from app.services import stripe_gateway as gateway

router = APIRouter(tags=["billing"])
owner_full = full_access("owner")


class CheckoutIn(BaseModel):
    plan: Literal["pro", "business"]


class FeedbackIn(BaseModel):
    kind: Literal["bug", "idea", "question"] = "idea"
    message: str = Field(min_length=5, max_length=5000)
    page: str | None = Field(default=None, max_length=300)


@router.get("/public/plans")
def public_plans():
    return {"plans": plans.public_plans(), "billing_active": settings.billing_active}


@router.get("/billing")
def get_billing(ctx: Ctx = Depends(full_access("owner", "manager", "accountant"))):
    return {**plans.usage(ctx.session, ctx.org), "plans": plans.public_plans()}


@router.post("/billing/checkout")
def checkout(payload: CheckoutIn, ctx: Ctx = Depends(owner_full)):
    if not settings.billing_active:
        raise HTTPException(status_code=404, detail="Billing isn't enabled on this server.")
    price = plans.price_id(payload.plan)
    if not price:
        raise HTTPException(status_code=400, detail="That plan isn't available.")
    if ctx.org.subscription_id and ctx.org.subscription_status in plans.GOOD_STANDING:
        raise HTTPException(status_code=400, detail="You already have a subscription — change plans in the billing portal.")
    if not ctx.org.billing_customer_id:
        ctx.org.billing_customer_id = gateway.create_billing_customer(ctx.user.email, ctx.org.name, str(ctx.org.id))
        ctx.session.add(ctx.org)
        ctx.session.commit()
    url = gateway.checkout_subscription(
        customer_id=ctx.org.billing_customer_id,
        price_id=price,
        quantity=max(plans.unit_count(ctx.session, ctx.org.id), 1),
        org_id=str(ctx.org.id),
        success_url=f"{settings.frontend_url}/settings?tab=billing&checkout=success",
        cancel_url=f"{settings.frontend_url}/settings?tab=billing",
    )
    audit.log(ctx, "organization", ctx.org.id, "billing_checkout", f"Started checkout for the {payload.plan} plan")
    ctx.session.commit()
    return {"url": url}


@router.post("/billing/portal")
def portal(ctx: Ctx = Depends(owner_full)):
    if not settings.billing_active or not ctx.org.billing_customer_id:
        raise HTTPException(status_code=400, detail="There's no subscription to manage yet.")
    return {"url": gateway.billing_portal(ctx.org.billing_customer_id, f"{settings.frontend_url}/settings?tab=billing")}


@router.post("/feedback", status_code=201, dependencies=[Depends(rate_limit("feedback", 10, 3600))])
def submit_feedback(
    payload: FeedbackIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    x_org_id: str | None = Header(default=None),
):
    org_id = None
    if x_org_id:
        try:
            candidate = uuid.UUID(x_org_id)
            if session.exec(select(Membership.id).where(Membership.user_id == user.id, Membership.org_id == candidate)).first():
                org_id = candidate
        except ValueError:
            pass
    f = Feedback(user_id=user.id, org_id=org_id, kind=payload.kind, message=payload.message, page=payload.page)
    session.add(f)
    session.commit()
    recipients = [e.strip() for e in (settings.feedback_notify_email or settings.superadmin_emails).split(",") if e.strip()]
    if recipients:
        send_email(
            recipients,
            f"[Proppros feedback] {payload.kind}: {payload.message[:60]}",
            layout(f"New {payload.kind} from {user.name}", f"<p>{esc(payload.message)}</p><p class='muted'>{esc(user.email)} · {esc(payload.page or '')}</p>"),
        )
    return {"ok": True, "id": str(f.id)}

