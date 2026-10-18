"""Online rent payments: rules, Checkout, autopay and Stripe webhook handling.

Ledger rules:
  • Only *succeeded* payments are in the ledger. ACH payments sit as
    "processing" (visible, not credited) until the bank confirms — 4–5 business days.
  • A payment that later fails, is refunded or disputed is reversed with a
    `payment_reversal` entry, plus the owner's returned-payment fee if set.
  • Every webhook event is applied once (`stripe_events`), and every ledger
    entry carries a `source_key`, so Stripe's retries never double-post.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core import audit
from app.core.config import settings
from app.core.dates import period_of, today_in
from app.core.email import esc, layout
from app.models import (
    AutopayEnrollment,
    Lease,
    LeaseTenant,
    LedgerEntry,
    Organization,
    Payment,
    StripeEvent,
    Tenant,
    Unit,
    Property,
    utcnow,
)
from app.services import billing
from app.services import stripe_gateway as gateway
from app.services.notify import notify, staff_recipients
from app.services.receipts import money

logger = logging.getLogger(__name__)


# ── Rules ────────────────────────────────────────────────────────────────────


def card_fee(amount_cents: int) -> int:
    return round(amount_cents * settings.stripe_card_fee_bps / 10_000) + settings.stripe_card_fee_fixed_cents


def org_accepts_online(org: Organization) -> bool:
    return settings.stripe_enabled and org.online_payments_enabled and bool(org.stripe_account_id) and org.stripe_charges_enabled


def check_can_pay(org: Organization, lease: Lease) -> None:
    if not org_accepts_online(org):
        raise HTTPException(status_code=400, detail="Online payments aren't available for this property.")
    if lease.block_online_payments:
        raise HTTPException(status_code=400, detail="Online payments are turned off for this lease. Please contact your landlord.")
    if lease.status != "active":
        raise HTTPException(status_code=400, detail="This lease has ended. Please contact your landlord to settle the balance.")


def validate_amount(org: Organization, balance_cents: int, amount_cents: int) -> None:
    if balance_cents <= 0:
        raise HTTPException(status_code=400, detail="There's no balance to pay right now.")
    if amount_cents <= 0 or amount_cents > balance_cents:
        raise HTTPException(status_code=422, detail=f"Enter an amount up to your balance of {money(balance_cents)}.")
    if not org.allow_partial_payments and amount_cents != balance_cents:
        raise HTTPException(status_code=422, detail=f"Partial payments aren't accepted — please pay the full balance of {money(balance_cents)}.")


def lease_label(session: Session, lease: Lease) -> str:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id) if unit else None
    return f"{prop.name if prop else 'Rent'} — {unit.name if unit else ''}".strip(" —")


def ensure_customer(session: Session, tenant: Tenant) -> str:
    if not tenant.stripe_customer_id:
        tenant.stripe_customer_id = gateway.create_customer(
            tenant.email, f"{tenant.first_name} {tenant.last_name}", {"tenant_id": str(tenant.id), "org_id": str(tenant.org_id)}
        )
        session.add(tenant)
        session.commit()
    return tenant.stripe_customer_id


def pending_cents(session: Session, lease_id: uuid.UUID) -> int:
    """Online payments still processing — shown to tenants so they don't pay twice."""
    rows = session.exec(select(Payment).where(Payment.lease_id == lease_id, Payment.status == "processing")).all()
    return sum(p.amount_cents for p in rows)


# ── Checkout (one-off payment) ───────────────────────────────────────────────


def start_checkout(session: Session, org: Organization, lease: Lease, tenant: Tenant, amount_cents: int, method: str) -> str:
    check_can_pay(org, lease)
    payable = billing.lease_balance(session, lease.id) - pending_cents(session, lease.id)
    validate_amount(org, payable, amount_cents)
    fee = card_fee(amount_cents) if (method == "card" and org.pass_card_fee) else 0
    customer = ensure_customer(session, tenant)
    metadata = {
        "org_id": str(org.id),
        "lease_id": str(lease.id),
        "tenant_id": str(tenant.id),
        "rent_cents": str(amount_cents),
        "fee_cents": str(fee),
        "source": "online",
    }
    _, url = gateway.checkout_payment(
        customer_id=customer,
        destination=org.stripe_account_id,
        method=method,
        rent_cents=amount_cents,
        fee_cents=fee,
        description=f"Rent payment — {lease_label(session, lease)}",
        metadata=metadata,
        success_url=f"{settings.frontend_url}/portal?payment=success",
        cancel_url=f"{settings.frontend_url}/portal?payment=cancelled",
    )
    return url


