import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.core import audit
from app.core.deps import Ctx, get_owned, staff
from app.models import Expense, Membership, Property, Unit, WorkOrder, WorkOrderComment, utcnow
from app.schemas import CommentIn, CompleteWithExpenseIn, WorkOrderIn, WorkOrderUpdate
from app.services import maintenance as mx

router = APIRouter(prefix="/work-orders", tags=["maintenance"])

# Allowed status transitions (closed can be reopened to in_progress).
TRANSITIONS = {
    "new": {"assigned", "scheduled", "in_progress", "completed", "closed"},
    "assigned": {"new", "scheduled", "in_progress", "completed", "closed"},
    "scheduled": {"assigned", "in_progress", "completed", "closed"},
    "in_progress": {"scheduled", "completed", "closed"},
    "completed": {"in_progress", "closed"},
    "closed": {"in_progress"},
}


def _can_edit(ctx: Ctx, wo: WorkOrder) -> bool:
    if ctx.role in ("owner", "manager"):
        return True
    return ctx.role == "maintenance" and wo.assigned_to_user_id == ctx.user.id


def _require_edit(ctx: Ctx, wo: WorkOrder) -> None:
    if not _can_edit(ctx, wo):
        raise HTTPException(status_code=403, detail="You can only update work orders assigned to you.")


def _check_assignee(ctx: Ctx, user_id: uuid.UUID) -> None:
    m = ctx.session.exec(
        select(Membership).where(
            Membership.org_id == ctx.org_id, Membership.user_id == user_id, Membership.role.in_(("owner", "manager", "maintenance"))
        )
    ).first()
    if not m:
        raise HTTPException(status_code=400, detail="Assignee must be an owner, manager or maintenance team member.")


def apply_status(ctx: Ctx, wo: WorkOrder, new: str) -> None:
    if new == wo.status:
        return
    if new not in TRANSITIONS[wo.status]:
        raise HTTPException(status_code=400, detail=f"Can't move from {mx.STATUS_LABELS[wo.status]} to {mx.STATUS_LABELS[new]}.")
    old = wo.status
    wo.status = new
    if new == "completed":
        wo.completed_at = utcnow()
    if new == "closed":
        wo.closed_at = utcnow()
    if new == "in_progress":
        wo.closed_at = None
    mx.add_system_comment(ctx.session, wo, ctx.user.id, f"Status changed from {mx.STATUS_LABELS[old]} to {mx.STATUS_LABELS[new]}")


@router.get("")
def list_work_orders(
    status: str | None = None,
    property_id: uuid.UUID | None = None,
    open_only: bool = False,
    mine: bool = False,
    ctx: Ctx = Depends(staff),
):
    q = (
        select(WorkOrder, Property.name, Unit.name)
        .join(Property, Property.id == WorkOrder.property_id)
        .outerjoin(Unit, Unit.id == WorkOrder.unit_id)
        .where(WorkOrder.org_id == ctx.org_id)
    )
    if status:
        q = q.where(WorkOrder.status == status)
    if open_only:
        q = q.where(WorkOrder.status.not_in(("completed", "closed")))
    if property_id:
        q = q.where(WorkOrder.property_id == property_id)
    if mine:
        q = q.where(WorkOrder.assigned_to_user_id == ctx.user.id)
    rows = ctx.session.exec(q.order_by(WorkOrder.created_at.desc()).limit(500)).all()
    return [{**w.model_dump(), "property_name": pn, "unit_name": un} for w, pn, un in rows]


@router.post("", status_code=201)
def create_work_order(payload: WorkOrderIn, ctx: Ctx = Depends(staff)):
    if ctx.role == "accountant":
        raise HTTPException(status_code=403, detail="You don't have permission to do that.")
    get_owned(ctx, Property, payload.property_id, "Property")
    if payload.unit_id:
        unit = get_owned(ctx, Unit, payload.unit_id, "Unit")
        if unit.property_id != payload.property_id:
            raise HTTPException(status_code=400, detail="That unit doesn't belong to the selected property.")
    if payload.assigned_to_user_id:
        _check_assignee(ctx, payload.assigned_to_user_id)
    wo = WorkOrder(
        org_id=ctx.org_id,
        number=mx.next_number(ctx.session, ctx.org_id),
        created_by_user_id=ctx.user.id,
        **payload.model_dump(),
    )
    if wo.assigned_to_user_id:
        wo.status = "assigned"
    ctx.session.add(wo)
    ctx.session.flush()
    mx.add_system_comment(ctx.session, wo, ctx.user.id, "Work order created")
    audit.log(ctx, "work_order", wo.id, "create", f"Work order #{wo.number}: {wo.title}")
    ctx.session.commit()
    mx.notify_new(ctx.session, ctx.org, wo)
    return mx.serialize(ctx.session, wo, include_internal=True)


