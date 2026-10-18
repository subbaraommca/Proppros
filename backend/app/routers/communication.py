"""Messages, announcements, formal notices, move-out notices, renter's insurance and SMS (Twilio)."""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlmodel import Session, func, select

from app.core import audit
from app.core.config import settings
from app.core.database import get_session
from app.core.dates import today_in
from app.core.deps import Ctx, get_owned, staff, tenant_in_scope, tenant_only, writer
from app.core.email import Attachment, esc, layout
from app.models import (
    Announcement,
    Document,
    Lease,
    LeaseTenant,
    Message,
    MessageThread,
    MoveOutNotice,
    Notice,
    Organization,
    Property,
    Tenant,
    Unit,
    utcnow,
)
from app.routers.documents import store_upload
from app.schemas import (
    AnnouncementIn,
    MessageIn,
    MoveOutAckIn,
    MoveOutIn,
    NoticeIn,
    NoticePreviewIn,
    PortalThreadIn,
    SmsPrefsIn,
    ThreadIn,
    ThreadUpdate,
)
from app.services import billing
from app.services import leasing as L
from app.services import sms
from app.services.notify import notify, staff_recipients
from app.services.receipts import money

router = APIRouter(tags=["communication"])

# Staff who talk to tenants (accountants read finance only; maintenance uses work-order comments).
messengers = writer


def _portal_url(path: str = "") -> str:
    return f"{settings.frontend_url}/portal{path}"


def _active_lease(session: Session, tenant_id: uuid.UUID) -> Lease | None:
    return session.exec(
        select(Lease).join(LeaseTenant, LeaseTenant.lease_id == Lease.id).where(LeaseTenant.tenant_id == tenant_id).order_by(Lease.status, Lease.start_date.desc())
    ).first()


def _property_of_lease(session: Session, lease: Lease | None) -> uuid.UUID | None:
    if not lease:
        return None
    unit = session.get(Unit, lease.unit_id)
    return unit.property_id if unit else None


def _tell_tenant(session: Session, org: Organization, tenant: Tenant, subject: str, html: str, sms_body: str | None) -> dict[str, bool]:
    out = {"email": False, "sms": False}
    if tenant.email:
        out["email"] = notify(session, org.id, "tenant_message", tenant.email, subject, html)
    if sms_body and tenant.sms_opt_in and tenant.phone:
        out["sms"] = sms.text(session, org.id, "tenant_message", tenant.phone, sms_body)
    return out


# ── Message threads (staff) ──────────────────────────────────────────────────


def _thread_scope_ok(ctx: Ctx, t: MessageThread) -> bool:
    if ctx.scope is None:
        return True
    if t.property_id:
        return t.property_id in ctx.scope
    return tenant_in_scope(ctx, t.tenant_id)


def _thread(ctx: Ctx, thread_id: uuid.UUID) -> MessageThread:
    t = ctx.session.get(MessageThread, thread_id)
    if not t or t.org_id != ctx.org_id or not _thread_scope_ok(ctx, t):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return t


def _unread_for_staff(t: MessageThread) -> bool:
    return t.last_author_role == "tenant" and (t.staff_read_at is None or t.staff_read_at < t.last_message_at)


def _unread_for_tenant(t: MessageThread) -> bool:
    return t.last_author_role == "staff" and (t.tenant_read_at is None or t.tenant_read_at < t.last_message_at)


def _thread_row(session: Session, t: MessageThread, for_staff: bool) -> dict:
    tenant = session.get(Tenant, t.tenant_id)
    prop = session.get(Property, t.property_id) if t.property_id else None
    last = session.exec(select(Message).where(Message.thread_id == t.id).order_by(Message.created_at.desc())).first()
    return {
        "id": str(t.id),
        "subject": t.subject,
        "tenant_id": str(t.tenant_id),
        "tenant_name": f"{tenant.first_name} {tenant.last_name}" if tenant else "",
        "property_name": prop.name if prop else None,
        "last_message_at": t.last_message_at,
        "last_author_role": t.last_author_role,
        "preview": (last.body[:140] if last else ""),
        "unread": _unread_for_staff(t) if for_staff else _unread_for_tenant(t),
        "archived": t.archived,
    }


def _messages(session: Session, t: MessageThread) -> list[dict]:
    from app.models import User

    rows = session.exec(select(Message, User.name).outerjoin(User, User.id == Message.author_user_id).where(Message.thread_id == t.id).order_by(Message.created_at)).all()
    return [{"id": str(m.id), "body": m.body, "author_role": m.author_role, "author_name": name or ("Tenant" if m.author_role == "tenant" else "Team"), "via": m.via, "created_at": m.created_at} for m, name in rows]


