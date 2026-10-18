"""Work-order helpers shared by the staff and tenant-portal routers."""
import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import settings
from app.core.email import esc, layout
from app.models import Organization, Property, Tenant, Unit, User, WorkOrder, WorkOrderComment
from app.services.notify import notify, staff_recipients, user_wants

STATUS_LABELS = {
    "new": "New",
    "assigned": "Assigned",
    "scheduled": "Scheduled",
    "in_progress": "In progress",
    "completed": "Completed",
    "closed": "Closed",
}


def next_number(session: Session, org_id: uuid.UUID) -> int:
    current = session.exec(select(func.max(WorkOrder.number)).where(WorkOrder.org_id == org_id)).one()
    return int(current or 0) + 1


def location(session: Session, wo: WorkOrder) -> str:
    prop = session.get(Property, wo.property_id)
    unit = session.get(Unit, wo.unit_id) if wo.unit_id else None
    return f"{prop.name}" + (f" — {unit.name}" if unit else "")


def serialize(session: Session, wo: WorkOrder, include_internal: bool) -> dict:
    prop = session.get(Property, wo.property_id)
    unit = session.get(Unit, wo.unit_id) if wo.unit_id else None
    tenant = session.get(Tenant, wo.tenant_id) if wo.tenant_id else None
    assignee = session.get(User, wo.assigned_to_user_id) if wo.assigned_to_user_id else None
    q = select(WorkOrderComment, User.name).outerjoin(User, User.id == WorkOrderComment.author_user_id).where(
        WorkOrderComment.work_order_id == wo.id
    )
    if not include_internal:
        q = q.where(WorkOrderComment.is_internal == False)  # noqa: E712
    comments = [
        {**c.model_dump(), "author_name": name or "System"}
        for c, name in session.exec(q.order_by(WorkOrderComment.created_at)).all()
    ]
    return {
        **wo.model_dump(),
        "property_name": prop.name if prop else None,
        "unit_name": unit.name if unit else None,
        "tenant_name": f"{tenant.first_name} {tenant.last_name}" if tenant else None,
        "assignee_name": assignee.name if assignee else None,
        "comments": comments,
    }


def add_system_comment(session: Session, wo: WorkOrder, actor_id: uuid.UUID | None, text: str) -> None:
    session.add(WorkOrderComment(org_id=wo.org_id, work_order_id=wo.id, author_user_id=actor_id, body=text, is_system=True))


def _tenant_email(session: Session, wo: WorkOrder) -> str | None:
    if not wo.tenant_id:
        return None
    tenant = session.get(Tenant, wo.tenant_id)
    if not tenant:
        return None
    if tenant.user_id and not user_wants(session, wo.org_id, tenant.user_id, "maintenance_updates"):
        return None
    if tenant.user_id:
        user = session.get(User, tenant.user_id)
        return user.email if user else tenant.email
    return tenant.email


def notify_new(session: Session, org: Organization, wo: WorkOrder) -> None:
    where = location(session, wo)
    subject = f"New maintenance request #{wo.number} — {where}"
    html = layout(
        "New maintenance request",
        f"<p><strong>{esc(wo.title)}</strong> ({esc(wo.priority)} priority)</p>"
        f"<p>{esc(wo.description or '')}</p><p>{esc(where)}</p>",
        "Open work order",
        f"{settings.frontend_url}/maintenance/{wo.id}",
    )
    for email in staff_recipients(session, org.id, "maintenance_updates"):
        notify(session, org.id, "work_order_new", email, subject, html)
    from app.services import push

    push.send(session, push.staff_user_ids(session, org.id) + [wo.assigned_to_user_id], f"New request #{wo.number}", f"{wo.title} — {where}", {"type": "work_order", "id": str(wo.id)})


def notify_tenant(session: Session, org: Organization, wo: WorkOrder, message: str) -> None:
    tenant = session.get(Tenant, wo.tenant_id) if wo.tenant_id else None
    if tenant and tenant.user_id:
        from app.services import push

        push.send(session, [tenant.user_id], f"Request #{wo.number}: {STATUS_LABELS.get(wo.status, wo.status)}", message[:200], {"type": "portal_work_order", "id": str(wo.id)})
    email = _tenant_email(session, wo)
    if not email:
        return
    subject = f"Update on your request #{wo.number}: {wo.title}"
    html = layout(
        "Maintenance update",
        f"<p>{esc(message)}</p><p>Status: <strong>{STATUS_LABELS.get(wo.status, wo.status)}</strong></p>",
        "View request",
        f"{settings.frontend_url}/portal/maintenance/{wo.id}",
    )
    notify(session, org.id, "work_order_update", email, subject, html)


def notify_staff_comment(session: Session, org: Organization, wo: WorkOrder, author: str, body: str) -> None:
    subject = f"New comment on #{wo.number}: {wo.title}"
    html = layout(
        "New comment",
        f"<p><strong>{esc(author)}</strong> wrote:</p><p>{esc(body)}</p>",
        "Open work order",
        f"{settings.frontend_url}/maintenance/{wo.id}",
    )
    recipients = set(staff_recipients(session, org.id, "maintenance_updates"))
    if wo.assigned_to_user_id:
        assignee = session.get(User, wo.assigned_to_user_id)
        if assignee and user_wants(session, org.id, assignee.id, "maintenance_updates"):
            recipients.add(assignee.email)
    for email in recipients:
        notify(session, org.id, "work_order_comment", email, subject, html)
