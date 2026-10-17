import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import select

from app.core import audit
from app.core.dates import today_in
from app.core.deps import Ctx, finance_read, get_owned, staff, writer
from app.core.email import Attachment, esc, layout
from app.models import (
    Lease,
    LeaseTenant,
    LedgerEntry,
    Payment,
    Property,
    RecurringCharge,
    Tenant,
    Unit,
    utcnow,
)
from app.schemas import LeaseEndIn, LeaseIn, LeaseUpdate, LedgerAdjustmentIn, PaymentIn, RecurringChargeIn
from app.services import billing
from app.services.notify import notify
from app.services.receipts import money, receipt_pdf

router = APIRouter(tags=["leases"])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _validate_tenants(ctx: Ctx, tenant_ids: list[uuid.UUID]) -> list[Tenant]:
    tenants = ctx.session.exec(select(Tenant).where(Tenant.id.in_(tenant_ids), Tenant.org_id == ctx.org_id)).all()
    if len(tenants) != len(set(tenant_ids)):
        raise HTTPException(status_code=400, detail="One or more tenants were not found.")
    return list(tenants)


def _check_overlap(ctx: Ctx, unit_id: uuid.UUID, start: date, end: date | None, exclude: uuid.UUID | None = None) -> None:
    q = select(Lease).where(Lease.unit_id == unit_id, Lease.status == "active")
    if exclude:
        q = q.where(Lease.id != exclude)
    for other in ctx.session.exec(q).all():
        other_end = other.ended_on or other.end_date
        if (other_end is None or start <= other_end) and (end is None or other.start_date <= end):
            raise HTTPException(
                status_code=409,
                detail="This unit already has an active lease for those dates. End that lease first.",
            )


def lease_tenants(session, lease_id: uuid.UUID) -> list[dict]:
    rows = session.exec(
        select(Tenant, LeaseTenant.is_primary).join(LeaseTenant, LeaseTenant.tenant_id == Tenant.id).where(LeaseTenant.lease_id == lease_id)
    ).all()
    return [
        {"id": str(t.id), "name": f"{t.first_name} {t.last_name}", "email": t.email, "phone": t.phone, "is_primary": p}
        for t, p in sorted(rows, key=lambda r: not r[1])
    ]


def lease_detail(session, lease: Lease) -> dict:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id)
    charges = session.exec(select(RecurringCharge).where(RecurringCharge.lease_id == lease.id)).all()
    tenants = lease_tenants(session, lease.id)
    return {
        **lease.model_dump(),
        "unit": {"id": str(unit.id), "name": unit.name},
        "property": {"id": str(prop.id), "name": prop.name, "address": f"{prop.address_line1}, {prop.city}, {prop.state} {prop.postal_code}"},
        "tenants": tenants,
        "recurring_charges": charges,
        "balance_cents": billing.lease_balance(session, lease.id),
        "monthly_total_cents": lease.rent_cents + sum(c.amount_cents for c in charges),
    }


def ledger_rows(session, lease_id: uuid.UUID) -> list[dict]:
    entries = session.exec(
        select(LedgerEntry).where(LedgerEntry.lease_id == lease_id).order_by(LedgerEntry.entry_date, LedgerEntry.created_at)
    ).all()
    running = 0
    out = []
    for e in entries:
        running += e.amount_cents
        out.append({**e.model_dump(), "balance_cents": running})
    return out


# ── Leases ───────────────────────────────────────────────────────────────────