@router.get("/messages/threads")
def list_threads(archived: bool = False, ctx: Ctx = Depends(messengers)):
    threads = ctx.session.exec(
        select(MessageThread).where(MessageThread.org_id == ctx.org_id, MessageThread.archived == archived).order_by(MessageThread.last_message_at.desc()).limit(300)
    ).all()
    return [_thread_row(ctx.session, t, True) for t in threads if _thread_scope_ok(ctx, t)]


@router.get("/messages/unread-count")
def unread_count(ctx: Ctx = Depends(staff)):
    if ctx.role not in ("owner", "manager"):
        return {"count": 0}
    threads = ctx.session.exec(select(MessageThread).where(MessageThread.org_id == ctx.org_id, MessageThread.archived == False, MessageThread.last_author_role == "tenant")).all()  # noqa: E712
    return {"count": sum(1 for t in threads if _unread_for_staff(t) and _thread_scope_ok(ctx, t))}


def _post(session: Session, org: Organization, t: MessageThread, author_id: uuid.UUID | None, role: str, body: str, via: str = "app") -> Message:
    m = Message(org_id=org.id, thread_id=t.id, author_user_id=author_id, author_role=role, body=body, via=via)
    session.add(m)
    t.last_message_at = m.created_at
    t.last_author_role = role
    if role == "staff":
        t.staff_read_at = m.created_at
    else:
        t.tenant_read_at = m.created_at
    t.archived = False
    t.updated_at = utcnow()
    session.add(t)
    return m


def _notify_tenant_of_message(session: Session, org: Organization, t: MessageThread, sender: str, body: str) -> dict:
    tenant = session.get(Tenant, t.tenant_id)
    html = layout(
        f"New message from {org.name}",
        f"<p><strong>{esc(sender)}</strong> wrote about “{esc(t.subject)}”:</p><blockquote style='border-left:3px solid #a4502a;margin:0;padding:4px 12px;white-space:pre-wrap'>{esc(body)}</blockquote>",
        "Reply in the portal" if tenant.user_id else None,
        _portal_url(f"/messages/{t.id}") if tenant.user_id else None,
    )
    return _tell_tenant(session, org, tenant, f"{org.name}: {t.subject}", html, f"{org.name}: {body[:300]}{'' if len(body) <= 300 else '…'}" + (" — reply in your tenant portal." if tenant.user_id else ""))


@router.post("/messages/threads", status_code=201)
def start_thread(payload: ThreadIn, ctx: Ctx = Depends(messengers)):
    tenant = get_owned(ctx, Tenant, payload.tenant_id, "Tenant")
    lease = _active_lease(ctx.session, tenant.id)
    t = MessageThread(org_id=ctx.org_id, tenant_id=tenant.id, lease_id=lease.id if lease else None, property_id=_property_of_lease(ctx.session, lease), subject=payload.subject)
    ctx.session.add(t)
    ctx.session.flush()
    _post(ctx.session, ctx.org, t, ctx.user.id, "staff", payload.body)
    ctx.session.commit()
    sent = _notify_tenant_of_message(ctx.session, ctx.org, t, ctx.user.name, payload.body)
    return {**_thread_row(ctx.session, t, True), "messages": _messages(ctx.session, t), "delivered": sent}


@router.get("/messages/threads/{thread_id}")
def get_thread(thread_id: uuid.UUID, ctx: Ctx = Depends(messengers)):
    t = _thread(ctx, thread_id)
    t.staff_read_at = utcnow()
    ctx.session.add(t)
    ctx.session.commit()
    tenant = ctx.session.get(Tenant, t.tenant_id)
    return {
        **_thread_row(ctx.session, t, True),
        "messages": _messages(ctx.session, t),
        "tenant": {"id": str(tenant.id), "email": tenant.email, "phone": tenant.phone, "has_portal": bool(tenant.user_id), "sms_opt_in": tenant.sms_opt_in},
        "tenant_read_at": t.tenant_read_at,
    }


@router.post("/messages/threads/{thread_id}", status_code=201)
def reply(thread_id: uuid.UUID, payload: MessageIn, ctx: Ctx = Depends(messengers)):
    t = _thread(ctx, thread_id)
    _post(ctx.session, ctx.org, t, ctx.user.id, "staff", payload.body)
    ctx.session.commit()
    sent = _notify_tenant_of_message(ctx.session, ctx.org, t, ctx.user.name, payload.body)
    return {"messages": _messages(ctx.session, t), "delivered": sent}


@router.patch("/messages/threads/{thread_id}")
def update_thread(thread_id: uuid.UUID, payload: ThreadUpdate, ctx: Ctx = Depends(messengers)):
    t = _thread(ctx, thread_id)
    t.archived = payload.archived
    ctx.session.add(t)
    ctx.session.commit()
    return _thread_row(ctx.session, t, True)


# ── Message threads (tenant portal) ──────────────────────────────────────────


def _my_tenants(ctx: Ctx) -> list[Tenant]:
    return list(ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id, Tenant.user_id == ctx.user.id)).all())


