"""Rent posting, late fees, balances and payments (balance-forward ledger).

All automated postings carry a `source_key` with a unique constraint, so running
any job twice (cron retries, manual re-runs) never duplicates a charge.
"""
import uuid
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.dates import due_date_for, month_iter, period_of
from app.models import Lease, LedgerEntry, Payment, RecurringCharge, Unit


def lease_balance(session: Session, lease_id: uuid.UUID, as_of: date | None = None) -> int:
    q = select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0)).where(LedgerEntry.lease_id == lease_id)
    if as_of:
        q = q.where(LedgerEntry.entry_date <= as_of)
    return int(session.exec(q).one())


def balances_for(session: Session, lease_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not lease_ids:
        return {}
    rows = session.exec(
        select(LedgerEntry.lease_id, func.sum(LedgerEntry.amount_cents))
        .where(LedgerEntry.lease_id.in_(lease_ids))
        .group_by(LedgerEntry.lease_id)
    ).all()
    out = {lid: 0 for lid in lease_ids}
    out.update({lid: int(total or 0) for lid, total in rows})
    return out


def _add_once(session: Session, entry: LedgerEntry) -> bool:
    """Insert an automated entry unless its source_key already exists."""
    if session.exec(select(LedgerEntry.id).where(LedgerEntry.source_key == entry.source_key)).first():
        return False
    try:
        with session.begin_nested():
            session.add(entry)
        return True
    except IntegrityError:
        return False


def due_dates(lease: Lease, today: date) -> list[date]:
    """Due dates that should have been billed by `today`."""
    start = max(lease.start_date, lease.charges_start_on)
    last = today
    if lease.end_date and lease.end_date < last:
        last = lease.end_date
    if lease.ended_on and lease.ended_on < last:
        last = lease.ended_on
    if last < start:
        return []
    out = []
    for y, m in month_iter(start, last):
        d = due_date_for(y, m, lease.due_day)
        if start <= d <= last:
            out.append(d)
    return out


def next_due_date(lease: Lease, today: date) -> date | None:
    """The next due date on/after today, if it falls within the lease's billing window."""
    d = due_date_for(today.year, today.month, lease.due_day)
    if d < today:
        y, m = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
        d = due_date_for(y, m, lease.due_day)
    start = max(lease.start_date, lease.charges_start_on)
    if d < start or (lease.end_date and d > lease.end_date):
        return None
    return d


def post_rent_for_lease(session: Session, lease: Lease, today: date) -> int:
    """Post rent + recurring charges for every due date up to today. Returns entries created."""
    created = 0
    charges = session.exec(select(RecurringCharge).where(RecurringCharge.lease_id == lease.id)).all()
    for d in due_dates(lease, today):
        period = period_of(d)
        label = d.strftime("%B %Y")
        created += _add_once(
            session,
            LedgerEntry(
                org_id=lease.org_id,
                lease_id=lease.id,
                entry_type="rent",
                description=f"Rent — {label}",
                amount_cents=lease.rent_cents,
                entry_date=d,
                period=period,
                source_key=f"rent:{lease.id}:{period}",
            ),
        )
        for c in charges:
            created += _add_once(
                session,
                LedgerEntry(
                    org_id=lease.org_id,
                    lease_id=lease.id,
                    entry_type="recurring",
                    description=f"{c.description} — {label}",
                    amount_cents=c.amount_cents,
                    entry_date=d,
                    period=period,
                    source_key=f"rc:{c.id}:{period}",
                ),
            )
    return created


def late_fee_amount(lease: Lease) -> int:
    if lease.late_fee_type == "flat":
        return lease.late_fee_amount
    if lease.late_fee_type == "percent":
        return round(lease.rent_cents * lease.late_fee_amount / 10_000)
    return 0


def apply_late_fee_for_lease(session: Session, lease: Lease, today: date) -> bool:
    """Charge one late fee for the most recent period if still unpaid after the grace period."""
    fee = late_fee_amount(lease)
    if fee <= 0:
        return False
    dues = due_dates(lease, today)
    if not dues:
        return False
    due = dues[-1]
    deadline = due + timedelta(days=lease.grace_days)
    if today <= deadline:
        return False
    if lease_balance(session, lease.id) <= 0:
        return False
    period = period_of(due)
    return _add_once(
        session,
        LedgerEntry(
            org_id=lease.org_id,
            lease_id=lease.id,
            entry_type="late_fee",
            description=f"Late fee — {due.strftime('%B %Y')}",
            amount_cents=fee,
            entry_date=today,
            period=period,
            source_key=f"late:{lease.id}:{period}",
        ),
    )


def active_leases(session: Session, org_id: uuid.UUID) -> list[Lease]:
    return list(session.exec(select(Lease).where(Lease.org_id == org_id, Lease.status == "active")).all())


def next_receipt_number(session: Session, org_id: uuid.UUID, on: date) -> str:
    count = session.exec(select(func.count()).select_from(Payment).where(Payment.org_id == org_id)).one()
    return f"R-{on.year}-{int(count) + 1:05d}"


def record_payment(session: Session, lease: Lease, payment: Payment) -> LedgerEntry:
    session.add(payment)
    session.flush()
    entry = LedgerEntry(
        org_id=lease.org_id,
        lease_id=lease.id,
        entry_type="payment",
        description=f"Payment — {payment.method.replace('_', ' ').title()}"
        + (f" ({payment.reference})" if payment.reference else ""),
        amount_cents=-payment.amount_cents,
        entry_date=payment.received_on,
        payment_id=payment.id,
        created_by_user_id=payment.created_by_user_id,
    )
    session.add(entry)
    return entry


def sync_unit_status(session: Session, unit_id: uuid.UUID) -> None:
    """Occupied if any active lease exists; otherwise vacant (unless under maintenance)."""
    unit = session.get(Unit, unit_id)
    if not unit:
        return
    has_active = session.exec(
        select(Lease.id).where(Lease.unit_id == unit_id, Lease.status == "active")
    ).first()
    if has_active:
        unit.status = "occupied"
    elif unit.status == "occupied":
        unit.status = "vacant"
    session.add(unit)