@router.get("/leases")
def list_leases(status: str | None = None, unit_id: uuid.UUID | None = None, ctx: Ctx = Depends(staff)):
    q = (
        select(Lease, Unit.name, Property.name, Property.id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .where(Lease.org_id == ctx.org_id)
    )
    if status:
        q = q.where(Lease.status == status)
    if unit_id:
        q = q.where(Lease.unit_id == unit_id)
    rows = ctx.session.exec(q.order_by(Lease.status, Lease.start_date.desc())).all()
    balances = billing.balances_for(ctx.session, [r[0].id for r in rows])
    out = []
    for lease, unit_name, prop_name, prop_id in rows:
        out.append(
            {
                **lease.model_dump(),
                "unit_name": unit_name,
                "property_name": prop_name,
                "property_id": str(prop_id),
                "tenants": lease_tenants(ctx.session, lease.id),
                "balance_cents": balances.get(lease.id, 0),
            }
        )
    return out


@router.post("/leases", status_code=201)
def create_lease(payload: LeaseIn, ctx: Ctx = Depends(writer)):
    unit = get_owned(ctx, Unit, payload.unit_id, "Unit")
    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="End date must be after the start date.")
    if payload.late_fee_type == "percent" and payload.late_fee_amount > 10_000:
        raise HTTPException(status_code=422, detail="Late fee percentage can't exceed 100%.")
    tenants = _validate_tenants(ctx, payload.tenant_ids)
    _check_overlap(ctx, unit.id, payload.start_date, payload.end_date)

    today = today_in(ctx.org.timezone)
    charges_start = payload.charges_start_on or max(payload.start_date, today)
    lease = Lease(
        org_id=ctx.org_id,
        unit_id=unit.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        rent_cents=payload.rent_cents,
        due_day=payload.due_day,
        deposit_cents=payload.deposit_cents,
        late_fee_type=payload.late_fee_type,
        late_fee_amount=payload.late_fee_amount,
        grace_days=payload.grace_days,
        charges_start_on=charges_start,
        notes=payload.notes,
    )
    ctx.session.add(lease)
    ctx.session.flush()
    primary = payload.primary_tenant_id or payload.tenant_ids[0]
    for t in tenants:
        ctx.session.add(LeaseTenant(lease_id=lease.id, tenant_id=t.id, is_primary=t.id == primary))
    for c in payload.recurring_charges:
        ctx.session.add(RecurringCharge(org_id=ctx.org_id, lease_id=lease.id, **c.model_dump()))
    if payload.opening_balance_cents:
        ctx.session.add(
            LedgerEntry(
                org_id=ctx.org_id,
                lease_id=lease.id,
                entry_type="opening_balance",
                description="Opening balance",
                amount_cents=payload.opening_balance_cents,
                entry_date=min(today, charges_start),
                source_key=f"opening:{lease.id}",
                created_by_user_id=ctx.user.id,
            )
        )
    ctx.session.flush()
    billing.sync_unit_status(ctx.session, unit.id)
    billing.post_rent_for_lease(ctx.session, lease, today)
    names = ", ".join(f"{t.first_name} {t.last_name}" for t in tenants)
    audit.log(ctx, "lease", lease.id, "create", f"Created lease for {unit.name} ({names})")
    ctx.session.commit()
    ctx.session.refresh(lease)
    return lease_detail(ctx.session, lease)