@router.get("/{work_order_id}")
def get_work_order(work_order_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    wo = get_owned(ctx, WorkOrder, work_order_id, "Work order")
    expenses = ctx.session.exec(select(Expense).where(Expense.work_order_id == wo.id)).all()
    return {**mx.serialize(ctx.session, wo, include_internal=True), "expenses": expenses, "can_edit": _can_edit(ctx, wo)}


@router.patch("/{work_order_id}")
def update_work_order(work_order_id: uuid.UUID, payload: WorkOrderUpdate, ctx: Ctx = Depends(staff)):
    wo = get_owned(ctx, WorkOrder, work_order_id, "Work order")
    _require_edit(ctx, wo)
    data = payload.model_dump(exclude_unset=True)
    before = wo.model_dump()
    old_status = wo.status

    if data.pop("unassign", False):
        wo.assigned_to_user_id = None
        mx.add_system_comment(ctx.session, wo, ctx.user.id, "Unassigned")
    if data.get("assigned_to_user_id"):
        if ctx.role == "maintenance":
            raise HTTPException(status_code=403, detail="Only owners and managers can reassign work orders.")
        _check_assignee(ctx, data["assigned_to_user_id"])
        if data["assigned_to_user_id"] != wo.assigned_to_user_id:
            wo.assigned_to_user_id = data["assigned_to_user_id"]
            mx.add_system_comment(ctx.session, wo, ctx.user.id, "Assignee changed")
            if wo.status == "new" and "status" not in data:
                apply_status(ctx, wo, "assigned")
    data.pop("assigned_to_user_id", None)

    new_status = data.pop("status", None)
    for k, v in data.items():
        if v is None and k in ("title", "category", "priority"):
            continue
        setattr(wo, k, v)
    if data.get("scheduled_for") and wo.status in ("new", "assigned") and not new_status:
        new_status = "scheduled"
    if new_status:
        apply_status(ctx, wo, new_status)

    wo.updated_at = utcnow()
    ctx.session.add(wo)
    audit.log(ctx, "work_order", wo.id, "update", f"Updated work order #{wo.number}", audit.diff(before, wo.model_dump()))
    ctx.session.commit()
    if wo.status != old_status:
        mx.notify_tenant(ctx.session, ctx.org, wo, f"Your request is now {mx.STATUS_LABELS[wo.status].lower()}.")
    return mx.serialize(ctx.session, wo, include_internal=True)


@router.post("/{work_order_id}/comments", status_code=201)
def add_comment(work_order_id: uuid.UUID, payload: CommentIn, ctx: Ctx = Depends(staff)):
    wo = get_owned(ctx, WorkOrder, work_order_id, "Work order")
    if ctx.role == "accountant":
        raise HTTPException(status_code=403, detail="You don't have permission to do that.")
    ctx.session.add(
        WorkOrderComment(org_id=ctx.org_id, work_order_id=wo.id, author_user_id=ctx.user.id, body=payload.body, is_internal=payload.is_internal)
    )
    wo.updated_at = utcnow()
    ctx.session.add(wo)
    ctx.session.commit()
    if not payload.is_internal:
        mx.notify_tenant(ctx.session, ctx.org, wo, f"{ctx.user.name} commented: {payload.body}")
    return mx.serialize(ctx.session, wo, include_internal=True)


@router.post("/{work_order_id}/complete-with-expense")
def complete_with_expense(work_order_id: uuid.UUID, payload: CompleteWithExpenseIn, ctx: Ctx = Depends(staff)):
    """Mark completed and log the cost as an expense in one step."""
    wo = get_owned(ctx, WorkOrder, work_order_id, "Work order")
    if ctx.role not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Only owners and managers can record expenses.")
    exp = Expense(
        org_id=ctx.org_id,
        property_id=wo.property_id,
        unit_id=wo.unit_id,
        work_order_id=wo.id,
        category=payload.category,
        amount_cents=payload.amount_cents,
        expense_date=payload.expense_date,
        vendor=payload.vendor,
        description=f"Work order #{wo.number}: {wo.title}",
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(exp)
    old_status = wo.status
    if wo.status not in ("completed", "closed"):
        apply_status(ctx, wo, "completed")
    wo.updated_at = utcnow()
    ctx.session.add(wo)
    ctx.session.flush()
    audit.log(ctx, "work_order", wo.id, "complete", f"Completed #{wo.number} with expense ${payload.amount_cents / 100:,.2f}")
    ctx.session.commit()
    if wo.status != old_status:
        mx.notify_tenant(ctx.session, ctx.org, wo, "Your request has been completed.")
    return {**mx.serialize(ctx.session, wo, include_internal=True), "expense_id": str(exp.id)}
