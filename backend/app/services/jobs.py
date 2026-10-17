"""Daily automation, triggered by Vercel Cron (`/api/cron/daily`).

Every step is idempotent (ledger `source_key`, notification `dedupe_key`), so
it is safe to run more than once a day or to catch up after a missed day.
Steps run per organization using that organization's local date.
"""
import logging
from datetime import date, timedelta

from sqlmodel import Session, select

from app.core.config import settings
from app.core.dates import period_of, today_in
from app.core.email import esc, layout
from app.models import Document, Lease, LeaseTenant, Organization, Property, Tenant, Unit
from app.services import billing
from app.services.notify import already_sent, notify, staff_recipients
from app.services.receipts import money

logger = logging.getLogger(__name__)

UPCOMING_DAYS = 3
LEASE_EXPIRY_THRESHOLDS = (30, 60, 90)
DOC_EXPIRY_DAYS = 30


def _lease_label(session: Session, lease: Lease) -> str:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id) if unit else None
    return f"{prop.name if prop else 'Property'} — {unit.name if unit else 'Unit'}"


def _lease_tenants(session: Session, lease_id) -> list[Tenant]:
    return list(
        session.exec(
            select(Tenant).join(LeaseTenant, LeaseTenant.tenant_id == Tenant.id).where(LeaseTenant.lease_id == lease_id)
        ).all()
    )


def rent_reminders(session: Session, org: Organization, lease: Lease, today: date) -> int:
    sent = 0
    tenants = [t for t in _lease_tenants(session, lease.id) if t.email]
    if not tenants:
        return 0
    label = _lease_label(session, lease)
    portal = f"{settings.frontend_url}/portal"

    def send(kind: str, period: str, subject: str, body: str) -> None:
        nonlocal sent
        for t in tenants:
            key = f"rent_{kind}:{lease.id}:{period}:{t.email}"
            html = layout(subject, f"<p>Hi {esc(t.first_name)},</p>{body}", "View balance", portal)
            sent += notify(session, org.id, f"rent_{kind}", t.email, subject, html, dedupe_key=key)

    nxt = billing.next_due_date(lease, today)
    if nxt and 0 < (nxt - today).days <= UPCOMING_DAYS:
        send(
            "upcoming",
            period_of(nxt),
            f"Rent due {nxt.strftime('%b %d')} — {label}",
            f"<p>Your rent of <strong>{money(lease.rent_cents, org.currency)}</strong> for {esc(label)} "
            f"is due on {nxt.strftime('%B %d, %Y')}.</p>",
        )

    dues = billing.due_dates(lease, today)
    if not dues:
        return sent
    last_due = dues[-1]
    balance = billing.lease_balance(session, lease.id)
    if balance <= 0:
        return sent
    period = period_of(last_due)
    deadline = last_due + timedelta(days=lease.grace_days)
    if today == last_due or (last_due <= today <= deadline):
        send(
            "due",
            period,
            f"Rent is due today — {label}" if today == last_due else f"Rent reminder — {label}",
            f"<p>Your current balance for {esc(label)} is <strong>{money(balance, org.currency)}</strong>.</p>",
        )
    elif today > deadline:
        send(
            "overdue",
            period,
            f"Rent overdue — {label}",
            f"<p>Your balance of <strong>{money(balance, org.currency)}</strong> for {esc(label)} is past due. "
            f"Please pay as soon as possible to avoid further fees.</p>",
        )
    return sent


def lease_expiry_alerts(session: Session, org: Organization, lease: Lease, today: date) -> int:
    if not lease.end_date:
        return 0
    days_left = (lease.end_date - today).days
    if days_left < 0:
        return 0
    threshold = next((t for t in LEASE_EXPIRY_THRESHOLDS if days_left <= t), None)
    if threshold is None:
        return 0
    key_base = f"lease_expiry:{lease.id}:{lease.end_date}:{threshold}"
    label = _lease_label(session, lease)
    subject = f"Lease ends in {days_left} days — {label}"
    html = layout(
        "Lease expiring soon",
        f"<p>The lease for <strong>{esc(label)}</strong> ends on {lease.end_date.strftime('%B %d, %Y')} "
        f"({days_left} days). Plan a renewal or move-out.</p>",
        "Open lease",
        f"{settings.frontend_url}/leases/{lease.id}",
    )
    sent = 0
    for email in staff_recipients(session, org.id, "lease_expiry"):
        sent += notify(session, org.id, "lease_expiry", email, subject, html, dedupe_key=f"{key_base}:{email}")
    return sent


def document_expiry_alerts(session: Session, org: Organization, today: date) -> int:
    horizon = today + timedelta(days=DOC_EXPIRY_DAYS)
    docs = session.exec(
        select(Document).where(
            Document.org_id == org.id, Document.expires_on.is_not(None), Document.expires_on <= horizon
        )
    ).all()
    docs = [d for d in docs if d.expires_on >= today - timedelta(days=1)]
    if not docs:
        return 0
    sent = 0
    for email in staff_recipients(session, org.id, "document_expiry"):
        pending = [d for d in docs if not already_sent(session, f"doc_expiry:{d.id}:{d.expires_on}:{email}")]
        for d in pending:
            subject = f"Document expiring {d.expires_on.strftime('%b %d')}: {d.name}"
            html = layout(
                "Document expiring soon",
                f"<p><strong>{esc(d.name)}</strong> ({esc(d.kind)}) expires on {d.expires_on.strftime('%B %d, %Y')}.</p>",
                "Open documents",
                f"{settings.frontend_url}/documents",
            )
            sent += notify(session, org.id, "document_expiry", email, subject, html, dedupe_key=f"doc_expiry:{d.id}:{d.expires_on}:{email}")
    return sent


def run_daily_for_org(session: Session, org: Organization, today: date | None = None) -> dict[str, int]:
    today = today or today_in(org.timezone)
    stats = {"rent_entries": 0, "late_fees": 0, "reminders": 0, "lease_alerts": 0, "document_alerts": 0}
    for lease in billing.active_leases(session, org.id):
        stats["rent_entries"] += billing.post_rent_for_lease(session, lease, today)
        stats["late_fees"] += int(billing.apply_late_fee_for_lease(session, lease, today))
        session.commit()
        stats["reminders"] += rent_reminders(session, org, lease, today)
        stats["lease_alerts"] += lease_expiry_alerts(session, org, lease, today)
    stats["document_alerts"] += document_expiry_alerts(session, org, today)
    session.commit()
    return stats


def run_daily(session: Session) -> dict[str, dict[str, int]]:
    results = {}
    for org in session.exec(select(Organization)).all():
        try:
            results[str(org.id)] = run_daily_for_org(session, org)
        except Exception:  # noqa: BLE001 — one bad org must not block the rest
            session.rollback()
            logger.exception("Daily job failed for org %s", org.id)
            results[str(org.id)] = {"error": 1}
    return results