@router.get("/leases/{lease_id}")
def get_lease(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    return lease_detail(ctx.session, get_owned(ctx, Lease, lease_id, "Lease"))


@router.patch("/leases/{lease_id}")
def update_lease(lease_id: uuid.UUID, payload: LeaseUpdate, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    before = lease.model_dump()
    data = payload.model_dump(exclude_unset=True)
    tenant_ids = data.pop("tenant_ids", None)
    if "end_date" in data:
        if data["end_date"] and data["end_date"] < lease.start_date:
            raise HTTPException(status_code=422, detail="End date must be after the start date.")
        if lease.status == "active":
            _check_overlap(ctx, lease.unit_id, lease.start_date, data["end_date"], exclude=lease.id)
    for k, v in data.items():
        if v is None and k not in ("end_date", "notes"):
            continue
        setattr(lease, k, v)
    if lease.late_fee_type == "percent" and lease.late_fee_amount > 10_000:
        raise HTTPException(status_code=422, detail="Late fee percentage can't exceed 100%.")
    if tenant_ids is not None:
        _validate_tenants(ctx, tenant_ids)
        existing = ctx.session.exec(select(LeaseTenant).where(LeaseTenant.lease_id == lease.id)).all()
        primary = next((lt.tenant_id for lt in existing if lt.is_primary), None)
        for lt in existing:
            ctx.session.delete(lt)
        ctx.session.flush()
        primary = primary if primary in tenant_ids else tenant_ids[0]
        for tid in dict.fromkeys(tenant_ids):
            ctx.session.add(LeaseTenant(lease_id=lease.id, tenant_id=tid, is_primary=tid == primary))
    lease.updated_at = utcnow()
    ctx.session.add(lease)
    audit.log(ctx, "lease", lease.id, "update", "Updated lease terms", audit.diff(before, lease.model_dump()))
    ctx.session.commit()
    ctx.session.refresh(lease)
    return lease_detail(ctx.session, lease)


@router.post("/leases/{lease_id}/end")
def end_lease(lease_id: uuid.UUID, payload: LeaseEndIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    if lease.status != "active":
        raise HTTPException(status_code=400, detail="This lease has already ended.")
    if payload.ended_on < lease.start_date:
        raise HTTPException(status_code=422, detail="End date can't be before the lease start.")
    lease.status = "ended"
    lease.ended_on = payload.ended_on
    lease.updated_at = utcnow()
    ctx.session.add(lease)
    ctx.session.flush()
    billing.sync_unit_status(ctx.session, lease.unit_id)
    audit.log(ctx, "lease", lease.id, "end", f"Lease ended on {payload.ended_on}")
    ctx.session.commit()
    return lease_detail(ctx.session, lease)


@router.delete("/leases/{lease_id}")
def delete_lease(lease_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Remove a lease entered by mistake. Leases with payments must be ended instead."""
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    if ctx.session.exec(select(Payment.id).where(Payment.lease_id == lease.id)).first():
        raise HTTPException(status_code=400, detail="This lease has payments. End it instead of deleting.")
    for model in (LedgerEntry, RecurringCharge, LeaseTenant):
        for row in ctx.session.exec(select(model).where(model.lease_id == lease.id)).all():
            ctx.session.delete(row)
    ctx.session.flush()
    unit_id = lease.unit_id
    ctx.session.delete(lease)
    ctx.session.flush()
    billing.sync_unit_status(ctx.session, unit_id)
    audit.log(ctx, "lease", lease_id, "delete", "Deleted lease")
    ctx.session.commit()
    return {"ok": True}


# ── Recurring charges ────────────────────────────────────────────────────────


@router.post("/leases/{lease_id}/charges", status_code=201)
def add_recurring_charge(lease_id: uuid.UUID, payload: RecurringChargeIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    charge = RecurringCharge(org_id=ctx.org_id, lease_id=lease.id, **payload.model_dump())
    ctx.session.add(charge)
    audit.log(ctx, "lease", lease.id, "add_charge", f"Added recurring charge {payload.description} {money(payload.amount_cents)}")
    ctx.session.commit()
    ctx.session.refresh(charge)
    return charge


@router.delete("/leases/{lease_id}/charges/{charge_id}")
def delete_recurring_charge(lease_id: uuid.UUID, charge_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    charge = get_owned(ctx, RecurringCharge, charge_id, "Charge")
    if charge.lease_id != lease_id:
        raise HTTPException(status_code=404, detail="Charge not found")
    ctx.session.delete(charge)
    audit.log(ctx, "lease", lease_id, "remove_charge", f"Removed recurring charge {charge.description}")
    ctx.session.commit()
    return {"ok": True}


# ── Ledger ───────────────────────────────────────────────────────────────────


@router.get("/leases/{lease_id}/ledger")
def get_ledger(lease_id: uuid.UUID, ctx: Ctx = Depends(finance_read)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    return ledger_rows(ctx.session, lease.id)


@router.post("/leases/{lease_id}/ledger", status_code=201)
def add_ledger_entry(lease_id: uuid.UUID, payload: LedgerAdjustmentIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    amount = payload.amount_cents
    if payload.entry_type == "charge":
        amount = abs(amount)
    elif payload.entry_type == "credit":
        amount = -abs(amount)
    entry = LedgerEntry(
        org_id=ctx.org_id,
        lease_id=lease.id,
        entry_type=payload.entry_type,
        description=payload.description,
        amount_cents=amount,
        entry_date=payload.entry_date,
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(entry)
    audit.log(ctx, "lease", lease.id, f"ledger_{payload.entry_type}", f"{payload.description} {money(amount)}")
    ctx.session.commit()
    ctx.session.refresh(entry)
    return entry


@router.delete("/leases/{lease_id}/ledger/{entry_id}")
def delete_ledger_entry(lease_id: uuid.UUID, entry_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    entry = get_owned(ctx, LedgerEntry, entry_id, "Entry")
    if entry.lease_id != lease_id:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.payment_id:
        raise HTTPException(status_code=400, detail="Void the payment instead of deleting its ledger entry.")
    if entry.source_key and entry.entry_type in ("rent", "recurring", "late_fee"):
        # Keep the idempotency key so the cron doesn't re-post it; zero it out with a reversal instead.
        reversal = LedgerEntry(
            org_id=ctx.org_id,
            lease_id=lease_id,
            entry_type="adjustment",
            description=f"Reversal — {entry.description}",
            amount_cents=-entry.amount_cents,
            entry_date=today_in(ctx.org.timezone),
            created_by_user_id=ctx.user.id,
        )
        ctx.session.add(reversal)
        audit.log(ctx, "lease", lease_id, "ledger_reverse", f"Reversed {entry.description}")
    else:
        ctx.session.delete(entry)
        audit.log(ctx, "lease", lease_id, "ledger_delete", f"Deleted {entry.description}")
    ctx.session.commit()
    return {"ok": True}


# ── Payments ─────────────────────────────────────────────────────────────────


def _receipt_bytes(session, org, payment: Payment) -> bytes:
    lease = session.get(Lease, payment.lease_id)
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id)
    tenant = session.get(Tenant, payment.tenant_id) if payment.tenant_id else None
    balance_after = billing.lease_balance(session, lease.id, as_of=payment.received_on)
    return receipt_pdf(org, payment, lease, unit, prop, tenant, balance_after)


def send_receipt(session, org, payment: Payment) -> bool:
    if not payment.tenant_id:
        return False
    tenant = session.get(Tenant, payment.tenant_id)
    if not tenant or not tenant.email:
        return False
    pdf = _receipt_bytes(session, org, payment)
    subject = f"Payment received — {money(payment.amount_cents, org.currency)}"
    html = layout(
        "Payment received",
        f"<p>Hi {esc(tenant.first_name)}, we received your payment of "
        f"<strong>{money(payment.amount_cents, org.currency)}</strong> on {payment.received_on.strftime('%B %d, %Y')}.</p>"
        f"<p>Receipt #{esc(payment.receipt_number)} is attached.</p>",
    )
    return notify(
        session,
        org.id,
        "payment_receipt",
        tenant.email,
        subject,
        html,
        dedupe_key=f"receipt:{payment.id}",
        attachments=[Attachment(f"receipt-{payment.receipt_number}.pdf", pdf)],
    )


@router.get("/payments")
def list_payments(lease_id: uuid.UUID | None = None, ctx: Ctx = Depends(finance_read)):
    q = (
        select(Payment, Unit.name, Property.name, Tenant.first_name, Tenant.last_name)
        .join(Lease, Lease.id == Payment.lease_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .outerjoin(Tenant, Tenant.id == Payment.tenant_id)
        .where(Payment.org_id == ctx.org_id)
    )
    if lease_id:
        q = q.where(Payment.lease_id == lease_id)
    rows = ctx.session.exec(q.order_by(Payment.received_on.desc(), Payment.created_at.desc()).limit(500)).all()
    return [
        {
            **p.model_dump(),
            "unit_name": u,
            "property_name": pn,
            "tenant_name": f"{fn} {ln}" if fn else None,
        }
        for p, u, pn, fn, ln in rows
    ]


@router.post("/leases/{lease_id}/payments", status_code=201)
def create_payment(lease_id: uuid.UUID, payload: PaymentIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    tenant_id = payload.tenant_id
    lease_tenant_ids = [lt.tenant_id for lt in ctx.session.exec(select(LeaseTenant).where(LeaseTenant.lease_id == lease.id)).all()]
    if tenant_id and tenant_id not in lease_tenant_ids:
        raise HTTPException(status_code=400, detail="That tenant isn't on this lease.")
    if not tenant_id:
        primary = ctx.session.exec(
            select(LeaseTenant.tenant_id).where(LeaseTenant.lease_id == lease.id).order_by(LeaseTenant.is_primary.desc())
        ).first()
        tenant_id = primary
    payment = Payment(
        org_id=ctx.org_id,
        lease_id=lease.id,
        tenant_id=tenant_id,
        receipt_number=billing.next_receipt_number(ctx.session, ctx.org_id, payload.received_on),
        method=payload.method,
        amount_cents=payload.amount_cents,
        received_on=payload.received_on,
        reference=payload.reference,
        notes=payload.notes,
        created_by_user_id=ctx.user.id,
    )
    billing.record_payment(ctx.session, lease, payment)
    audit.log(ctx, "payment", payment.id, "create", f"Recorded {money(payment.amount_cents)} {payment.method} payment ({payment.receipt_number})")
    ctx.session.commit()
    ctx.session.refresh(payment)
    receipt_sent = send_receipt(ctx.session, ctx.org, payment) if payload.send_receipt else False
    return {**payment.model_dump(), "receipt_sent": receipt_sent, "balance_cents": billing.lease_balance(ctx.session, lease.id)}


@router.post("/payments/{payment_id}/void")
def void_payment(payment_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    payment = get_owned(ctx, Payment, payment_id, "Payment")
    if payment.voided_at:
        raise HTTPException(status_code=400, detail="This payment is already voided.")
    if payment.source != "manual":
        raise HTTPException(status_code=400, detail="Online payments can't be voided here — refund them in your Stripe dashboard instead.")
    payment.voided_at = utcnow()
    ctx.session.add(payment)
    for entry in ctx.session.exec(select(LedgerEntry).where(LedgerEntry.payment_id == payment.id)).all():
        ctx.session.delete(entry)
    audit.log(ctx, "payment", payment.id, "void", f"Voided payment {payment.receipt_number} ({money(payment.amount_cents)})")
    ctx.session.commit()
    return payment


@router.post("/payments/{payment_id}/send-receipt")
def resend_receipt(payment_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    payment = get_owned(ctx, Payment, payment_id, "Payment")
    if payment.voided_at:
        raise HTTPException(status_code=400, detail="This payment was voided.")
    # Explicit resend bypasses the dedupe key.
    tenant = ctx.session.get(Tenant, payment.tenant_id) if payment.tenant_id else None
    if not tenant or not tenant.email:
        raise HTTPException(status_code=400, detail="The tenant has no email address.")
    pdf = _receipt_bytes(ctx.session, ctx.org, payment)
    ok = notify(
        ctx.session,
        ctx.org_id,
        "payment_receipt",
        tenant.email,
        f"Payment receipt {payment.receipt_number}",
        layout("Payment receipt", f"<p>Receipt #{esc(payment.receipt_number)} is attached.</p>"),
        attachments=[Attachment(f"receipt-{payment.receipt_number}.pdf", pdf)],
    )
    return {"ok": ok}


def receipt_response(session, org, payment: Payment) -> Response:
    pdf = _receipt_bytes(session, org, payment)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receipt-{payment.receipt_number}.pdf"'},
    )


@router.get("/payments/{payment_id}/receipt.pdf")
def payment_receipt(payment_id: uuid.UUID, ctx: Ctx = Depends(finance_read)):
    payment = get_owned(ctx, Payment, payment_id, "Payment")
    return receipt_response(ctx.session, ctx.org, payment)

