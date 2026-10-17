"""Send an email and record it in `notifications`, deduplicating automated sends."""
import logging
import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.email import Attachment, send_email
from app.models import Membership, Notification, User

logger = logging.getLogger(__name__)


def already_sent(session: Session, dedupe_key: str) -> bool:
    return session.exec(select(Notification.id).where(Notification.dedupe_key == dedupe_key)).first() is not None


def notify(
    session: Session,
    org_id: uuid.UUID,
    template: str,
    to_email: str,
    subject: str,
    html: str,
    dedupe_key: str | None = None,
    attachments: list[Attachment] | None = None,
) -> bool:
    """Returns True if an email was sent now. Commits its own row."""
    if not to_email:
        return False
    if dedupe_key and already_sent(session, dedupe_key):
        return False

    ok, error = send_email(to_email, subject, html, attachments=attachments)
    row = Notification(
        org_id=org_id,
        template=template,
        to_email=to_email,
        subject=subject[:200],
        dedupe_key=dedupe_key if ok else None,  # failed sends may retry next run
        status="sent" if ok else "failed",
        error=(error or None) and error[:300],
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError:  # concurrent run already recorded this dedupe_key
        session.rollback()
    return ok


def staff_recipients(session: Session, org_id: uuid.UUID, pref: str, roles=("owner", "manager")) -> list[str]:
    """Emails of org staff who haven't opted out of `pref`."""
    rows = session.exec(
        select(User.email, Membership.notification_prefs)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.org_id == org_id, Membership.role.in_(roles))
    ).all()
    return [email for email, prefs in rows if (prefs or {}).get(pref, True)]


def user_wants(session: Session, org_id: uuid.UUID, user_id: uuid.UUID, pref: str) -> bool:
    m = session.exec(select(Membership).where(Membership.org_id == org_id, Membership.user_id == user_id)).first()
    return bool(m) and (m.notification_prefs or {}).get(pref, True)