# ── Autopay ──────────────────────────────────────────────────────────────────


def start_autopay_setup(session: Session, org: Organization, lease: Lease, tenant: Tenant) -> str:
    check_can_pay(org, lease)
    customer = ensure_customer(session, tenant)
    _, url = gateway.checkout_setup(
        customer_id=customer,
        metadata={"purpose": "autopay", "org_id": str(org.id), "lease_id": str(lease.id), "tenant_id": str(tenant.id)},
        success_url=f"{settings.frontend_url}/portal?autopay=on",
        cancel_url=f"{settings.frontend_url}/portal?autopay=cancelled",
    )
    return url


def run_autopay_for_org(session: Session, org: Organization, today=None) -> int:
    """Charge enrolled tenants on their due date (after rent has posted). Returns charges started."""
    if not org_accepts_online(org):
        return 0
    today = today or today_in(org.timezone)
    started = 0
    enrollments = session.exec(select(AutopayEnrollment).where(AutopayEnrollment.org_id == org.id, AutopayEnrollment.active == True)).all()  # noqa: E712
    for e in enrollments:
        lease = session.get(Lease, e.lease_id)
        if not lease or lease.status != "active" or lease.block_online_payments:
            continue
        dues = billing.due_dates(lease, today)
        if not dues or dues[-1] != today:
            continue  # only on the due date itself
        amount = billing.lease_balance(session, lease.id) - pending_cents(session, lease.id)
        if amount <= 0:
            continue
        fee = card_fee(amount) if (e.method_type == "card" and org.pass_card_fee) else 0
        period = period_of(today)
        try:
            gateway.charge_saved_method(
                customer_id=e.stripe_customer_id,
                payment_method_id=e.stripe_payment_method_id,
                destination=org.stripe_account_id,
                amount_cents=amount + fee,
                description=f"Autopay rent — {lease_label(session, lease)} ({today.strftime('%B %Y')})",
                metadata={
                    "org_id": str(org.id),
                    "lease_id": str(lease.id),
                    "tenant_id": str(e.tenant_id),
                    "rent_cents": str(amount),
                    "fee_cents": str(fee),
                    "source": "autopay",
                },
                # Same key for the same lease+period → Stripe never charges twice, even if the cron reruns.
                idempotency_key=f"autopay:{lease.id}:{period}",
            )
            started += 1
        except Exception as exc:  # noqa: BLE001 — card declines etc. arrive here for off-session charges
            logger.warning("Autopay charge failed for lease %s: %s", lease.id, exc)
            _notify_failure(session, org, lease, e.tenant_id, amount, "Your saved payment method was declined.")
    return started


# ── Webhooks ─────────────────────────────────────────────────────────────────


def handle_event(session: Session, event: dict[str, Any]) -> str:
    """Apply one Stripe event exactly once. Returns a short outcome for logging/tests."""
    if session.get(StripeEvent, event["id"]):
        return "duplicate"
    kind = event["type"]
    obj = event["data"]["object"]
    handlers = {
        "payment_intent.processing": _pi_processing,
        "payment_intent.succeeded": _pi_succeeded,
        "payment_intent.payment_failed": _pi_failed,
        "charge.refunded": _charge_reversed,
        "charge.dispute.created": _charge_reversed,
        "checkout.session.completed": _checkout_completed,
        "account.updated": _account_updated,
        "customer.subscription.created": _subscription,
        "customer.subscription.updated": _subscription,
        "customer.subscription.deleted": _subscription,
    }
    handler = handlers.get(kind)
    outcome = handler(session, obj) if handler else "ignored"
    session.add(StripeEvent(id=event["id"], event_type=kind))
    try:
        session.commit()
    except IntegrityError:  # a concurrent delivery got there first
        session.rollback()
        return "duplicate"
    return outcome


def _meta(obj: dict) -> dict[str, str]:
    return obj.get("metadata") or {}


def _org_for(session: Session, meta: dict) -> Organization | None:
    try:
        return session.get(Organization, uuid.UUID(meta["org_id"]))
    except (KeyError, ValueError):
        return None


