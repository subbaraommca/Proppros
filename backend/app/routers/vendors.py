"""Vendors, quotes & invoices, preventive-maintenance schedules, assets, and keys/access codes."""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.core import audit
from app.core.dates import today_in
from app.core.deps import Ctx, get_owned, require_roles, staff, writer
from app.core.email import esc, layout
from app.models import (
    AccessItem,
    Asset,
    Document,
    Expense,
    MaintenanceSchedule,
    Membership,
    Organization,
    Property,
    Quote,
    Unit,
    Vendor,
    VendorInvoice,
    WorkOrder,
    utcnow,
)
from app.schemas import (
    AccessItemIn,
    AccessItemUpdate,
    AssetIn,
    AssetUpdate,
    InvoicePaidIn,
    QuoteIn,
    ScheduleIn,
    ScheduleUpdate,
    VendorIn,
    VendorInvoiceIn,
    VendorRatingIn,
    VendorUpdate,
    WorkOrderVendorIn,
)
from app.services import maintenance as mx
from app.services.notify import notify, staff_recipients
from app.services.receipts import money

router = APIRouter(tags=["vendors"])
code_readers = require_roles("owner", "manager", "maintenance")


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError("bad date")


def _check_location(ctx: Ctx, property_id: uuid.UUID, unit_id: uuid.UUID | None) -> None:
    get_owned(ctx, Property, property_id, "Property")
    if unit_id:
        unit = get_owned(ctx, Unit, unit_id, "Unit")
        if unit.property_id != property_id:
            raise HTTPException(status_code=400, detail="That unit doesn't belong to the selected property.")


def _vendor(ctx: Ctx, vendor_id: uuid.UUID | None) -> Vendor | None:
    if not vendor_id:
        return None
    v = ctx.session.get(Vendor, vendor_id)
    if not v or v.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


def _org_document(ctx: Ctx, document_id: uuid.UUID | None) -> None:
    if document_id:
        doc = ctx.session.get(Document, document_id)
        if not doc or doc.org_id != ctx.org_id:
            raise HTTPException(status_code=404, detail="Document not found")


# ── Vendors ──────────────────────────────────────────────────────────────────


def _ratings(session: Session, org_id: uuid.UUID) -> dict[uuid.UUID, tuple[float, int, int]]:
    """vendor → (average rating, ratings count, jobs count)."""
    rows = session.exec(
        select(WorkOrder.vendor_id, func.avg(WorkOrder.vendor_rating), func.count(WorkOrder.vendor_rating), func.count(WorkOrder.id))
        .where(WorkOrder.org_id == org_id, WorkOrder.vendor_id.is_not(None))
        .group_by(WorkOrder.vendor_id)
    ).all()
    return {vid: (round(float(avg), 1) if avg is not None else None, n, jobs) for vid, avg, n, jobs in rows}


def _vendor_out(v: Vendor, stats: tuple | None, today: date) -> dict:
    avg, n, jobs = stats or (None, 0, 0)
    ins = v.insurance_expires_on
    return {
        **v.model_dump(),
        "rating": avg,
        "rating_count": n,
        "job_count": jobs,
        "insurance_status": None if not ins else "expired" if ins < today else "expiring" if ins <= today + timedelta(days=30) else "ok",
    }


@router.get("/vendors")
def list_vendors(include_archived: bool = False, trade: str | None = None, ctx: Ctx = Depends(staff)):
    q = select(Vendor).where(Vendor.org_id == ctx.org_id)
    if not include_archived:
        q = q.where(Vendor.archived_at.is_(None))
    vendors = ctx.session.exec(q.order_by(Vendor.name)).all()
    if trade:
        vendors = [v for v in vendors if trade in (v.trades or [])]
    stats = _ratings(ctx.session, ctx.org_id)
    today = today_in(ctx.org.timezone)
    return [_vendor_out(v, stats.get(v.id), today) for v in vendors]