def _my_thread(ctx: Ctx, thread_id: uuid.UUID) -> MessageThread:
    t = ctx.session.get(MessageThread, thread_id)
    if not t or t.org_id != ctx.org_id or t.tenant_id not in {x.id for x in _my_tenants(ctx)}:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return t


def _notify_staff_of_message(session: Session, org: Organization, t: MessageThread, tenant: Tenant, body: str) -> None:
    html = layout(
        f"Message from {tenant.first_name} {tenant.last_name}",
        f"<p>About “{esc(t.subject)}”:</p><blockquote style='border-left:3px solid #a4502a;margin:0;padding:4px 12px;white-space:pre-wrap'>{esc(body)}</blockquote>",
        "Reply",
        f"{settings.frontend_url}/messages/{t.id}",
    )
    for email in staff_recipients(session, org.id, "maintenance_updates"):
        notify(session, org.id, "staff_message", email, f"Message from {tenant.first_name} {tenant.last_name}: {t.subject}", html)


@router.get("/portal/messages")
def portal_threads(ctx: Ctx = Depends(tenant_only)):
    ids = [x.id for x in _my_tenants(ctx)]
    if not ids:
        return []
    threads = ctx.session.exec(select(MessageThread).where(MessageThread.tenant_id.in_(ids)).order_by(MessageThread.last_message_at.desc())).all()
    return [_thread_row(ctx.session, t, False) for t in threads]


@router.post("/portal/messages", status_code=201)
def portal_start_thread(payload: PortalThreadIn, ctx: Ctx = Depends(tenant_only)):
    tenants = _my_tenants(ctx)
    if not tenants:
        raise HTTPException(status_code=400, detail="Your account isn't linked to a tenant record yet.")
    tenant = tenants[0]
    lease = _active_lease(ctx.session, tenant.id)
    t = MessageThread(org_id=ctx.org_id, tenant_id=tenant.id, lease_id=lease.id if lease else None, property_id=_property_of_lease(ctx.session, lease), subject=payload.subject)
    ctx.session.add(t)
    ctx.session.flush()
    _post(ctx.session, ctx.org, t, ctx.user.id, "tenant", payload.body)
    ctx.session.commit()
    _notify_staff_of_message(ctx.session, ctx.org, t, tenant, payload.body)
    return {**_thread_row(ctx.session, t, False), "messages": _messages(ctx.session, t)}