def _upsert_payment(session: Session, pi: dict, status: str) -> Payment | None:
    meta = _meta(pi)
    org = _org_for(session, meta)
    if not org or meta.get("source") not in ("online", "autopay"):
        return None  # not ours (e.g. some other platform charge)
    payment = session.exec(select(Payment).where(Payment.stripe_payment_intent_id == pi["id"])).first()
    if payment:
        return payment
    lease = session.get(Lease, uuid.UUID(meta["lease_id"]))
    if not lease or lease.org_id != org.id:
        return None
    method = (pi.get("payment_method_types") or ["card"])[0]
    today = today_in(org.timezone)
    payment = Payment(
        org_id=org.id,
        lease_id=lease.id,
        tenant_id=uuid.UUID(meta["tenant_id"]) if meta.get("tenant_id") else None,
        receipt_number=billing.next_receipt_number(session, org.id, today),
        method="bank_transfer" if method == "us_bank_account" else "card",
        amount_cents=int(meta.get("rent_cents") or pi.get("amount", 0)),
        fee_cents=int(meta.get("fee_cents") or 0),
        received_on=today,
        reference=pi["id"],
        status=status,
        source=meta["source"],
        stripe_payment_intent_id=pi["id"],
    )
    session.add(payment)
    session.flush()
    return payment


def _pi_processing(session: Session, pi: dict) -> str:
    p = _upsert_payment(session, pi, "processing")
    return "processing" if p else "ignored"


def _pi_succeeded(session: Session, pi: dict) -> str:
    p = _upsert_payment(session, pi, "succeeded")
    if not p:
        return "ignored"
    if p.status in ("reversed",):
        return "already_reversed"
    org = session.get(Organization, p.org_id)
    p.status = "succeeded"
    p.received_on = today_in(org.timezone)
    session.add(p)
    if not session.exec(select(LedgerEntry.id).where(LedgerEntry.source_key == f"stripe:{pi['id']}")).first():
        label = "Autopay" if p.source == "autopay" else "Online payment"
        session.add(
            LedgerEntry(
                org_id=p.org_id,
                lease_id=p.lease_id,
                entry_type="payment",
                description=f"{label} — {'bank transfer' if p.method == 'bank_transfer' else 'card'}",
                amount_cents=-p.amount_cents,
                entry_date=p.received_on,
                payment_id=p.id,
                source_key=f"stripe:{pi['id']}",
            )
        )
    audit.record(session, p.org_id, None, "payment", p.id, "online_succeeded", f"{p.source.title()} payment {money(p.amount_cents)} succeeded ({p.receipt_number})")
    session.flush()
    from app.routers.leases import send_receipt  # local import: router module depends on services

    session.commit()
    send_receipt(session, org, p)
    return "succeeded"


def _pi_failed(session: Session, pi: dict) -> str:
    p = _upsert_payment(session, pi, "failed")
    if not p:
        return "ignored"
    reason = ((pi.get("last_payment_error") or {}).get("message")) or "The payment didn't go through."
    was_succeeded = p.status == "succeeded"
    p.status = "failed"
    p.failure_reason = reason[:300]
    session.add(p)
    org = session.get(Organization, p.org_id)
    lease = session.get(Lease, p.lease_id)
    if was_succeeded:
        _reverse(session, org, p, reason)
    audit.record(session, p.org_id, None, "payment", p.id, "online_failed", f"Online payment {money(p.amount_cents)} failed: {reason}")
    session.commit()
    _notify_failure(session, org, lease, p.tenant_id, p.amount_cents, reason)
    return "failed"


def _charge_reversed(session: Session, charge: dict) -> str:
    pi_id = charge.get("payment_intent")
    p = session.exec(select(Payment).where(Payment.stripe_payment_intent_id == pi_id)).first() if pi_id else None
    if not p or p.status != "succeeded":
        return "ignored"
    org = session.get(Organization, p.org_id)
    lease = session.get(Lease, p.lease_id)
    reason = "Refunded" if charge.get("object") == "charge" and charge.get("refunded") else "Returned or disputed by the bank"
    _reverse(session, org, p, reason)
    audit.record(session, p.org_id, None, "payment", p.id, "online_reversed", f"Payment {p.receipt_number} reversed: {reason}")
    session.commit()
    _notify_failure(session, org, lease, p.tenant_id, p.amount_cents, f"Your payment of {money(p.amount_cents)} was reversed ({reason}).")
    return "reversed"