@router.post("/vendors", status_code=201)
def create_vendor(payload: VendorIn, ctx: Ctx = Depends(writer)):
    v = Vendor(org_id=ctx.org_id, **payload.model_dump())
    ctx.session.add(v)
    ctx.session.flush()
    audit.log(ctx, "vendor", v.id, "create", f"Added vendor {v.name}")
    ctx.session.commit()
    return _vendor_out(v, None, today_in(ctx.org.timezone))


@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    v = _vendor(ctx, vendor_id)
    q = (
        select(WorkOrder, Property.name)
        .join(Property, Property.id == WorkOrder.property_id)
        .where(WorkOrder.org_id == ctx.org_id, WorkOrder.vendor_id == v.id)
    )
    if ctx.scope is not None:
        q = q.where(WorkOrder.property_id.in_(ctx.scope))
    jobs = ctx.session.exec(q.order_by(WorkOrder.created_at.desc()).limit(100)).all()
    wo_ids = [w.id for w, _ in jobs]
    invoices = ctx.session.exec(select(VendorInvoice).where(VendorInvoice.vendor_id == v.id, VendorInvoice.work_order_id.in_(wo_ids)).order_by(VendorInvoice.invoice_date.desc())).all() if wo_ids else []
    out = _vendor_out(v, _ratings(ctx.session, ctx.org_id).get(v.id), today_in(ctx.org.timezone))
    out["jobs"] = [
        {"id": str(w.id), "number": w.number, "title": w.title, "status": w.status, "property_name": pn, "created_at": w.created_at, "vendor_rating": w.vendor_rating}
        for w, pn in jobs
    ]
    out["invoices"] = invoices
    out["total_billed_cents"] = sum(i.amount_cents for i in invoices)
    out["unpaid_cents"] = sum(i.amount_cents for i in invoices if i.status == "unpaid")
    return out


@router.patch("/vendors/{vendor_id}")
def update_vendor(vendor_id: uuid.UUID, payload: VendorUpdate, ctx: Ctx = Depends(writer)):
    v = _vendor(ctx, vendor_id)
    before = v.model_dump()
    data = payload.model_dump(exclude_unset=True)
    archived = data.pop("archived", None)
    for k, val in data.items():
        if val is None and k in ("name", "trades", "w9_on_file"):
            continue
        setattr(v, k, val)
    if archived is not None:
        v.archived_at = utcnow() if archived else None
    v.updated_at = utcnow()
    ctx.session.add(v)
    audit.log(ctx, "vendor", v.id, "update", f"Updated vendor {v.name}", audit.diff(before, v.model_dump()))
    ctx.session.commit()
    return _vendor_out(v, _ratings(ctx.session, ctx.org_id).get(v.id), today_in(ctx.org.timezone))


# ── Work orders: vendor, quotes, invoices, rating ────────────────────────────


def work_order_vendor_extras(session: Session, wo: WorkOrder) -> dict:
    """Extra fields for GET /work-orders/{id}."""
    vendor = session.get(Vendor, wo.vendor_id) if wo.vendor_id else None
    names = {v.id: v.name for v in session.exec(select(Vendor).where(Vendor.org_id == wo.org_id)).all()}
    quotes = session.exec(select(Quote).where(Quote.work_order_id == wo.id).order_by(Quote.created_at)).all()
    invoices = session.exec(select(VendorInvoice).where(VendorInvoice.work_order_id == wo.id).order_by(VendorInvoice.invoice_date)).all()
    return {
        "vendor": {"id": str(vendor.id), "name": vendor.name, "email": vendor.email, "phone": vendor.phone} if vendor else None,
        "quotes": [{**q.model_dump(), "vendor_name": names.get(q.vendor_id)} for q in quotes],
        "invoices": [{**i.model_dump(), "vendor_name": names.get(i.vendor_id)} for i in invoices],
    }


def _wo(ctx: Ctx, work_order_id: uuid.UUID) -> WorkOrder:
    return get_owned(ctx, WorkOrder, work_order_id, "Work order")


