"""Expenses, reports (P&L, rent roll, outstanding balances) and the dashboard."""
import csv
import io
import uuid
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.core import audit
from app.core.dates import add_months, period_of, today_in
from app.core.deps import Ctx, finance_read, get_owned, writer
from app.models import (
    Document,
    Expense,
    Lease,
    LeaseTenant,
    LedgerEntry,
    Property,
    Tenant,
    Unit,
    WorkOrder,
    utcnow,
)
from app.schemas import ExpenseIn, ExpenseUpdate
from app.services.billing import balances_for

router = APIRouter(tags=["finance"])

INCOME_TYPES = ("payment",)


# ── Expenses ─────────────────────────────────────────────────────────────────


def _check_refs(ctx: Ctx, property_id, unit_id, receipt_document_id=None, work_order_id=None) -> None:
    if property_id:
        get_owned(ctx, Property, property_id, "Property")
    if unit_id:
        unit = get_owned(ctx, Unit, unit_id, "Unit")
        if property_id and unit.property_id != property_id:
            raise HTTPException(status_code=400, detail="That unit doesn't belong to the selected property.")
    if receipt_document_id:
        get_owned(ctx, Document, receipt_document_id, "Receipt")
    if work_order_id:
        get_owned(ctx, WorkOrder, work_order_id, "Work order")


@router.get("/expenses")
def list_expenses(
    property_id: uuid.UUID | None = None,
    category: str | None = None,
    start: date | None = None,
    end: date | None = None,
    ctx: Ctx = Depends(finance_read),
):
    q = (
        select(Expense, Property.name, Unit.name)
        .join(Property, Property.id == Expense.property_id)
        .outerjoin(Unit, Unit.id == Expense.unit_id)
        .where(Expense.org_id == ctx.org_id)
    )
    if ctx.scope is not None:
        q = q.where(Expense.property_id.in_(ctx.scope))
    if property_id:
        q = q.where(Expense.property_id == property_id)
    if category:
        q = q.where(Expense.category == category)
    if start:
        q = q.where(Expense.expense_date >= start)
    if end:
        q = q.where(Expense.expense_date <= end)
    rows = ctx.session.exec(q.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).limit(1000)).all()
    return [{**e.model_dump(), "property_name": pn, "unit_name": un} for e, pn, un in rows]


@router.post("/expenses", status_code=201)
def create_expense(payload: ExpenseIn, ctx: Ctx = Depends(writer)):
    _check_refs(ctx, payload.property_id, payload.unit_id, payload.receipt_document_id, payload.work_order_id)
    exp = Expense(org_id=ctx.org_id, created_by_user_id=ctx.user.id, **payload.model_dump())
    ctx.session.add(exp)
    ctx.session.flush()
    _attach_receipt(ctx, exp)
    audit.log(ctx, "expense", exp.id, "create", f"Expense {exp.category} ${exp.amount_cents / 100:,.2f}")
    ctx.session.commit()
    ctx.session.refresh(exp)
    return exp


def _attach_receipt(ctx: Ctx, exp: Expense) -> None:
    """Re-home an uploaded receipt onto the expense so it shows in the expense's documents."""
    if not exp.receipt_document_id:
        return
    doc = ctx.session.get(Document, exp.receipt_document_id)
    if doc and doc.org_id == ctx.org_id:
        doc.owner_type, doc.owner_id, doc.kind = "expense", exp.id, "receipt"
        ctx.session.add(doc)


@router.patch("/expenses/{expense_id}")
def update_expense(expense_id: uuid.UUID, payload: ExpenseUpdate, ctx: Ctx = Depends(writer)):
    exp = get_owned(ctx, Expense, expense_id, "Expense")
    data = payload.model_dump(exclude_unset=True)
    _check_refs(ctx, data.get("property_id") or exp.property_id, data.get("unit_id"), data.get("receipt_document_id"))
    before = exp.model_dump()
    for k, v in data.items():
        if v is None and k in ("property_id", "category", "amount_cents", "expense_date"):
            continue
        setattr(exp, k, v)
    exp.updated_at = utcnow()
    _attach_receipt(ctx, exp)
    ctx.session.add(exp)
    audit.log(ctx, "expense", exp.id, "update", "Updated expense", audit.diff(before, exp.model_dump()))
    ctx.session.commit()
    ctx.session.refresh(exp)
    return exp


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    exp = get_owned(ctx, Expense, expense_id, "Expense")
    ctx.session.delete(exp)
    audit.log(ctx, "expense", exp.id, "delete", f"Deleted expense {exp.category} ${exp.amount_cents / 100:,.2f}")
    ctx.session.commit()
    return {"ok": True}