def _reverse(session: Session, org: Organization, p: Payment, reason: str) -> None:
    p.status = "reversed"
    p.failure_reason = reason[:300]
    session.add(p)
    today = today_in(org.timezone)
    for entry in (
        LedgerEntry(
            org_id=p.org_id,
            lease_id=p.lease_id,
            entry_type="payment_reversal",
            description=f"Payment reversed — {p.receipt_number} ({reason})"[:200],
            amount_cents=p.amount_cents,
            entry_date=today,
            payment_id=p.id,
            source_key=f"reversal:{p.stripe_payment_intent_id}",
        ),
        LedgerEntry(
            org_id=p.org_id,
            lease_id=p.lease_id,
            entry_type="returned_fee",
            description=f"Returned payment fee — {p.receipt_number}",
            amount_cents=org.returned_payment_fee_cents,
            entry_date=today,
            source_key=f"retfee:{p.stripe_payment_intent_id}",
        )
        if org.returned_payment_fee_cents > 0
        else None,
    ):
        if entry and not session.exec(select(LedgerEntry.id).where(LedgerEntry.source_key == entry.source_key)).first():
            session.add(entry)


def _checkout_completed(session: Session, cs: dict) -> str:
    meta = _meta(cs)
    if meta.get("purpose") == "application_fee":
        from app.routers.listings import application_fee_paid

        return application_fee_paid(session, cs)
    if cs.get("mode") != "setup" or meta.get("purpose") != "autopay":
        return "ignored"  # payment sessions are handled through payment_intent.* events
    org = _org_for(session, meta)
    if not org or not cs.get("setup_intent"):
        return "ignored"
    pm = gateway.setup_intent_payment_method(cs["setup_intent"])
    lease_id, tenant_id = uuid.UUID(meta["lease_id"]), uuid.UUID(meta["tenant_id"])
    e = session.exec(select(AutopayEnrollment).where(AutopayEnrollment.lease_id == lease_id, AutopayEnrollment.tenant_id == tenant_id)).first()
    if not e:
        e = AutopayEnrollment(org_id=org.id, lease_id=lease_id, tenant_id=tenant_id, stripe_customer_id=cs["customer"], stripe_payment_method_id=pm["id"], method_type=pm["type"])
    e.stripe_customer_id = cs["customer"]
    e.stripe_payment_method_id = pm["id"]
    e.method_type = pm["type"]
    e.method_label = pm["label"][:60]
    e.active = True
    e.updated_at = utcnow()
    session.add(e)
    audit.record(session, org.id, None, "lease", lease_id, "autopay_on", f"Autopay enabled ({pm['label']})")
    return "autopay_enabled"


def _subscription(session: Session, sub: dict) -> str:
    from app.services.plans import apply_subscription

    return apply_subscription(session, sub)


def _account_updated(session: Session, account: dict) -> str:
    org = session.exec(select(Organization).where(Organization.stripe_account_id == account["id"])).first()
    if not org:
        return "ignored"
    org.stripe_charges_enabled = bool(account.get("charges_enabled"))
    org.stripe_payouts_enabled = bool(account.get("payouts_enabled"))
    org.stripe_details_submitted = bool(account.get("details_submitted"))
    session.add(org)
    return "account_updated"


# ── Notifications ────────────────────────────────────────────────────────────


def _notify_failure(session: Session, org: Organization, lease: Lease | None, tenant_id, amount_cents: int, reason: str) -> None:
    label = lease_label(session, lease) if lease else "your lease"
    subject = f"Payment problem — {label}"
    body = f"<p>A payment of <strong>{money(amount_cents)}</strong> for {esc(label)} didn't go through.</p><p>{esc(reason)}</p>"
    tenant = session.get(Tenant, tenant_id) if tenant_id else None
    if tenant and tenant.email:
        notify(session, org.id, "payment_failed", tenant.email, subject, layout("Payment didn't go through", body, "Open your portal", f"{settings.frontend_url}/portal"))
    for email in staff_recipients(session, org.id, "rent_reminders"):
        notify(session, org.id, "payment_failed", email, subject, layout("Tenant payment failed", body))


def tenant_lease_ids(session: Session, user_id: uuid.UUID, org_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    """lease_id → tenant_id for the signed-in tenant."""
    tenants = session.exec(select(Tenant).where(Tenant.org_id == org_id, Tenant.user_id == user_id)).all()
    ids = {t.id for t in tenants}
    if not ids:
        return {}
    return {lt.lease_id: lt.tenant_id for lt in session.exec(select(LeaseTenant).where(LeaseTenant.tenant_id.in_(ids))).all()}