def email_vendor(session: Session, org: Organization, wo: WorkOrder, vendor: Vendor, sender_name: str, sender_email: str, message: str | None) -> bool:
    if not vendor.email:
        return False
    prop = session.get(Property, wo.property_id)
    unit = session.get(Unit, wo.unit_id) if wo.unit_id else None
    address = f"{prop.address_line1}, {prop.city}, {prop.state} {prop.postal_code}" + (f" ({unit.name})" if unit else "")
    when = f"<li><strong>Scheduled:</strong> {esc(wo.scheduled_for.strftime('%B %d, %Y %H:%M UTC'))}</li>" if wo.scheduled_for else ""
    html = layout(
        f"Job #{wo.number}: {wo.title}",
        f"<p>Hi {esc(vendor.contact_name or vendor.name)},</p><p>{esc(org.name)} would like your help with this job.</p>"
        + (f"<p>{esc(message)}</p>" if message else "")
        + f"<ul><li><strong>Address:</strong> {esc(address)}</li><li><strong>Category:</strong> {esc(wo.category.replace('_', ' '))}</li>"
        f"<li><strong>Priority:</strong> {esc(wo.priority)}</li>{when}"
        f"<li><strong>Entry:</strong> {'Tenant has given permission to enter' if wo.permission_to_enter else 'Please contact us before entering'}</li></ul>"
        + (f"<p style='white-space:pre-wrap'>{esc(wo.description)}</p>" if wo.description else "")
        + f"<p>Reply to {esc(sender_name)} at {esc(sender_email)} with questions, a quote or your invoice.</p>",
    )
    return notify(session, org.id, "vendor_job", vendor.email, f"Job #{wo.number} from {org.name}: {wo.title}", html)


@router.put("/work-orders/{work_order_id}/vendor")
def set_work_order_vendor(work_order_id: uuid.UUID, payload: WorkOrderVendorIn, ctx: Ctx = Depends(writer)):
    wo = _wo(ctx, work_order_id)
    vendor = _vendor(ctx, payload.vendor_id)
    if vendor and vendor.archived_at:
        raise HTTPException(status_code=400, detail="That vendor is archived.")
    wo.vendor_id = vendor.id if vendor else None
    mx.add_system_comment(ctx.session, wo, ctx.user.id, f"Vendor set to {vendor.name}" if vendor else "Vendor removed")
    if vendor and wo.status == "new":
        wo.status = "assigned"
    wo.updated_at = utcnow()
    ctx.session.add(wo)
    audit.log(ctx, "work_order", wo.id, "vendor", f"#{wo.number}: vendor {vendor.name if vendor else 'removed'}")
    ctx.session.commit()
    sent = email_vendor(ctx.session, ctx.org, wo, vendor, ctx.user.name, ctx.user.email, payload.message) if vendor and payload.email_vendor else False
    return {**work_order_vendor_extras(ctx.session, wo), "email_sent": sent}


@router.post("/work-orders/{work_order_id}/quotes", status_code=201)
def add_quote(work_order_id: uuid.UUID, payload: QuoteIn, ctx: Ctx = Depends(writer)):
    wo = _wo(ctx, work_order_id)
    vendor = _vendor(ctx, payload.vendor_id)
    _org_document(ctx, payload.document_id)
    q = Quote(org_id=ctx.org_id, work_order_id=wo.id, **payload.model_dump())
    ctx.session.add(q)
    mx.add_system_comment(ctx.session, wo, ctx.user.id, f"Quote from {vendor.name}: {money(q.amount_cents, ctx.org.currency)}")
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


def _quote(ctx: Ctx, quote_id: uuid.UUID) -> tuple[Quote, WorkOrder]:
    q = ctx.session.get(Quote, quote_id)
    if not q or q.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Quote not found")
    return q, _wo(ctx, q.work_order_id)