# ── Reports ──────────────────────────────────────────────────────────────────


def _unit_property_map(ctx: Ctx) -> tuple[dict, dict, dict]:
    props = {p.id: p for p in ctx.session.exec(select(Property).where(Property.org_id == ctx.org_id)).all()}
    units = {u.id: u for u in ctx.session.exec(select(Unit).where(Unit.org_id == ctx.org_id)).all()}
    leases = {l.id: l for l in ctx.session.exec(select(Lease).where(Lease.org_id == ctx.org_id)).all()}
    return props, units, leases


def profit_and_loss(ctx: Ctx, start: date, end: date, group_by: str = "property") -> dict:
    """Cash-basis P&L: income = payments received, expenses = expenses dated in range."""
    props, units, leases = _unit_property_map(ctx)
    income = defaultdict(int)
    expense = defaultdict(int)
    by_category = defaultdict(int)

    def key_for(prop_id, unit_id, d: date):
        if group_by == "month":
            return period_of(d)
        if group_by == "unit" and unit_id:
            u = units.get(unit_id)
            return f"{props[u.property_id].name} — {u.name}" if u else "Unassigned"
        return props[prop_id].name if prop_id in props else "Unassigned"

    payments = ctx.session.exec(
        select(LedgerEntry).where(
            LedgerEntry.org_id == ctx.org_id,
            LedgerEntry.entry_type.in_(INCOME_TYPES),
            LedgerEntry.entry_date >= start,
            LedgerEntry.entry_date <= end,
        )
    ).all()
    for e in payments:
        lease = leases.get(e.lease_id)
        unit = units.get(lease.unit_id) if lease else None
        if not ctx.can_see_property(unit.property_id if unit else None):
            continue
        income[key_for(unit.property_id if unit else None, unit.id if unit else None, e.entry_date)] += -e.amount_cents

    for x in ctx.session.exec(
        select(Expense).where(Expense.org_id == ctx.org_id, Expense.expense_date >= start, Expense.expense_date <= end)
    ).all():
        if not ctx.can_see_property(x.property_id):
            continue
        expense[key_for(x.property_id, x.unit_id, x.expense_date)] += x.amount_cents
        by_category[x.category] += x.amount_cents

    keys = sorted(set(income) | set(expense))
    rows = [{"key": k, "income_cents": income[k], "expense_cents": expense[k], "net_cents": income[k] - expense[k]} for k in keys]
    return {
        "start": start,
        "end": end,
        "group_by": group_by,
        "rows": rows,
        "expenses_by_category": dict(sorted(by_category.items(), key=lambda kv: -kv[1])),
        "totals": {
            "income_cents": sum(income.values()),
            "expense_cents": sum(expense.values()),
            "net_cents": sum(income.values()) - sum(expense.values()),
        },
    }


def rent_roll(ctx: Ctx) -> list[dict]:
    rows = ctx.session.exec(
        select(Unit, Property).join(Property, Property.id == Unit.property_id).where(
            Unit.org_id == ctx.org_id, Property.archived_at.is_(None)
        ).order_by(Property.name, Unit.name)
    ).all()
    rows = [r for r in rows if ctx.can_see_property(r[1].id)]
    active = {l.unit_id: l for l in ctx.session.exec(select(Lease).where(Lease.org_id == ctx.org_id, Lease.status == "active")).all()}
    balances = balances_for(ctx.session, [l.id for l in active.values()])
    tenant_names = defaultdict(list)
    if active:
        for lt, t in ctx.session.exec(
            select(LeaseTenant, Tenant).join(Tenant, Tenant.id == LeaseTenant.tenant_id).where(
                LeaseTenant.lease_id.in_([l.id for l in active.values()])
            )
        ).all():
            tenant_names[lt.lease_id].append(f"{t.first_name} {t.last_name}")
    out = []
    for unit, prop in rows:
        lease = active.get(unit.id)
        out.append(
            {
                "property_id": str(prop.id),
                "property_name": prop.name,
                "unit_id": str(unit.id),
                "unit_name": unit.name,
                "status": unit.status,
                "lease_id": str(lease.id) if lease else None,
                "tenants": ", ".join(tenant_names.get(lease.id, [])) if lease else "",
                "rent_cents": lease.rent_cents if lease else 0,
                "market_rent_cents": unit.market_rent_cents,
                "lease_start": lease.start_date if lease else None,
                "lease_end": lease.end_date if lease else None,
                "balance_cents": balances.get(lease.id, 0) if lease else 0,
            }
        )
    return out