@router.get("/portal/messages/{thread_id}")
def portal_thread(thread_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    t = _my_thread(ctx, thread_id)
    t.tenant_read_at = utcnow()
    ctx.session.add(t)
    ctx.session.commit()
    return {**_thread_row(ctx.session, t, False), "messages": _messages(ctx.session, t)}


@router.post("/portal/messages/{thread_id}", status_code=201)
def portal_reply(thread_id: uuid.UUID, payload: MessageIn, ctx: Ctx = Depends(tenant_only)):
    t = _my_thread(ctx, thread_id)
    tenant = ctx.session.get(Tenant, t.tenant_id)
    _post(ctx.session, ctx.org, t, ctx.user.id, "tenant", payload.body)
    ctx.session.commit()
    _notify_staff_of_message(ctx.session, ctx.org, t, tenant, payload.body)
    return {"messages": _messages(ctx.session, t)}


# ── Announcements ────────────────────────────────────────────────────────────


def _tenants_at(session: Session, org_id: uuid.UUID, property_id: uuid.UUID | None, scope: set | None) -> list[Tenant]:
    q = (
        select(Tenant, Unit.property_id)
        .join(LeaseTenant, LeaseTenant.tenant_id == Tenant.id)
        .join(Lease, Lease.id == LeaseTenant.lease_id)
        .join(Unit, Unit.id == Lease.unit_id)
        .where(Tenant.org_id == org_id, Lease.status == "active")
    )
    if property_id:
        q = q.where(Unit.property_id == property_id)
    seen, out = set(), []
    for t, pid in session.exec(q).all():
        if scope is not None and pid not in scope:
            continue
        if t.id not in seen:
            seen.add(t.id)
            out.append(t)
    return out


def _announcement_out(session: Session, a: Announcement) -> dict:
    prop = session.get(Property, a.property_id) if a.property_id else None
    return {**a.model_dump(), "property_name": prop.name if prop else None}


@router.get("/announcements")
def list_announcements(ctx: Ctx = Depends(messengers)):
    q = select(Announcement).where(Announcement.org_id == ctx.org_id)
    rows = ctx.session.exec(q.order_by(Announcement.created_at.desc()).limit(100)).all()
    if ctx.scope is not None:
        rows = [a for a in rows if a.property_id in ctx.scope]
    return [_announcement_out(ctx.session, a) for a in rows]


@router.post("/announcements", status_code=201)
def create_announcement(payload: AnnouncementIn, ctx: Ctx = Depends(messengers)):
    if payload.property_id:
        get_owned(ctx, Property, payload.property_id, "Property")
    elif ctx.scope is not None:
        raise HTTPException(status_code=400, detail="Choose one of your properties.")
    a = Announcement(org_id=ctx.org_id, created_by_user_id=ctx.user.id, **payload.model_dump())
    tenants = _tenants_at(ctx.session, ctx.org_id, payload.property_id, ctx.scope)
    a.tenant_count = len(tenants)
    ctx.session.add(a)
    ctx.session.flush()
    where = ctx.session.get(Property, payload.property_id).name if payload.property_id else ctx.org.name
    audit.log(ctx, "announcement", a.id, "create", f"Announcement to {len(tenants)} tenants: {a.title}")
    ctx.session.commit()
    html = layout(a.title, f"<p style='white-space:pre-wrap'>{esc(a.body)}</p><p style='color:#64748b;font-size:13px'>Announcement for {esc(where)}</p>", "Open the tenant portal", _portal_url())
    for t in tenants:
        if a.send_email and t.email:
            a.email_count += notify(ctx.session, ctx.org_id, "announcement", t.email, f"{where}: {a.title}", html, dedupe_key=f"ann:{a.id}:{t.email}")
        if a.send_sms and t.sms_opt_in and t.phone:
            a.sms_count += sms.text(ctx.session, ctx.org_id, "announcement", t.phone, f"{where}: {a.title} — {a.body}", dedupe_key=f"ann_sms:{a.id}:{t.id}")
    ctx.session.add(a)
    ctx.session.commit()
    return _announcement_out(ctx.session, a)


@router.get("/portal/announcements")
def portal_announcements(ctx: Ctx = Depends(tenant_only)):
    tenant_ids = [x.id for x in _my_tenants(ctx)]
    props: set[uuid.UUID] = set()
    for tid in tenant_ids:
        lease = _active_lease(ctx.session, tid)
        pid = _property_of_lease(ctx.session, lease)
        if pid:
            props.add(pid)
    since = utcnow() - timedelta(days=90)
    rows = ctx.session.exec(select(Announcement).where(Announcement.org_id == ctx.org_id, Announcement.created_at >= since).order_by(Announcement.created_at.desc())).all()
    return [{"id": str(a.id), "title": a.title, "body": a.body, "created_at": a.created_at} for a in rows if a.property_id is None or a.property_id in props][:20]


# ── Formal notices ───────────────────────────────────────────────────────────

NOTICE_TEMPLATES: dict[str, dict[str, str]] = {
    "rent_increase": {
        "title": "Notice of rent increase",
        "body": """# Notice of Rent Increase

Date: {{notice_date}}

To: **{{tenant_names}}**

Premises: {{property_address}} ({{unit_name}})

This notice is to inform you that, effective **{{effective_date}}**, your monthly rent will change from **{{monthly_rent}}** to **{{new_rent}}**.

All other terms of your lease remain the same. Please contact us with any questions.

{{landlord_name}}
""",
    },
    "entry": {
        "title": "Notice of entry",
        "body": """# Notice of Intent to Enter

Date: {{notice_date}}

To: **{{tenant_names}}**

Premises: {{property_address}} ({{unit_name}})

We will enter the premises on **{{entry_date}}** between **{{entry_window}}** for the following purpose: {{entry_reason}}.

You do not need to be home. Please secure pets and contact us if this time doesn't work.

{{landlord_name}}
""",
    },
    "violation": {
        "title": "Notice of lease violation",
        "body": """# Notice of Lease Violation

Date: {{notice_date}}

To: **{{tenant_names}}**

Premises: {{property_address}} ({{unit_name}})

You are in violation of your lease as follows:

{{violation}}

Please correct this within **{{cure_days}} days** of this notice. If it is not corrected, we may take further action as permitted by your lease and the law.

{{landlord_name}}
""",
    },
    "pay_or_quit": {
        "title": "Notice to pay rent or quit",
        "body": """# Notice to Pay Rent or Quit

Date: {{notice_date}}

To: **{{tenant_names}}**

Premises: {{property_address}} ({{unit_name}})

Rent and charges of **{{amount_due}}** are past due. You must pay this amount in full within **{{pay_days}} days** of this notice, or vacate the premises.

If you do not pay or move out within that time, we may begin legal proceedings to recover possession and the amount owed.

Payment can be made through the Proppros tenant portal or as agreed in your lease.

{{landlord_name}}
""",
    },
    "general": {"title": "Notice to tenants", "body": "# Notice\n\nDate: {{notice_date}}\n\nTo: **{{tenant_names}}**\n\nPremises: {{property_address}} ({{unit_name}})\n\n\n\n{{landlord_name}}\n"},
}
NOTICE_FIELDS = {
    "notice_date": "Today's date",
    "effective_date": "Effective date",
    "new_rent": "New monthly rent",
    "entry_date": "Date of entry",
    "entry_window": "Time window, e.g. 9am–12pm",
    "entry_reason": "Reason for entry",
    "violation": "Description of the violation",
    "cure_days": "Days to fix the violation",
    "amount_due": "Amount past due",
    "pay_days": "Days to pay",
}
DISCLAIMER = "Notice requirements (timing, wording and delivery method) vary by state and city. Check your local rules before relying on this notice."


def notice_values(session: Session, org: Organization, lease: Lease, p: NoticePreviewIn, today: date) -> dict[str, str]:
    values = L.merge_values(session, org, lease, today)
    balance = billing.lease_balance(session, lease.id)
    blank = "_____"
    values.update(
        {
            "notice_date": L._long(today),
            "effective_date": L._long(p.effective_date) if p.effective_date else blank,
            "new_rent": money(p.new_rent_cents, org.currency) if p.new_rent_cents else blank,
            "entry_date": L._long(p.entry_date) if p.entry_date else blank,
            "entry_window": p.entry_window or blank,
            "entry_reason": p.entry_reason or blank,
            "violation": p.violation or blank,
            "cure_days": str(p.cure_days) if p.cure_days is not None else blank,
            "amount_due": money(p.amount_due_cents if p.amount_due_cents is not None else max(balance, 0), org.currency),
            "pay_days": str(p.pay_days or 3),
        }
    )
    return values


@router.get("/notice-templates")
def notice_templates(ctx: Ctx = Depends(messengers)):
    return {"templates": NOTICE_TEMPLATES, "fields": {**L.MERGE_FIELDS, **NOTICE_FIELDS}, "disclaimer": DISCLAIMER}


def _render_notice(ctx: Ctx, lease: Lease, p: NoticePreviewIn) -> str:
    body = p.body or NOTICE_TEMPLATES[p.kind]["body"]
    unknown = sorted({f for f in L._FIELD.findall(body)} - set(L.MERGE_FIELDS) - set(NOTICE_FIELDS))
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown merge field(s): {', '.join('{{' + u + '}}' for u in unknown)}.")
    return L.render(body, notice_values(ctx.session, ctx.org, lease, p, today_in(ctx.org.timezone)))


@router.post("/leases/{lease_id}/notices/preview")
def preview_notice(lease_id: uuid.UUID, payload: NoticePreviewIn, ctx: Ctx = Depends(messengers)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    return {"body": _render_notice(ctx, lease, payload), "balance_cents": billing.lease_balance(ctx.session, lease.id)}


@router.get("/leases/{lease_id}/notices")
def list_notices(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    return ctx.session.exec(select(Notice).where(Notice.lease_id == lease.id).order_by(Notice.created_at.desc())).all()


def notice_pdf(org: Organization, title: str, body: str) -> bytes:
    pdf = L.DocPDF(org.name, title)
    pdf.add_page()
    pdf.markdown_body(body)
    return bytes(pdf.output())


@router.post("/leases/{lease_id}/notices", status_code=201)
def send_notice(lease_id: uuid.UUID, payload: NoticeIn, ctx: Ctx = Depends(messengers)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    body = _render_notice(ctx, lease, payload)
    pdf = notice_pdf(ctx.org, payload.title, body)
    today = today_in(ctx.org.timezone)
    doc = L.store_generated(ctx.session, ctx.org_id, ctx.user.id, lease.id, "notice", f"{L.file_slug(payload.title)}-{today.isoformat()}.pdf", pdf)
    effective = payload.effective_date or payload.entry_date
    n = Notice(org_id=ctx.org_id, lease_id=lease.id, kind=payload.kind, title=payload.title, body=body, effective_date=effective, document_id=doc.id, created_by_user_id=ctx.user.id)
    ctx.session.add(n)
    ctx.session.flush()
    audit.log(ctx, "lease", lease.id, "notice", f"Sent {payload.title}")
    ctx.session.commit()
    tenants = L.lease_tenant_rows(ctx.session, lease.id)
    emailed = []
    for t in tenants:
        if payload.send_email and t.email:
            html = layout(payload.title, f"<p>Hi {esc(t.first_name)},</p><p>{esc(ctx.org.name)} has sent you a notice: <strong>{esc(payload.title)}</strong>. "
                          "It's attached to this email and saved in your tenant portal.</p>", "View in the portal" if t.user_id else None, _portal_url() if t.user_id else None)
            if notify(ctx.session, ctx.org_id, "notice", t.email, f"{payload.title} — {ctx.org.name}", html, attachments=[Attachment(doc.name, pdf)]):
                emailed.append(t.email)
        if payload.send_sms and t.sms_opt_in and t.phone:
            sms.text(ctx.session, ctx.org_id, "notice", t.phone, f"{ctx.org.name}: you have a new notice ({payload.title}). Check your email or tenant portal.")
    n = ctx.session.get(Notice, n.id)
    n.emailed_to = emailed
    ctx.session.add(n)
    ctx.session.commit()
    return n


@router.get("/portal/notices")
def portal_notices(ctx: Ctx = Depends(tenant_only)):
    from app.routers.portal import _lease_ids

    ids = list(_lease_ids(ctx))
    if not ids:
        return []
    rows = ctx.session.exec(select(Notice).where(Notice.lease_id.in_(ids)).order_by(Notice.created_at.desc())).all()
    now = utcnow()
    for n in rows:
        if not n.viewed_at:
            n.viewed_at = now
            ctx.session.add(n)
    ctx.session.commit()
    return [{"id": str(n.id), "title": n.title, "kind": n.kind, "effective_date": n.effective_date, "document_id": str(n.document_id) if n.document_id else None, "created_at": n.created_at} for n in rows]


# ── Move-out notices ─────────────────────────────────────────────────────────


@router.get("/portal/leases/{lease_id}/move-out")
def portal_move_out(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    from app.routers.portal import _my_lease

    lease = _my_lease(ctx, lease_id)
    return ctx.session.exec(select(MoveOutNotice).where(MoveOutNotice.lease_id == lease.id, MoveOutNotice.status != "withdrawn").order_by(MoveOutNotice.created_at.desc())).first()


@router.post("/portal/leases/{lease_id}/move-out", status_code=201)
def portal_give_notice(lease_id: uuid.UUID, payload: MoveOutIn, ctx: Ctx = Depends(tenant_only)):
    from app.routers.portal import _my_lease

    lease = _my_lease(ctx, lease_id)
    if lease.status != "active":
        raise HTTPException(status_code=400, detail="This lease has already ended.")
    if payload.move_out_date < today_in(ctx.org.timezone):
        raise HTTPException(status_code=422, detail="Choose a move-out date in the future.")
    if ctx.session.exec(select(MoveOutNotice.id).where(MoveOutNotice.lease_id == lease.id, MoveOutNotice.status != "withdrawn")).first():
        raise HTTPException(status_code=409, detail="You've already given notice for this lease.")
    tenant = next(t for t in _my_tenants(ctx) if ctx.session.exec(select(LeaseTenant).where(LeaseTenant.lease_id == lease.id, LeaseTenant.tenant_id == t.id)).first())
    n = MoveOutNotice(org_id=ctx.org_id, lease_id=lease.id, tenant_id=tenant.id, **payload.model_dump())
    ctx.session.add(n)
    audit.record(ctx.session, ctx.org_id, ctx.user.id, "lease", lease.id, "move_out_notice", f"{tenant.first_name} {tenant.last_name} gave notice to move out on {payload.move_out_date}")
    ctx.session.commit()
    html = layout(
        "Move-out notice received",
        f"<p><strong>{esc(tenant.first_name)} {esc(tenant.last_name)}</strong> gave notice to move out on <strong>{esc(L._long(payload.move_out_date))}</strong>.</p>"
        + (f"<p>Reason: {esc(payload.reason)}</p>" if payload.reason else "")
        + (f"<p>Forwarding address: {esc(payload.forwarding_address)}</p>" if payload.forwarding_address else ""),
        "Open lease",
        f"{settings.frontend_url}/leases/{lease.id}",
    )
    for email in staff_recipients(ctx.session, ctx.org_id, "lease_expiry"):
        notify(ctx.session, ctx.org_id, "move_out_notice", email, f"Move-out notice: {tenant.first_name} {tenant.last_name}", html)
    return n


@router.post("/portal/move-out/{notice_id}/withdraw")
def portal_withdraw_notice(notice_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    n = ctx.session.get(MoveOutNotice, notice_id)
    if not n or n.org_id != ctx.org_id or n.tenant_id not in {t.id for t in _my_tenants(ctx)}:
        raise HTTPException(status_code=404, detail="Notice not found")
    if n.status != "submitted":
        raise HTTPException(status_code=400, detail="Your landlord has already acknowledged this notice. Please message them to change it.")
    n.status = "withdrawn"
    ctx.session.add(n)
    ctx.session.commit()
    return n


@router.get("/leases/{lease_id}/move-out-notices")
def lease_move_out_notices(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    rows = ctx.session.exec(select(MoveOutNotice, Tenant).join(Tenant, Tenant.id == MoveOutNotice.tenant_id).where(MoveOutNotice.lease_id == lease.id).order_by(MoveOutNotice.created_at.desc())).all()
    return [{**n.model_dump(), "tenant_name": f"{t.first_name} {t.last_name}"} for n, t in rows]


@router.post("/move-out-notices/{notice_id}/acknowledge")
def acknowledge_move_out(notice_id: uuid.UUID, payload: MoveOutAckIn, ctx: Ctx = Depends(writer)):
    from app.routers.leases import _check_overlap

    n = ctx.session.get(MoveOutNotice, notice_id)
    if not n or n.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Notice not found")
    lease = get_owned(ctx, Lease, n.lease_id, "Lease")
    if n.status != "submitted":
        raise HTTPException(status_code=400, detail="This notice was already handled.")
    if payload.set_lease_end and lease.status == "active" and (not lease.end_date or lease.end_date != n.move_out_date):
        if n.move_out_date < lease.start_date:
            raise HTTPException(status_code=422, detail="The move-out date is before the lease start.")
        _check_overlap(ctx, lease.unit_id, lease.start_date, n.move_out_date, exclude=lease.id)
        lease.end_date = n.move_out_date
        lease.updated_at = utcnow()
        ctx.session.add(lease)
    n.status = "acknowledged"
    n.acknowledged_at = utcnow()
    n.acknowledged_by_user_id = ctx.user.id
    ctx.session.add(n)
    audit.log(ctx, "lease", lease.id, "move_out_ack", f"Acknowledged move-out on {n.move_out_date}")
    ctx.session.commit()
    tenant = ctx.session.get(Tenant, n.tenant_id)
    html = layout(
        "Move-out notice received",
        f"<p>Hi {esc(tenant.first_name)},</p><p>We've received your notice to move out on <strong>{esc(L._long(n.move_out_date))}</strong>. "
        "We'll be in touch about the move-out inspection, returning keys and your security deposit.</p>",
    )
    _tell_tenant(ctx.session, ctx.org, tenant, "We received your move-out notice", html, None)
    return n


# ── Renter's insurance ───────────────────────────────────────────────────────


@router.get("/portal/insurance")
def portal_insurance(ctx: Ctx = Depends(tenant_only)):
    ids = [t.id for t in _my_tenants(ctx)]
    if not ids:
        return []
    docs = ctx.session.exec(select(Document).where(Document.owner_type == "tenant", Document.owner_id.in_(ids), Document.kind == "insurance").order_by(Document.created_at.desc())).all()
    return [{"id": str(d.id), "name": d.name, "expires_on": d.expires_on, "created_at": d.created_at} for d in docs]


@router.post("/portal/insurance", status_code=201)
async def portal_upload_insurance(file: UploadFile = File(...), expires_on: date = Form(...), provider: str | None = Form(None), ctx: Ctx = Depends(tenant_only)):
    tenants = _my_tenants(ctx)
    if not tenants:
        raise HTTPException(status_code=400, detail="Your account isn't linked to a tenant record yet.")
    if expires_on < today_in(ctx.org.timezone):
        raise HTTPException(status_code=422, detail="This policy has already expired.")
    tenant = tenants[0]
    doc = await store_upload(ctx.session, ctx.org_id, ctx.user.id, file, "tenant", tenant.id, "insurance", expires_on=expires_on, visible_to_tenant=True)
    if provider:
        doc.name = f"Renter's insurance ({provider[:60]}) - {doc.name}"[:200]
    ctx.session.flush()
    audit.record(ctx.session, ctx.org_id, ctx.user.id, "tenant", tenant.id, "insurance_upload", f"{tenant.first_name} {tenant.last_name} uploaded renter's insurance (expires {expires_on})")
    ctx.session.commit()
    html = layout("Renter's insurance uploaded", f"<p>{esc(tenant.first_name)} {esc(tenant.last_name)} uploaded proof of renter's insurance, valid until {esc(L._long(expires_on))}.</p>", "Open tenant", f"{settings.frontend_url}/tenants/{tenant.id}")
    for email in staff_recipients(ctx.session, ctx.org_id, "document_expiry"):
        notify(ctx.session, ctx.org_id, "insurance_upload", email, f"Renter's insurance from {tenant.first_name} {tenant.last_name}", html)
    return {"id": str(doc.id), "name": doc.name, "expires_on": doc.expires_on}


@router.get("/leases/{lease_id}/insurance")
def lease_insurance(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    today = today_in(ctx.org.timezone)
    out = []
    for t in L.lease_tenant_rows(ctx.session, lease.id):
        doc = ctx.session.exec(select(Document).where(Document.owner_type == "tenant", Document.owner_id == t.id, Document.kind == "insurance").order_by(Document.expires_on.desc())).first()
        status = "missing" if not doc else "expired" if doc.expires_on and doc.expires_on < today else "expiring" if doc.expires_on and doc.expires_on <= today + timedelta(days=30) else "ok"
        out.append({"tenant_id": str(t.id), "tenant_name": f"{t.first_name} {t.last_name}", "status": status, "expires_on": doc.expires_on if doc else None, "document_id": str(doc.id) if doc else None})
    return out


def daily_communication(session: Session, org: Organization, today: date) -> dict[str, int]:
    """Remind tenants 14 days before their renter's insurance expires."""
    sent = 0
    horizon = today + timedelta(days=14)
    docs = session.exec(
        select(Document).where(Document.org_id == org.id, Document.owner_type == "tenant", Document.kind == "insurance", Document.expires_on.is_not(None), Document.expires_on >= today, Document.expires_on <= horizon)
    ).all()
    for d in docs:
        tenant = session.get(Tenant, d.owner_id)
        newer = session.exec(select(func.count()).select_from(Document).where(Document.owner_type == "tenant", Document.owner_id == d.owner_id, Document.kind == "insurance", Document.expires_on > d.expires_on)).one()
        if not tenant or not tenant.email or newer:
            continue
        html = layout(
            "Your renter's insurance is expiring",
            f"<p>Hi {esc(tenant.first_name)},</p><p>Your renter's insurance on file expires on {esc(L._long(d.expires_on))}. Please upload your renewed policy in the tenant portal.</p>",
            "Upload in the portal",
            _portal_url(),
        )
        sent += notify(session, org.id, "insurance_reminder", tenant.email, "Please upload your renewed renter's insurance", html, dedupe_key=f"ins_tenant:{d.id}:{tenant.email}")
    return {"insurance_reminders": sent}


# ── SMS preferences & inbound texts ──────────────────────────────────────────


@router.get("/portal/sms")
def portal_sms(ctx: Ctx = Depends(tenant_only)):
    tenants = _my_tenants(ctx)
    t = tenants[0] if tenants else None
    return {"available": True, "opt_in": bool(t and t.sms_opt_in), "phone": t.phone if t else None, "live": settings.sms_enabled}


@router.put("/portal/sms")
def portal_set_sms(payload: SmsPrefsIn, ctx: Ctx = Depends(tenant_only)):
    tenants = _my_tenants(ctx)
    if not tenants:
        raise HTTPException(status_code=400, detail="Your account isn't linked to a tenant record yet.")
    phone = payload.phone or tenants[0].phone
    if payload.opt_in and not sms.normalize_phone(phone):
        raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
    for t in tenants:
        t.sms_opt_in = payload.opt_in
        t.sms_opt_in_at = utcnow() if payload.opt_in else None
        if payload.opt_in and payload.phone:
            t.phone = payload.phone
        ctx.session.add(t)
    audit.record(ctx.session, ctx.org_id, ctx.user.id, "tenant", tenants[0].id, "sms_opt_in" if payload.opt_in else "sms_opt_out", "Text messages turned " + ("on" if payload.opt_in else "off"))
    ctx.session.commit()
    if payload.opt_in:
        sms.text(ctx.session, ctx.org_id, "opt_in", phone, f"{ctx.org.name}: you'll now get texts about your rental. Reply STOP to opt out. Msg & data rates may apply.")
    return portal_sms(ctx)


STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_WORDS = {"start", "unstop", "yes"}


@router.post("/twilio/inbound", include_in_schema=False)
async def twilio_inbound(request: Request, session: Session = Depends(get_session)):
    """Incoming texts: STOP/START update consent; anything else becomes a message in the tenant's latest conversation."""
    form = {k: str(v) for k, v in (await request.form()).items()}
    url = f"{settings.frontend_url}/api/twilio/inbound"
    if not settings.sms_enabled or not sms.valid_twilio_signature(url, form, request.headers.get("x-twilio-signature", "")):
        raise HTTPException(status_code=403, detail="Invalid signature")
    sender = sms.normalize_phone(form.get("From"))
    body = (form.get("Body") or "").strip()
    twiml = Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', media_type="application/xml")
    if not sender or not body:
        return twiml
    tenants = [t for t in session.exec(select(Tenant).where(Tenant.phone.is_not(None))).all() if sms.normalize_phone(t.phone) == sender]
    word = body.lower().strip(" .!")
    if word in STOP_WORDS or word in START_WORDS:
        for t in tenants:
            t.sms_opt_in = word in START_WORDS
            t.sms_opt_in_at = utcnow() if t.sms_opt_in else None
            session.add(t)
        session.commit()
        return twiml  # Twilio sends the carrier-required confirmation itself
    tenant = next((t for t in tenants if t.sms_opt_in), None)
    if not tenant:
        return twiml
    org = session.get(Organization, tenant.org_id)
    t = session.exec(select(MessageThread).where(MessageThread.tenant_id == tenant.id).order_by(MessageThread.last_message_at.desc())).first()
    if not t:
        lease = _active_lease(session, tenant.id)
        t = MessageThread(org_id=org.id, tenant_id=tenant.id, lease_id=lease.id if lease else None, property_id=_property_of_lease(session, lease), subject="Text message")
        session.add(t)
        session.flush()
    _post(session, org, t, tenant.user_id, "tenant", body[:5000], via="sms")
    session.commit()
    _notify_staff_of_message(session, org, t, tenant, body)
    return twiml
