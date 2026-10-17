"""Tenant portal — everything is scoped to the leases the signed-in tenant is on."""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import select

from app.core import audit
from app.core.dates import today_in
from app.core.deps import Ctx, tenant_only
from app.models import Document, Lease, LeaseTenant, Payment, Tenant, Unit, WorkOrder, WorkOrderComment, utcnow
from app.routers.documents import store_upload
from app.routers.leases import ledger_rows, lease_detail, receipt_response
from app.schemas import CommentIn, PortalWorkOrderIn
from app.services import maintenance as mx
from app.services.billing import due_dates, next_due_date

router = APIRouter(prefix="/portal", tags=["portal"])


def _tenants(ctx: Ctx) -> list[Tenant]:
    return list(ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id, Tenant.user_id == ctx.user.id)).all())


def _lease_ids(ctx: Ctx) -> set[uuid.UUID]:
    ids = [t.id for t in _tenants(ctx)]
    if not ids:
        return set()
    return {lt.lease_id for lt in ctx.session.exec(select(LeaseTenant).where(LeaseTenant.tenant_id.in_(ids))).all()}


def _my_lease(ctx: Ctx, lease_id: uuid.UUID) -> Lease:
    if lease_id not in _lease_ids(ctx):
        raise HTTPException(status_code=404, detail="Lease not found")
    return ctx.session.get(Lease, lease_id)


def _my_work_order(ctx: Ctx, work_order_id: uuid.UUID) -> WorkOrder:
    wo = ctx.session.get(WorkOrder, work_order_id)
    tenant_ids = {t.id for t in _tenants(ctx)}
    if not wo or wo.org_id != ctx.org_id or wo.tenant_id not in tenant_ids:
        raise HTTPException(status_code=404, detail="Request not found")
    return wo


def _public_lease(session, lease: Lease) -> dict:
    d = lease_detail(session, lease)
    d.pop("notes", None)  # landlord's private notes
    return d


@router.get("/home")
def home(ctx: Ctx = Depends(tenant_only)):
    today = today_in(ctx.org.timezone)
    leases = [ctx.session.get(Lease, lid) for lid in _lease_ids(ctx)]
    leases.sort(key=lambda l: (l.status != "active", -l.start_date.toordinal()))
    tenants = _tenants(ctx)
    out_leases = []
    for lease in leases:
        d = _public_lease(ctx.session, lease)
        nxt = next_due_date(lease, today) if lease.status == "active" else None
        d["next_due_date"] = nxt.isoformat() if nxt else None
        d["last_due_date"] = (dues[-1].isoformat() if (dues := due_dates(lease, today)) else None)
        out_leases.append(d)
    lease_ids = [l.id for l in leases]
    payments = (
        ctx.session.exec(
            select(Payment).where(Payment.lease_id.in_(lease_ids), Payment.voided_at.is_(None)).order_by(Payment.received_on.desc()).limit(5)
        ).all()
        if lease_ids
        else []
    )
    open_requests = (
        ctx.session.exec(
            select(WorkOrder).where(
                WorkOrder.tenant_id.in_([t.id for t in tenants]), WorkOrder.status.not_in(("completed", "closed"))
            )
        ).all()
        if tenants
        else []
    )
    return {
        "tenant_name": f"{tenants[0].first_name}" if tenants else ctx.user.name,
        "organization": ctx.org.name,
        "leases": out_leases,
        "recent_payments": payments,
        "open_requests": len(open_requests),
    }