def outstanding(ctx: Ctx) -> list[dict]:
    rows = ctx.session.exec(
        select(Lease, Unit, Property).join(Unit, Unit.id == Lease.unit_id).join(Property, Property.id == Unit.property_id).where(Lease.org_id == ctx.org_id)
    ).all()
    rows = [r for r in rows if ctx.can_see_property(r[2].id)]
    balances = balances_for(ctx.session, [l.id for l, _, _ in rows])
    out = []
    for lease, unit, prop in rows:
        bal = balances.get(lease.id, 0)
        if bal > 0:
            names = [
                f"{t.first_name} {t.last_name}"
                for t in ctx.session.exec(
                    select(Tenant).join(LeaseTenant, LeaseTenant.tenant_id == Tenant.id).where(LeaseTenant.lease_id == lease.id)
                ).all()
            ]
            out.append(
                {
                    "lease_id": str(lease.id),
                    "lease_status": lease.status,
                    "property_name": prop.name,
                    "unit_name": unit.name,
                    "tenants": ", ".join(names),
                    "balance_cents": bal,
                }
            )
    return sorted(out, key=lambda r: -r["balance_cents"])


def _default_range(ctx: Ctx, start: date | None, end: date | None) -> tuple[date, date]:
    today = today_in(ctx.org.timezone)
    return start or date(today.year, 1, 1), end or today


_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value):
    """Neutralize spreadsheet formula injection: text starting with = + - @ runs as a formula in Excel."""
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


def _csv(filename: str, header: list[str], rows: list[list]) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows([[_cell(v) for v in row] for row in rows])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


def _d(cents: int | None) -> str:
    return "" if cents is None else f"{cents / 100:.2f}"


@router.get("/reports/pnl")
def report_pnl(
    start: date | None = None,
    end: date | None = None,
    group_by: str = Query(default="property", pattern="^(property|unit|month)$"),
    format: str = Query(default="json", pattern="^(json|csv)$"),
    ctx: Ctx = Depends(finance_read),
):
    start, end = _default_range(ctx, start, end)
    data = profit_and_loss(ctx, start, end, group_by)
    if format == "csv":
        rows = [[r["key"], _d(r["income_cents"]), _d(r["expense_cents"]), _d(r["net_cents"])] for r in data["rows"]]
        t = data["totals"]
        rows.append(["Total", _d(t["income_cents"]), _d(t["expense_cents"]), _d(t["net_cents"])])
        return _csv(f"pnl-{start}-{end}.csv", [group_by.title(), "Income", "Expenses", "Net"], rows)
    return data


@router.get("/reports/rent-roll")
def report_rent_roll(format: str = Query(default="json", pattern="^(json|csv)$"), ctx: Ctx = Depends(finance_read)):
    data = rent_roll(ctx)
    if format == "csv":
        return _csv(
            "rent-roll.csv",
            ["Property", "Unit", "Status", "Tenants", "Rent", "Market rent", "Lease start", "Lease end", "Balance"],
            [
                [r["property_name"], r["unit_name"], r["status"], r["tenants"], _d(r["rent_cents"]), _d(r["market_rent_cents"]),
                 r["lease_start"] or "", r["lease_end"] or "", _d(r["balance_cents"])]
                for r in data
            ],
        )
    return data


@router.get("/reports/outstanding")
def report_outstanding(format: str = Query(default="json", pattern="^(json|csv)$"), ctx: Ctx = Depends(finance_read)):
    data = outstanding(ctx)
    if format == "csv":
        return _csv(
            "outstanding-balances.csv",
            ["Property", "Unit", "Tenants", "Lease status", "Balance"],
            [[r["property_name"], r["unit_name"], r["tenants"], r["lease_status"], _d(r["balance_cents"])] for r in data],
        )
    return data