@router.post("/quotes/{quote_id}/approve")
def approve_quote(quote_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Approve one quote: the vendor gets the job and the other pending quotes are declined."""
    q, wo = _quote(ctx, quote_id)
    if q.status != "pending":
        raise HTTPException(status_code=400, detail="This quote was already decided.")
    vendor = ctx.session.get(Vendor, q.vendor_id)
    now = utcnow()
    for other in ctx.session.exec(select(Quote).where(Quote.work_order_id == wo.id, Quote.status == "pending")).all():
        other.status = "approved" if other.id == q.id else "declined"
        other.decided_at = now
        other.decided_by_user_id = ctx.user.id
        ctx.session.add(other)
    wo.vendor_id = vendor.id
    if wo.status == "new":
        wo.status = "assigned"
    wo.updated_at = now
    ctx.session.add(wo)
    mx.add_system_comment(ctx.session, wo, ctx.user.id, f"Approved quote from {vendor.name} ({money(q.amount_cents, ctx.org.currency)})")
    audit.log(ctx, "work_order", wo.id, "quote_approved", f"#{wo.number}: approved {vendor.name} quote {money(q.amount_cents, ctx.org.currency)}")
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


@router.post("/quotes/{quote_id}/decline")
def decline_quote(quote_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    q, wo = _quote(ctx, quote_id)
    if q.status != "pending":
        raise HTTPException(status_code=400, detail="This quote was already decided.")
    q.status = "declined"
    q.decided_at = utcnow()
    q.decided_by_user_id = ctx.user.id
    ctx.session.add(q)
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


@router.delete("/quotes/{quote_id}")
def delete_quote(quote_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    q, wo = _quote(ctx, quote_id)
    ctx.session.delete(q)
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


@router.post("/work-orders/{work_order_id}/invoices", status_code=201)
def add_invoice(work_order_id: uuid.UUID, payload: VendorInvoiceIn, ctx: Ctx = Depends(writer)):
    """Record a vendor invoice. It becomes an expense on the property automatically."""
    from app.routers.work_orders import apply_status

    wo = _wo(ctx, work_order_id)
    vendor = _vendor(ctx, payload.vendor_id or wo.vendor_id)
    if not vendor:
        raise HTTPException(status_code=400, detail="Choose the vendor who sent this invoice.")
    _org_document(ctx, payload.document_id)
    if payload.paid_on and payload.paid_on < payload.invoice_date - timedelta(days=365):
        raise HTTPException(status_code=422, detail="Check the paid date.")
    ref = f" #{payload.invoice_number}" if payload.invoice_number else ""
    exp = Expense(
        org_id=ctx.org_id,
        property_id=wo.property_id,
        unit_id=wo.unit_id,
        work_order_id=wo.id,
        category=payload.category,
        amount_cents=payload.amount_cents,
        expense_date=payload.invoice_date,
        vendor=vendor.name,
        description=f"Invoice{ref} - work order #{wo.number}: {wo.title}"[:500],
        receipt_document_id=payload.document_id,
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(exp)
    ctx.session.flush()
    inv = VendorInvoice(
        org_id=ctx.org_id,
        work_order_id=wo.id,
        vendor_id=vendor.id,
        invoice_number=payload.invoice_number,
        amount_cents=payload.amount_cents,
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        status="paid" if payload.paid_on else "unpaid",
        paid_on=payload.paid_on,
        document_id=payload.document_id,
        expense_id=exp.id,
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(inv)
    if not wo.vendor_id:
        wo.vendor_id = vendor.id
    old_status = wo.status
    if payload.complete_work_order and wo.status not in ("completed", "closed"):
        apply_status(ctx, wo, "completed")
    mx.add_system_comment(ctx.session, wo, ctx.user.id, f"Invoice{ref} from {vendor.name}: {money(inv.amount_cents, ctx.org.currency)} (recorded as an expense)")
    wo.updated_at = utcnow()
    ctx.session.add(wo)
    audit.log(ctx, "work_order", wo.id, "invoice", f"#{wo.number}: invoice from {vendor.name} {money(inv.amount_cents, ctx.org.currency)}")
    ctx.session.commit()
    if wo.status != old_status:
        mx.notify_tenant(ctx.session, ctx.org, wo, "Your request has been completed.")
    return work_order_vendor_extras(ctx.session, wo)


def _invoice(ctx: Ctx, invoice_id: uuid.UUID) -> tuple[VendorInvoice, WorkOrder]:
    inv = ctx.session.get(VendorInvoice, invoice_id)
    if not inv or inv.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv, _wo(ctx, inv.work_order_id)


@router.post("/invoices/{invoice_id}/paid")
def mark_invoice_paid(invoice_id: uuid.UUID, payload: InvoicePaidIn, ctx: Ctx = Depends(writer)):
    inv, wo = _invoice(ctx, invoice_id)
    inv.status = "paid"
    inv.paid_on = payload.paid_on
    inv.updated_at = utcnow()
    ctx.session.add(inv)
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


@router.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Remove an invoice entered by mistake, together with its expense."""
    inv, wo = _invoice(ctx, invoice_id)
    exp = ctx.session.get(Expense, inv.expense_id) if inv.expense_id else None
    ctx.session.delete(inv)
    ctx.session.flush()
    if exp:
        ctx.session.delete(exp)
    audit.log(ctx, "work_order", wo.id, "invoice_deleted", f"#{wo.number}: deleted invoice {money(inv.amount_cents, ctx.org.currency)}")
    ctx.session.commit()
    return work_order_vendor_extras(ctx.session, wo)


@router.post("/work-orders/{work_order_id}/rating")
def rate_vendor(work_order_id: uuid.UUID, payload: VendorRatingIn, ctx: Ctx = Depends(writer)):
    wo = _wo(ctx, work_order_id)
    if not wo.vendor_id:
        raise HTTPException(status_code=400, detail="This work order has no vendor.")
    wo.vendor_rating = payload.rating
    ctx.session.add(wo)
    ctx.session.commit()
    return {"vendor_rating": wo.vendor_rating}


# ── Preventive maintenance schedules ─────────────────────────────────────────


def _schedule_out(session: Session, s: MaintenanceSchedule) -> dict:
    prop = session.get(Property, s.property_id)
    unit = session.get(Unit, s.unit_id) if s.unit_id else None
    vendor = session.get(Vendor, s.vendor_id) if s.vendor_id else None
    asset = session.get(Asset, s.asset_id) if s.asset_id else None
    return {
        **s.model_dump(),
        "property_name": prop.name if prop else None,
        "unit_name": unit.name if unit else None,
        "vendor_name": vendor.name if vendor else None,
        "asset_name": asset.name if asset else None,
    }


def _check_schedule_refs(ctx: Ctx, property_id: uuid.UUID, data: dict) -> None:
    if data.get("vendor_id"):
        _vendor(ctx, data["vendor_id"])
    if data.get("asset_id"):
        asset = get_owned(ctx, Asset, data["asset_id"], "Asset")
        if asset.property_id != property_id:
            raise HTTPException(status_code=400, detail="That asset is at a different property.")
    if data.get("assigned_to_user_id"):
        m = ctx.session.exec(
            select(Membership).where(Membership.org_id == ctx.org_id, Membership.user_id == data["assigned_to_user_id"], Membership.role.in_(("owner", "manager", "maintenance")))
        ).first()
        if not m:
            raise HTTPException(status_code=400, detail="Assignee must be an owner, manager or maintenance team member.")


@router.get("/maintenance-schedules")
def list_schedules(property_id: uuid.UUID | None = None, ctx: Ctx = Depends(staff)):
    q = select(MaintenanceSchedule).where(MaintenanceSchedule.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(MaintenanceSchedule.property_id.in_(ctx.scope))
    if property_id:
        q = q.where(MaintenanceSchedule.property_id == property_id)
    return [_schedule_out(ctx.session, s) for s in ctx.session.exec(q.order_by(MaintenanceSchedule.active.desc(), MaintenanceSchedule.next_due_on)).all()]


@router.post("/maintenance-schedules", status_code=201)
def create_schedule(payload: ScheduleIn, ctx: Ctx = Depends(writer)):
    _check_location(ctx, payload.property_id, payload.unit_id)
    data = payload.model_dump()
    _check_schedule_refs(ctx, payload.property_id, data)
    s = MaintenanceSchedule(org_id=ctx.org_id, created_by_user_id=ctx.user.id, **data)
    ctx.session.add(s)
    ctx.session.flush()
    audit.log(ctx, "maintenance_schedule", s.id, "create", f"Scheduled “{s.title}” every {s.interval_months} months")
    ctx.session.commit()
    return _schedule_out(ctx.session, s)


@router.patch("/maintenance-schedules/{schedule_id}")
def update_schedule(schedule_id: uuid.UUID, payload: ScheduleUpdate, ctx: Ctx = Depends(writer)):
    s = get_owned(ctx, MaintenanceSchedule, schedule_id, "Schedule")
    data = payload.model_dump(exclude_unset=True)
    if "unit_id" in data:
        _check_location(ctx, s.property_id, data["unit_id"])
    _check_schedule_refs(ctx, s.property_id, data)
    for k, v in data.items():
        if v is None and k in ("title", "category", "priority", "interval_months", "next_due_on", "lead_days", "active"):
            continue
        setattr(s, k, v)
    s.updated_at = utcnow()
    ctx.session.add(s)
    ctx.session.commit()
    return _schedule_out(ctx.session, s)


@router.delete("/maintenance-schedules/{schedule_id}")
def delete_schedule(schedule_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    s = get_owned(ctx, MaintenanceSchedule, schedule_id, "Schedule")
    for wo in ctx.session.exec(select(WorkOrder).where(WorkOrder.schedule_id == s.id)).all():
        wo.schedule_id = None  # past work orders stay
        ctx.session.add(wo)
    ctx.session.delete(s)
    audit.log(ctx, "maintenance_schedule", schedule_id, "delete", f"Deleted schedule “{s.title}”")
    ctx.session.commit()
    return {"ok": True}


def create_from_schedule(session: Session, org: Organization, s: MaintenanceSchedule, today: date, actor_id: uuid.UUID | None = None) -> WorkOrder:
    """Open the work order for the schedule's next due date and move the schedule forward."""
    due = s.next_due_on
    wo = WorkOrder(
        org_id=org.id,
        number=mx.next_number(session, org.id),
        property_id=s.property_id,
        unit_id=s.unit_id,
        title=s.title,
        description=((s.description + "\n\n") if s.description else "") + f"Preventive maintenance due {due.strftime('%B %d, %Y')}.",
        category=s.category,
        priority=s.priority,
        status="assigned" if (s.assigned_to_user_id or s.vendor_id) else "new",
        assigned_to_user_id=s.assigned_to_user_id,
        vendor_id=s.vendor_id,
        schedule_id=s.id,
        asset_id=s.asset_id,
        created_by_user_id=actor_id,
    )
    session.add(wo)
    session.flush()
    mx.add_system_comment(session, wo, actor_id, "Created from a preventive maintenance schedule")
    # Advance past today so a long-overdue schedule creates one work order, not a backlog.
    nxt = add_months(due, s.interval_months)
    while nxt - timedelta(days=s.lead_days) <= today:
        nxt = add_months(nxt, s.interval_months)
    s.next_due_on = nxt
    s.last_work_order_id = wo.id
    s.updated_at = utcnow()
    session.add(s)
    return wo


@router.post("/maintenance-schedules/{schedule_id}/run-now")
def run_schedule_now(schedule_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    s = get_owned(ctx, MaintenanceSchedule, schedule_id, "Schedule")
    wo = create_from_schedule(ctx.session, ctx.org, s, today_in(ctx.org.timezone), ctx.user.id)
    audit.log(ctx, "work_order", wo.id, "create", f"Work order #{wo.number} from schedule “{s.title}”")
    ctx.session.commit()
    mx.notify_new(ctx.session, ctx.org, wo)
    return {"work_order_id": str(wo.id), "number": wo.number, "schedule": _schedule_out(ctx.session, s)}


# ── Assets ───────────────────────────────────────────────────────────────────


def _asset_out(session: Session, a: Asset, today: date) -> dict:
    unit = session.get(Unit, a.unit_id) if a.unit_id else None
    w = a.warranty_expires_on
    return {
        **a.model_dump(),
        "unit_name": unit.name if unit else None,
        "warranty_status": None if not w else "expired" if w < today else "expiring" if w <= today + timedelta(days=60) else "ok",
    }


@router.get("/assets")
def list_assets(property_id: uuid.UUID | None = None, include_archived: bool = False, ctx: Ctx = Depends(staff)):
    q = select(Asset).where(Asset.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(Asset.property_id.in_(ctx.scope))
    if property_id:
        q = q.where(Asset.property_id == property_id)
    if not include_archived:
        q = q.where(Asset.archived_at.is_(None))
    today = today_in(ctx.org.timezone)
    return [_asset_out(ctx.session, a, today) for a in ctx.session.exec(q.order_by(Asset.name)).all()]


@router.post("/assets", status_code=201)
def create_asset(payload: AssetIn, ctx: Ctx = Depends(writer)):
    _check_location(ctx, payload.property_id, payload.unit_id)
    a = Asset(org_id=ctx.org_id, **payload.model_dump())
    ctx.session.add(a)
    ctx.session.flush()
    audit.log(ctx, "asset", a.id, "create", f"Added {a.name}")
    ctx.session.commit()
    return _asset_out(ctx.session, a, today_in(ctx.org.timezone))


@router.get("/assets/{asset_id}")
def get_asset(asset_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    a = get_owned(ctx, Asset, asset_id, "Asset")
    history = ctx.session.exec(select(WorkOrder).where(WorkOrder.asset_id == a.id).order_by(WorkOrder.created_at.desc())).all()
    return {**_asset_out(ctx.session, a, today_in(ctx.org.timezone)), "work_orders": [{"id": str(w.id), "number": w.number, "title": w.title, "status": w.status, "created_at": w.created_at} for w in history]}


@router.patch("/assets/{asset_id}")
def update_asset(asset_id: uuid.UUID, payload: AssetUpdate, ctx: Ctx = Depends(writer)):
    a = get_owned(ctx, Asset, asset_id, "Asset")
    data = payload.model_dump(exclude_unset=True)
    archived = data.pop("archived", None)
    data.pop("property_id", None)  # assets don't move between properties
    if "unit_id" in data:
        _check_location(ctx, a.property_id, data["unit_id"])
    for k, v in data.items():
        if v is None and k in ("name", "category"):
            continue
        setattr(a, k, v)
    if archived is not None:
        a.archived_at = utcnow() if archived else None
    a.updated_at = utcnow()
    ctx.session.add(a)
    ctx.session.commit()
    return _asset_out(ctx.session, a, today_in(ctx.org.timezone))


# ── Keys & access codes ──────────────────────────────────────────────────────


def _access_out(session: Session, item: AccessItem, show_code: bool) -> dict:
    unit = session.get(Unit, item.unit_id) if item.unit_id else None
    out = {**item.model_dump(), "unit_name": unit.name if unit else None}
    if not show_code and item.code:
        out["code"] = "••••"
    return out


@router.get("/access-items")
def list_access_items(property_id: uuid.UUID | None = None, ctx: Ctx = Depends(staff)):
    q = select(AccessItem).where(AccessItem.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(AccessItem.property_id.in_(ctx.scope))
    if property_id:
        q = q.where(AccessItem.property_id == property_id)
    show = ctx.role in ("owner", "manager", "maintenance")  # accountants see that a code exists, not the code
    return [_access_out(ctx.session, i, show) for i in ctx.session.exec(q.order_by(AccessItem.unit_id, AccessItem.label)).all()]


@router.post("/access-items", status_code=201)
def create_access_item(payload: AccessItemIn, ctx: Ctx = Depends(writer)):
    _check_location(ctx, payload.property_id, payload.unit_id)
    item = AccessItem(org_id=ctx.org_id, **payload.model_dump())
    ctx.session.add(item)
    ctx.session.flush()
    audit.log(ctx, "access_item", item.id, "create", f"Added {item.kind} “{item.label}”")
    ctx.session.commit()
    return _access_out(ctx.session, item, True)


@router.patch("/access-items/{item_id}")
def update_access_item(item_id: uuid.UUID, payload: AccessItemUpdate, ctx: Ctx = Depends(writer)):
    item = get_owned(ctx, AccessItem, item_id, "Item")
    data = payload.model_dump(exclude_unset=True)
    data.pop("property_id", None)
    if "unit_id" in data:
        _check_location(ctx, item.property_id, data["unit_id"])
    changed_code = "code" in data and data["code"] != item.code
    for k, v in data.items():
        if v is None and k in ("kind", "label", "quantity"):
            continue
        setattr(item, k, v)
    item.updated_at = utcnow()
    ctx.session.add(item)
    # Never write the code itself to the audit log.
    audit.log(ctx, "access_item", item.id, "update", f"Updated {item.kind} “{item.label}”" + (" (code changed)" if changed_code else ""))
    ctx.session.commit()
    return _access_out(ctx.session, item, True)


@router.delete("/access-items/{item_id}")
def delete_access_item(item_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    item = get_owned(ctx, AccessItem, item_id, "Item")
    ctx.session.delete(item)
    audit.log(ctx, "access_item", item_id, "delete", f"Removed {item.kind} “{item.label}”")
    ctx.session.commit()
    return {"ok": True}


# ── Daily job (called from jobs.run_daily_for_org) ────────────────────────────


def daily_maintenance(session: Session, org: Organization, today: date) -> dict[str, int]:
    created: list[WorkOrder] = []
    schedules = session.exec(select(MaintenanceSchedule).where(MaintenanceSchedule.org_id == org.id, MaintenanceSchedule.active == True)).all()  # noqa: E712
    for s in schedules:
        if s.next_due_on - timedelta(days=s.lead_days) <= today:
            created.append(create_from_schedule(session, org, s, today))
    session.commit()
    for wo in created:
        mx.notify_new(session, org, wo)

    alerts = 0
    recipients = staff_recipients(session, org.id, "document_expiry")
    horizon = today + timedelta(days=30)
    for a in session.exec(select(Asset).where(Asset.org_id == org.id, Asset.archived_at.is_(None), Asset.warranty_expires_on.is_not(None), Asset.warranty_expires_on >= today, Asset.warranty_expires_on <= horizon)).all():
        prop = session.get(Property, a.property_id)
        html = layout(
            "Warranty ending soon",
            f"<p>The warranty on <strong>{esc(a.name)}</strong>{(' (' + esc(a.make) + ')') if a.make else ''} at {esc(prop.name)} ends on "
            f"{a.warranty_expires_on.strftime('%B %d, %Y')}. If anything needs fixing under warranty, now is the time.</p>",
        )
        for email in recipients:
            alerts += notify(session, org.id, "warranty_expiry", email, f"Warranty ending {a.warranty_expires_on.strftime('%b %d')}: {a.name}", html, dedupe_key=f"warranty:{a.id}:{a.warranty_expires_on}:{email}")
    for v in session.exec(select(Vendor).where(Vendor.org_id == org.id, Vendor.archived_at.is_(None), Vendor.insurance_expires_on.is_not(None), Vendor.insurance_expires_on <= horizon, Vendor.insurance_expires_on >= today - timedelta(days=1))).all():
        html = layout(
            "Vendor insurance expiring",
            f"<p>The insurance certificate for <strong>{esc(v.name)}</strong> expires on {v.insurance_expires_on.strftime('%B %d, %Y')}. "
            "Ask them for an updated certificate before the next job.</p>",
        )
        for email in recipients:
            alerts += notify(session, org.id, "vendor_insurance", email, f"Insurance expiring: {v.name}", html, dedupe_key=f"vendor_ins:{v.id}:{v.insurance_expires_on}:{email}")
    return {"preventive_work_orders": len(created), "maintenance_alerts": alerts}