@router.get("/leases/{lease_id}")
def get_lease(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    lease = _my_lease(ctx, lease_id)
    docs = ctx.session.exec(
        select(Document).where(
            Document.org_id == ctx.org_id,
            Document.visible_to_tenant == True,  # noqa: E712
            ((Document.owner_type == "lease") & (Document.owner_id == lease.id))
            | ((Document.owner_type == "unit") & (Document.owner_id == lease.unit_id)),
        )
    ).all()
    return {**_public_lease(ctx.session, lease), "documents": [d.model_dump(exclude={"storage_key"}) for d in docs]}


@router.get("/leases/{lease_id}/ledger")
def get_ledger(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    lease = _my_lease(ctx, lease_id)
    return ledger_rows(ctx.session, lease.id)


@router.get("/payments")
def list_payments(ctx: Ctx = Depends(tenant_only)):
    ids = _lease_ids(ctx)
    if not ids:
        return []
    return ctx.session.exec(
        select(Payment).where(Payment.lease_id.in_(ids), Payment.voided_at.is_(None)).order_by(Payment.received_on.desc())
    ).all()


@router.get("/payments/{payment_id}/receipt.pdf")
def payment_receipt(payment_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    payment = ctx.session.get(Payment, payment_id)
    if not payment or payment.lease_id not in _lease_ids(ctx) or payment.voided_at:
        raise HTTPException(status_code=404, detail="Payment not found")
    return receipt_response(ctx.session, ctx.org, payment)


@router.get("/documents")
def list_documents(ctx: Ctx = Depends(tenant_only)):
    lease_ids = _lease_ids(ctx)
    unit_ids = {ctx.session.get(Lease, lid).unit_id for lid in lease_ids}
    tenant_ids = {t.id for t in _tenants(ctx)}
    owner_ids = lease_ids | unit_ids | tenant_ids
    if not owner_ids:
        return []
    docs = ctx.session.exec(
        select(Document).where(
            Document.org_id == ctx.org_id,
            Document.visible_to_tenant == True,  # noqa: E712
            Document.owner_type.in_(("lease", "unit", "tenant")),
            Document.owner_id.in_(owner_ids),
        ).order_by(Document.created_at.desc())
    ).all()
    return [d.model_dump(exclude={"storage_key"}) for d in docs]


# ── Maintenance requests ─────────────────────────────────────────────────────


@router.get("/work-orders")
def list_requests(ctx: Ctx = Depends(tenant_only)):
    tenant_ids = [t.id for t in _tenants(ctx)]
    if not tenant_ids:
        return []
    rows = ctx.session.exec(select(WorkOrder).where(WorkOrder.tenant_id.in_(tenant_ids)).order_by(WorkOrder.created_at.desc())).all()
    return [mx.serialize(ctx.session, w, include_internal=False) for w in rows]


@router.post("/work-orders", status_code=201)
def create_request(payload: PortalWorkOrderIn, ctx: Ctx = Depends(tenant_only)):
    tenants = _tenants(ctx)
    if not tenants:
        raise HTTPException(status_code=400, detail="Your account isn't linked to a tenant record.")
    lease_ids = _lease_ids(ctx)
    if payload.lease_id:
        lease = _my_lease(ctx, payload.lease_id)
    else:
        active = [ctx.session.get(Lease, lid) for lid in lease_ids]
        active = [l for l in active if l.status == "active"]
        if not active:
            raise HTTPException(status_code=400, detail="You don't have an active lease.")
        lease = active[0]
    if lease.status != "active":
        raise HTTPException(status_code=400, detail="You can only submit requests for an active lease.")
    unit = ctx.session.get(Unit, lease.unit_id)
    tenant_id = next(
        (lt.tenant_id for lt in ctx.session.exec(select(LeaseTenant).where(LeaseTenant.lease_id == lease.id)).all() if lt.tenant_id in {t.id for t in tenants}),
        tenants[0].id,
    )
    wo = WorkOrder(
        org_id=ctx.org_id,
        number=mx.next_number(ctx.session, ctx.org_id),
        property_id=unit.property_id,
        unit_id=unit.id,
        tenant_id=tenant_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        permission_to_enter=payload.permission_to_enter,
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(wo)
    ctx.session.flush()
    mx.add_system_comment(ctx.session, wo, ctx.user.id, "Request submitted")
    audit.log(ctx, "work_order", wo.id, "create", f"Tenant request #{wo.number}: {wo.title}")
    ctx.session.commit()
    mx.notify_new(ctx.session, ctx.org, wo)
    return mx.serialize(ctx.session, wo, include_internal=False)


@router.get("/work-orders/{work_order_id}")
def get_request(work_order_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    wo = _my_work_order(ctx, work_order_id)
    docs = ctx.session.exec(
        select(Document).where(
            Document.owner_type == "work_order", Document.owner_id == wo.id, Document.visible_to_tenant == True  # noqa: E712
        )
    ).all()
    return {**mx.serialize(ctx.session, wo, include_internal=False), "attachments": [d.model_dump(exclude={"storage_key"}) for d in docs]}


@router.post("/work-orders/{work_order_id}/comments", status_code=201)
def add_comment(work_order_id: uuid.UUID, payload: CommentIn, ctx: Ctx = Depends(tenant_only)):
    wo = _my_work_order(ctx, work_order_id)
    if wo.status == "closed":
        raise HTTPException(status_code=400, detail="This request is closed. Submit a new request if the issue continues.")
    ctx.session.add(WorkOrderComment(org_id=ctx.org_id, work_order_id=wo.id, author_user_id=ctx.user.id, body=payload.body))
    wo.updated_at = utcnow()
    ctx.session.add(wo)
    ctx.session.commit()
    mx.notify_staff_comment(ctx.session, ctx.org, wo, ctx.user.name, payload.body)
    return mx.serialize(ctx.session, wo, include_internal=False)


@router.post("/work-orders/{work_order_id}/attachments", status_code=201)
async def add_attachment(work_order_id: uuid.UUID, file: UploadFile = File(...), ctx: Ctx = Depends(tenant_only)):
    wo = _my_work_order(ctx, work_order_id)
    kind = "photo" if (file.content_type or "").startswith(("image/", "video/")) else "other"
    doc = await store_upload(ctx.session, ctx.org_id, ctx.user.id, file, "work_order", wo.id, kind, visible_to_tenant=True)
    ctx.session.commit()
    ctx.session.refresh(doc)
    return doc.model_dump(exclude={"storage_key"})
