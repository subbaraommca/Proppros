import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.core import audit
from app.core.deps import Ctx, admin_writer, get_owned, staff, writer
from app.services import plans
from app.models import Document, Expense, Lease, Property, Unit, WorkOrder, utcnow
from app.schemas import PropertyIn, PropertyUpdate, UnitIn, UnitUpdate

router = APIRouter(tags=["properties"])


def _unit_summary(units: list[Unit]) -> dict:
    total = len(units)
    occupied = sum(1 for u in units if u.status == "occupied")
    return {"unit_count": total, "occupied_count": occupied, "occupancy_pct": round(occupied * 100 / total) if total else 0}


@router.get("/properties")
def list_properties(include_archived: bool = False, ctx: Ctx = Depends(staff)):
    q = select(Property).where(Property.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(Property.id.in_(ctx.scope))
    if not include_archived:
        q = q.where(Property.archived_at.is_(None))
    props = ctx.session.exec(q.order_by(Property.name)).all()
    units = ctx.session.exec(select(Unit).where(Unit.org_id == ctx.org_id)).all()
    by_prop: dict[uuid.UUID, list[Unit]] = {}
    for u in units:
        by_prop.setdefault(u.property_id, []).append(u)
    return [{**p.model_dump(), **_unit_summary(by_prop.get(p.id, []))} for p in props]


@router.post("/properties", status_code=201)
def create_property(payload: PropertyIn, ctx: Ctx = Depends(admin_writer)):
    if payload.property_type in ("single_family", "condo", "townhouse"):
        plans.check_unit_limit(ctx.session, ctx.org)
    prop = Property(org_id=ctx.org_id, **payload.model_dump())
    ctx.session.add(prop)
    ctx.session.flush()
    # Single-family / condo / townhouse homes get a default unit so leases can attach immediately.
    if prop.property_type in ("single_family", "condo", "townhouse"):
        ctx.session.add(Unit(org_id=ctx.org_id, property_id=prop.id, name="Main"))
    audit.log(ctx, "property", prop.id, "create", f"Created property {prop.name}")
    ctx.session.commit()
    ctx.session.refresh(prop)
    return prop


@router.get("/properties/{property_id}")
def get_property(property_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    prop = get_owned(ctx, Property, property_id, "Property")
    units = ctx.session.exec(select(Unit).where(Unit.property_id == prop.id).order_by(Unit.name)).all()
    return {**prop.model_dump(), **_unit_summary(list(units)), "units": units}


@router.patch("/properties/{property_id}")
def update_property(property_id: uuid.UUID, payload: PropertyUpdate, ctx: Ctx = Depends(writer)):
    prop = get_owned(ctx, Property, property_id, "Property")
    before = prop.model_dump()
    data = payload.model_dump(exclude_unset=True)
    if data.get("cover_photo_id"):
        doc = ctx.session.get(Document, data["cover_photo_id"])
        if not doc or doc.org_id != ctx.org_id or doc.owner_id != prop.id:
            raise HTTPException(status_code=400, detail="Cover photo must be one of this property's photos.")
    for k, v in data.items():
        setattr(prop, k, v)
    prop.updated_at = utcnow()
    ctx.session.add(prop)
    audit.log(ctx, "property", prop.id, "update", f"Updated property {prop.name}", audit.diff(before, prop.model_dump()))
    ctx.session.commit()
    ctx.session.refresh(prop)
    return prop


@router.post("/properties/{property_id}/archive")
def archive_property(property_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    prop = get_owned(ctx, Property, property_id, "Property")
    active = ctx.session.exec(
        select(Lease.id).join(Unit, Unit.id == Lease.unit_id).where(Unit.property_id == prop.id, Lease.status == "active")
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="End all active leases before archiving this property.")
    prop.archived_at = None if prop.archived_at else utcnow()
    ctx.session.add(prop)
    audit.log(ctx, "property", prop.id, "archive" if prop.archived_at else "unarchive", prop.name)
    ctx.session.commit()
    return prop


@router.delete("/properties/{property_id}")
def delete_property(property_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    prop = get_owned(ctx, Property, property_id, "Property")
    unit_ids = [u.id for u in ctx.session.exec(select(Unit).where(Unit.property_id == prop.id)).all()]
    has_history = (
        (unit_ids and ctx.session.exec(select(Lease.id).where(Lease.unit_id.in_(unit_ids))).first())
        or ctx.session.exec(select(Expense.id).where(Expense.property_id == prop.id)).first()
        or ctx.session.exec(select(WorkOrder.id).where(WorkOrder.property_id == prop.id)).first()
    )
    if has_history:
        raise HTTPException(status_code=400, detail="This property has leases, expenses or work orders. Archive it instead.")
    for u in ctx.session.exec(select(Unit).where(Unit.property_id == prop.id)).all():
        ctx.session.delete(u)
    ctx.session.flush()
    ctx.session.delete(prop)
    audit.log(ctx, "property", prop.id, "delete", f"Deleted property {prop.name}")
    ctx.session.commit()
    return {"ok": True}


# ── Units ────────────────────────────────────────────────────────────────────


@router.get("/units")
def list_units(property_id: uuid.UUID | None = None, ctx: Ctx = Depends(staff)):
    q = select(Unit, Property.name).join(Property, Property.id == Unit.property_id).where(Unit.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(Unit.property_id.in_(ctx.scope))
    if property_id:
        q = q.where(Unit.property_id == property_id)
    rows = ctx.session.exec(q.order_by(Property.name, Unit.name)).all()
    return [{**u.model_dump(), "property_name": name} for u, name in rows]


@router.post("/properties/{property_id}/units", status_code=201)
def create_unit(property_id: uuid.UUID, payload: UnitIn, ctx: Ctx = Depends(writer)):
    prop = get_owned(ctx, Property, property_id, "Property")
    plans.check_unit_limit(ctx.session, ctx.org)
    unit = Unit(org_id=ctx.org_id, property_id=prop.id, **payload.model_dump())
    ctx.session.add(unit)
    ctx.session.flush()
    audit.log(ctx, "unit", unit.id, "create", f"Added unit {unit.name} to {prop.name}")
    ctx.session.commit()
    ctx.session.refresh(unit)
    return unit


@router.get("/units/{unit_id}")
def get_unit(unit_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    unit = get_owned(ctx, Unit, unit_id, "Unit")
    prop = ctx.session.get(Property, unit.property_id)
    return {**unit.model_dump(), "property_name": prop.name}


@router.patch("/units/{unit_id}")
def update_unit(unit_id: uuid.UUID, payload: UnitUpdate, ctx: Ctx = Depends(writer)):
    unit = get_owned(ctx, Unit, unit_id, "Unit")
    before = unit.model_dump()
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        has_active = ctx.session.exec(select(Lease.id).where(Lease.unit_id == unit.id, Lease.status == "active")).first()
        new = data["status"]
        if new == "occupied" and not has_active:
            raise HTTPException(status_code=400, detail="A unit becomes occupied when it has an active lease.")
        if new == "vacant" and has_active:
            data["status"] = "occupied"
    for k, v in data.items():
        setattr(unit, k, v)
    unit.updated_at = utcnow()
    ctx.session.add(unit)
    audit.log(ctx, "unit", unit.id, "update", f"Updated unit {unit.name}", audit.diff(before, unit.model_dump()))
    ctx.session.commit()
    ctx.session.refresh(unit)
    return unit


@router.delete("/units/{unit_id}")
def delete_unit(unit_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    unit = get_owned(ctx, Unit, unit_id, "Unit")
    if (
        ctx.session.exec(select(Lease.id).where(Lease.unit_id == unit.id)).first()
        or ctx.session.exec(select(Expense.id).where(Expense.unit_id == unit.id)).first()
        or ctx.session.exec(select(WorkOrder.id).where(WorkOrder.unit_id == unit.id)).first()
    ):
        raise HTTPException(status_code=400, detail="This unit has leases, expenses or work orders and can't be deleted.")
    ctx.session.delete(unit)
    audit.log(ctx, "unit", unit.id, "delete", f"Deleted unit {unit.name}")
    ctx.session.commit()
    return {"ok": True}