@router.get("/reports/expenses.csv")
def export_expenses(start: date | None = None, end: date | None = None, ctx: Ctx = Depends(finance_read)):
    start, end = _default_range(ctx, start, end)
    rows = list_expenses(None, None, start, end, ctx)
    return _csv(
        f"expenses-{start}-{end}.csv",
        ["Date", "Property", "Unit", "Category", "Vendor", "Description", "Amount"],
        [[r["expense_date"], r["property_name"], r["unit_name"] or "", r["category"], r["vendor"] or "", r["description"] or "", _d(r["amount_cents"])] for r in rows],
    )


# ── Dashboard ────────────────────────────────────────────────────────────────


@router.get("/dashboard")
def dashboard(ctx: Ctx = Depends(finance_read)):
    today = today_in(ctx.org.timezone)
    first_of_month = today.replace(day=1)
    window_start = add_months(first_of_month, -11)

    pnl_months = profit_and_loss(ctx, window_start, today, "month")
    by_month = {r["key"]: r for r in pnl_months["rows"]}
    cash_flow = []
    d = window_start
    while d <= today:
        key = period_of(d)
        r = by_month.get(key, {"income_cents": 0, "expense_cents": 0, "net_cents": 0})
        cash_flow.append({"period": key, "income_cents": r["income_cents"], "expense_cents": r["expense_cents"], "net_cents": r["net_cents"]})
        d = add_months(d, 1)

    units = ctx.session.exec(
        select(Unit).join(Property, Property.id == Unit.property_id).where(Unit.org_id == ctx.org_id, Property.archived_at.is_(None))
    ).all()
    units = [u for u in units if ctx.can_see_property(u.property_id)]
    occupied = sum(1 for u in units if u.status == "occupied")
    units_by_id = {u.id: u for u in units}

    period = period_of(today)
    month_entries = ctx.session.exec(
        select(LedgerEntry).where(LedgerEntry.org_id == ctx.org_id, LedgerEntry.entry_date >= first_of_month, LedgerEntry.entry_date <= today)
    ).all()
    if ctx.scope is not None:
        lease_props = {l.id: units_by_id[l.unit_id].property_id for l in ctx.session.exec(select(Lease).where(Lease.org_id == ctx.org_id)).all() if l.unit_id in units_by_id}
        month_entries = [e for e in month_entries if lease_props.get(e.lease_id) in ctx.scope]
    billed = sum(e.amount_cents for e in month_entries if e.entry_type in ("rent", "recurring", "late_fee", "charge") and e.amount_cents > 0)
    collected = sum(-e.amount_cents for e in month_entries if e.entry_type == "payment")
    owed = outstanding(ctx)

    expiring = ctx.session.exec(
        select(Lease, Unit.name, Property.name)
        .join(Unit, Unit.id == Lease.unit_id)
        .join(Property, Property.id == Unit.property_id)
        .where(
            Lease.org_id == ctx.org_id,
            Lease.status == "active",
            Lease.end_date.is_not(None),
            Lease.end_date <= today + timedelta(days=90),
        )
        .order_by(Lease.end_date)
    ).all()
    expiring = [r for r in expiring if r[0].unit_id in units_by_id]
    open_wo = ctx.session.exec(
        select(WorkOrder).where(WorkOrder.org_id == ctx.org_id, WorkOrder.status.not_in(("completed", "closed")))
    ).all()
    open_wo = [w for w in open_wo if ctx.can_see_property(w.property_id)]

    return {
        "today": today,
        "period": period,
        "properties": len({u.property_id for u in units}),
        "units": len(units),
        "occupied_units": occupied,
        "occupancy_pct": round(occupied * 100 / len(units)) if units else 0,
        "month": {"billed_cents": billed, "collected_cents": collected},
        "outstanding_cents": sum(r["balance_cents"] for r in owed),
        "outstanding": owed[:5],
        "ytd": profit_and_loss(ctx, date(today.year, 1, 1), today, "property")["totals"],
        "cash_flow": cash_flow,
        "expiring_leases": [
            {"lease_id": str(l.id), "unit_name": un, "property_name": pn, "end_date": l.end_date, "days_left": (l.end_date - today).days}
            for l, un, pn in expiring
        ],
        "open_work_orders": {
            "total": len(open_wo),
            "emergency": sum(1 for w in open_wo if w.priority == "emergency"),
            "high": sum(1 for w in open_wo if w.priority == "high"),
        },
    }
