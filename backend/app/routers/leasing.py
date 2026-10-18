"""Leasing workflows: lease templates, e-signature, renewals, move-in/out inspections and deposit statements."""
import base64
import binascii
import hashlib
import io
import secrets
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from PIL import Image
from sqlmodel import Session, select

from app.core import audit
from app.core.config import settings
from app.core.database import get_session
from app.core.dates import today_in
from app.core.deps import Ctx, get_owned, staff, tenant_only, writer
from app.core.email import Attachment, esc, layout
from app.core.limiter import _client_ip, rate_limit
from app.models import (
    DepositDisposition,
    Document,
    Inspection,
    Lease,
    LeaseTemplate,
    LeaseTenant,
    LedgerEntry,
    Organization,
    RecurringCharge,
    RenewalOffer,
    Signer,
    SignatureRequest,
    Tenant,
    Unit,
    utcnow,
)
from app.routers.documents import store_upload
from app.routers.leases import _check_overlap
from app.schemas import (
    DepositDispositionIn,
    InspectionCompleteIn,
    InspectionIn,
    InspectionUpdate,
    LeaseTemplateIn,
    LeaseTemplateUpdate,
    RenderIn,
    RenewalOfferIn,
    RenewalResponseIn,
    SignatureRequestIn,
    SignIn,
)
from app.services import billing
from app.services import leasing as L
from app.services.notify import notify, staff_recipients
from app.services.receipts import money

router = APIRouter(tags=["leasing"])

SIGN_LINK_DAYS = 30


# ── Lease templates ──────────────────────────────────────────────────────────


@router.get("/lease-templates/fields")
def template_fields(ctx: Ctx = Depends(staff)):
    return [{"key": k, "description": v} for k, v in L.MERGE_FIELDS.items()]


@router.get("/lease-templates")
def list_templates(ctx: Ctx = Depends(staff)):
    return ctx.session.exec(select(LeaseTemplate).where(LeaseTemplate.org_id == ctx.org_id).order_by(LeaseTemplate.name)).all()


def _check_fields(body: str) -> None:
    bad = L.unknown_fields(body)
    if bad:
        raise HTTPException(status_code=422, detail=f"Unknown merge field(s): {', '.join('{{' + b + '}}' for b in bad)}.")


@router.post("/lease-templates", status_code=201)
def create_template(payload: LeaseTemplateIn, ctx: Ctx = Depends(writer)):
    body = payload.body or L.STARTER_TEMPLATE
    _check_fields(body)
    tpl = LeaseTemplate(org_id=ctx.org_id, name=payload.name, body=body)
    ctx.session.add(tpl)
    ctx.session.flush()
    audit.log(ctx, "lease_template", tpl.id, "create", f"Created lease template {tpl.name}")
    ctx.session.commit()
    return tpl


@router.get("/lease-templates/{template_id}")
def get_template(template_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    return get_owned(ctx, LeaseTemplate, template_id, "Template")


@router.patch("/lease-templates/{template_id}")
def update_template(template_id: uuid.UUID, payload: LeaseTemplateUpdate, ctx: Ctx = Depends(writer)):
    tpl = get_owned(ctx, LeaseTemplate, template_id, "Template")
    if payload.body is not None:
        _check_fields(payload.body)
        tpl.body = payload.body
    if payload.name is not None:
        tpl.name = payload.name
    tpl.updated_at = utcnow()
    ctx.session.add(tpl)
    audit.log(ctx, "lease_template", tpl.id, "update", f"Updated lease template {tpl.name}")
    ctx.session.commit()
    return tpl


@router.delete("/lease-templates/{template_id}")
def delete_template(template_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    tpl = get_owned(ctx, LeaseTemplate, template_id, "Template")
    for req in ctx.session.exec(select(SignatureRequest).where(SignatureRequest.template_id == tpl.id)).all():
        req.template_id = None  # signed documents keep their own frozen text
        ctx.session.add(req)
    ctx.session.delete(tpl)
    audit.log(ctx, "lease_template", template_id, "delete", f"Deleted lease template {tpl.name}")
    ctx.session.commit()
    return {"ok": True}


def _template_body(ctx: Ctx, template_id: uuid.UUID | None, body: str | None) -> str:
    if body:
        return body
    if template_id:
        return get_owned(ctx, LeaseTemplate, template_id, "Template").body
    raise HTTPException(status_code=422, detail="Choose a template or enter the document text.")


@router.post("/leases/{lease_id}/render")
def render_for_lease(lease_id: uuid.UUID, payload: RenderIn, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    body = _template_body(ctx, payload.template_id, payload.body)
    values = L.merge_values(ctx.session, ctx.org, lease, today_in(ctx.org.timezone))
    return {"body": L.render(body, values), "unknown_fields": L.unknown_fields(body)}


# ── E-signature ──────────────────────────────────────────────────────────────


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _issue_link(signer: Signer) -> str:
    token = secrets.token_urlsafe(32)
    signer.token_hash = _hash_token(token)
    signer.token_expires_at = utcnow() + timedelta(days=SIGN_LINK_DAYS)
    return f"{settings.frontend_url}/sign/{token}"


def _signers(session: Session, request_id: uuid.UUID) -> list[Signer]:
    return list(session.exec(select(Signer).where(Signer.request_id == request_id).order_by(Signer.order)).all())


def _signer_out(s: Signer) -> dict:
    return {
        "id": str(s.id),
        "role": s.role,
        "name": s.name,
        "email": s.email,
        "tenant_id": str(s.tenant_id) if s.tenant_id else None,
        "user_id": str(s.user_id) if s.user_id else None,
        "viewed_at": s.viewed_at,
        "signed_at": s.signed_at,
    }


def _request_out(session: Session, req: SignatureRequest, include_body: bool = False) -> dict:
    out = req.model_dump(exclude={"body"} if not include_body else set())
    out["signers"] = [_signer_out(s) for s in _signers(session, req.id)]
    return out


def _email_sign_link(session: Session, org: Organization, req: SignatureRequest, signer: Signer, url: str, reminder: bool = False) -> bool:
    if not signer.email:
        return False
    subject = f"{'Reminder: please' if reminder else 'Please'} sign: {req.title}"
    html = layout(
        f"{org.name} sent you a document to sign",
        f"<p>Hi {esc(signer.name.split(' ')[0])},</p><p><strong>{esc(req.title)}</strong> is ready for your signature. "
        f"Review it and sign online — it takes about a minute.</p><p style='color:#64748b;font-size:13px'>This link is personal "
        f"to you and expires in {SIGN_LINK_DAYS} days.</p>",
        "Review and sign",
        url,
    )
    return notify(session, org.id, "signature_request", signer.email, subject, html)


@router.get("/leases/{lease_id}/signature-requests")
def list_signature_requests(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    reqs = ctx.session.exec(select(SignatureRequest).where(SignatureRequest.lease_id == lease.id).order_by(SignatureRequest.created_at.desc())).all()
    return [_request_out(ctx.session, r) for r in reqs]


@router.post("/leases/{lease_id}/signature-requests", status_code=201)
def create_signature_request(lease_id: uuid.UUID, payload: SignatureRequestIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    raw = _template_body(ctx, payload.template_id, payload.body)
    _check_fields(raw)
    body = L.render(raw, L.merge_values(ctx.session, ctx.org, lease, today_in(ctx.org.timezone)))
    tenants = L.lease_tenant_rows(ctx.session, lease.id)
    if not tenants:
        raise HTTPException(status_code=400, detail="Add a tenant to the lease first.")
    req = SignatureRequest(
        org_id=ctx.org_id,
        lease_id=lease.id,
        template_id=payload.template_id if not payload.body else None,
        title=payload.title,
        body=body,
        content_hash=L.content_hash(payload.title, body),
        created_by_user_id=ctx.user.id,
    )
    ctx.session.add(req)
    ctx.session.flush()
    signers = [
        Signer(request_id=req.id, role="tenant", tenant_id=t.id, name=f"{t.first_name} {t.last_name}", email=t.email, order=i)
        for i, t in enumerate(tenants)
    ]
    if payload.landlord_signs:
        signers.append(Signer(request_id=req.id, role="landlord", user_id=ctx.user.id, name=ctx.user.name, email=ctx.user.email, order=len(signers)))
    links = []
    for s in signers:
        ctx.session.add(s)
        if s.role == "tenant":
            links.append({"signer_id": str(s.id), "name": s.name, "email": s.email, "url": _issue_link(s)})
    audit.log(ctx, "signature_request", req.id, "create", f"Sent “{req.title}” for signature")
    ctx.session.commit()
    for link in links:
        s = next(x for x in signers if str(x.id) == link["signer_id"])
        link["email_sent"] = _email_sign_link(ctx.session, ctx.org, req, s, link["url"])
    return {**_request_out(ctx.session, req), "links": links}


def _owned_request(ctx: Ctx, request_id: uuid.UUID) -> SignatureRequest:
    req = get_owned(ctx, SignatureRequest, request_id, "Signature request")
    return req


@router.get("/signature-requests/{request_id}")
def get_signature_request(request_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    return _request_out(ctx.session, _owned_request(ctx, request_id), include_body=True)


@router.post("/signature-requests/{request_id}/remind")
def remind_signers(request_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Issue fresh signing links (old ones stop working) and email them to tenants who haven't signed."""
    req = _owned_request(ctx, request_id)
    if req.status != "sent":
        raise HTTPException(status_code=400, detail="This document is no longer waiting for signatures.")
    pending = [s for s in _signers(ctx.session, req.id) if s.role == "tenant" and not s.signed_at]
    links = [{"signer_id": str(s.id), "name": s.name, "email": s.email, "url": _issue_link(s)} for s in pending]
    for s in pending:
        ctx.session.add(s)
    ctx.session.commit()
    for link, s in zip(links, pending):
        link["email_sent"] = _email_sign_link(ctx.session, ctx.org, req, s, link["url"], reminder=True)
    return {"links": links}


@router.post("/signature-requests/{request_id}/void")
def void_request(request_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    req = _owned_request(ctx, request_id)
    if req.status != "sent":
        raise HTTPException(status_code=400, detail="Only documents waiting for signatures can be voided.")
    req.status = "voided"
    req.voided_at = utcnow()
    for s in _signers(ctx.session, req.id):
        s.token_hash = None
        ctx.session.add(s)
    ctx.session.add(req)
    audit.log(ctx, "signature_request", req.id, "void", f"Voided “{req.title}”")
    ctx.session.commit()
    return _request_out(ctx.session, req)


def _validate_signature_image(data_url: str | None) -> str | None:
    if not data_url:
        return None
    if not data_url.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=422, detail="The drawn signature must be a PNG image.")
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        with Image.open(io.BytesIO(raw)) as im:
            if im.format != "PNG" or im.width > 2000 or im.height > 1000:
                raise ValueError
    except (binascii.Error, ValueError, OSError):
        raise HTTPException(status_code=422, detail="The drawn signature couldn't be read. Clear it and try again.")
    return data_url


def _complete_if_done(session: Session, org: Organization, req: SignatureRequest) -> None:
    signers = _signers(session, req.id)
    if any(not s.signed_at for s in signers):
        return
    req.status = "completed"
    req.completed_at = utcnow()
    pdf = L.signed_pdf(org, req, signers)
    doc = L.store_generated(session, org.id, req.created_by_user_id, req.lease_id, "lease", f"{L.file_slug(req.title)}-signed.pdf", pdf)
    req.document_id = doc.id
    for s in signers:
        s.token_hash = None
        session.add(s)
    session.add(req)
    audit.record(session, org.id, None, "signature_request", req.id, "complete", f"All parties signed “{req.title}”")
    session.commit()
    html = layout(
        f"Signed: {req.title}",
        f"<p>Everyone has signed <strong>{esc(req.title)}</strong>. A copy of the signed document is attached.</p>",
        "Open Proppros",
        settings.frontend_url,
    )
    recipients = {s.email for s in signers if s.email} | set(staff_recipients(session, org.id, "lease_expiry"))
    for email in recipients:
        notify(session, org.id, "signature_completed", email, f"Signed: {req.title}", html, attachments=[Attachment(doc.name, pdf)])


def _apply_signature(session: Session, request: Request, signer: Signer, payload: SignIn) -> SignatureRequest:
    req = session.get(SignatureRequest, signer.request_id)
    if req.status != "sent":
        raise HTTPException(status_code=400, detail="This document is no longer open for signing.")
    if signer.signed_at:
        raise HTTPException(status_code=400, detail="You've already signed this document.")
    signer.signature_name = payload.signature_name
    signer.signature_image = _validate_signature_image(payload.signature_image)
    signer.signed_at = utcnow()
    signer.viewed_at = signer.viewed_at or signer.signed_at
    signer.ip_address = _client_ip(request)[:64]
    signer.user_agent = (request.headers.get("user-agent") or "")[:300]
    signer.token_hash = None
    session.add(signer)
    audit.record(session, req.org_id, signer.user_id, "signature_request", req.id, "sign", f"{signer.name} signed “{req.title}”")
    session.commit()
    _complete_if_done(session, session.get(Organization, req.org_id), req)
    return req


def _signing_view(session: Session, signer: Signer) -> dict:
    req = session.get(SignatureRequest, signer.request_id)
    org = session.get(Organization, req.org_id)
    return {
        "signer": {"id": str(signer.id), "name": signer.name, "signed_at": signer.signed_at, "role": signer.role},
        "request": {"id": str(req.id), "title": req.title, "body": req.body, "status": req.status, "content_hash": req.content_hash, "document_id": str(req.document_id) if req.document_id else None},
        "organization": org.name,
        "signers": [{"name": s.name, "role": s.role, "signed": bool(s.signed_at)} for s in _signers(session, req.id)],
    }


@router.post("/signature-requests/{request_id}/sign")
def sign_as_landlord(request_id: uuid.UUID, payload: SignIn, request: Request, ctx: Ctx = Depends(writer)):
    req = _owned_request(ctx, request_id)
    signer = next((s for s in _signers(ctx.session, req.id) if s.role == "landlord" and s.user_id == ctx.user.id), None)
    if not signer:
        raise HTTPException(status_code=403, detail="You're not a signer on this document.")
    _apply_signature(ctx.session, request, signer, payload)
    return _request_out(ctx.session, ctx.session.get(SignatureRequest, req.id))


def _signer_by_token(session: Session, token: str) -> Signer:
    signer = session.exec(select(Signer).where(Signer.token_hash == _hash_token(token))).first()
    if not signer or (signer.token_expires_at and signer.token_expires_at < utcnow()):
        raise HTTPException(status_code=404, detail="This signing link is invalid or has expired. Ask your landlord for a new one.")
    return signer


@router.get("/sign/{token}", dependencies=[Depends(rate_limit("sign_view", 30, 60))])
def public_sign_view(token: str, session: Session = Depends(get_session)):
    signer = _signer_by_token(session, token)
    if not signer.viewed_at:
        signer.viewed_at = utcnow()
        session.add(signer)
        session.commit()
    return _signing_view(session, signer)


@router.post("/sign/{token}", dependencies=[Depends(rate_limit("sign_submit", 10, 60))])
def public_sign(token: str, payload: SignIn, request: Request, session: Session = Depends(get_session)):
    signer = _signer_by_token(session, token)
    _apply_signature(session, request, signer, payload)
    return _signing_view(session, session.get(Signer, signer.id))


def _my_signer(ctx: Ctx, signer_id: uuid.UUID) -> Signer:
    signer = ctx.session.get(Signer, signer_id)
    tenant_ids = {t.id for t in ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id, Tenant.user_id == ctx.user.id)).all()}
    if not signer or signer.tenant_id not in tenant_ids:
        raise HTTPException(status_code=404, detail="Document not found")
    return signer


@router.get("/portal/signatures")
def portal_signatures(ctx: Ctx = Depends(tenant_only)):
    tenant_ids = [t.id for t in ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id, Tenant.user_id == ctx.user.id)).all()]
    if not tenant_ids:
        return []
    rows = ctx.session.exec(
        select(Signer, SignatureRequest)
        .join(SignatureRequest, SignatureRequest.id == Signer.request_id)
        .where(Signer.tenant_id.in_(tenant_ids), SignatureRequest.status == "sent", Signer.signed_at.is_(None))
    ).all()
    return [{"signer_id": str(s.id), "title": r.title, "lease_id": str(r.lease_id), "sent_at": r.created_at} for s, r in rows]


@router.get("/portal/signatures/{signer_id}")
def portal_signing_view(signer_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    signer = _my_signer(ctx, signer_id)
    if not signer.viewed_at:
        signer.viewed_at = utcnow()
        ctx.session.add(signer)
        ctx.session.commit()
    return _signing_view(ctx.session, signer)


@router.post("/portal/signatures/{signer_id}/sign")
def portal_sign(signer_id: uuid.UUID, payload: SignIn, request: Request, ctx: Ctx = Depends(tenant_only)):
    signer = _my_signer(ctx, signer_id)
    _apply_signature(ctx.session, request, signer, payload)
    return _signing_view(ctx.session, ctx.session.get(Signer, signer.id))


# ── Renewals ─────────────────────────────────────────────────────────────────


def _offer_out(offer: RenewalOffer) -> dict:
    return offer.model_dump()


@router.get("/leases/{lease_id}/renewals")
def list_renewals(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    return ctx.session.exec(select(RenewalOffer).where(RenewalOffer.lease_id == lease.id).order_by(RenewalOffer.created_at.desc())).all()


@router.post("/leases/{lease_id}/renewals", status_code=201)
def create_renewal(lease_id: uuid.UUID, payload: RenewalOfferIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    today = today_in(ctx.org.timezone)
    if lease.status != "active":
        raise HTTPException(status_code=400, detail="Only active leases can be renewed.")
    if ctx.session.exec(select(RenewalOffer.id).where(RenewalOffer.lease_id == lease.id, RenewalOffer.status == "sent")).first():
        raise HTTPException(status_code=409, detail="There's already an open renewal offer. Withdraw it first.")
    if ctx.session.exec(select(Lease.id).where(Lease.renewal_of_id == lease.id)).first():
        raise HTTPException(status_code=409, detail="This lease has already been renewed.")
    if payload.start_date <= lease.start_date:
        raise HTTPException(status_code=422, detail="The renewal must start after the current lease starts.")
    if lease.end_date and payload.start_date <= lease.end_date:
        raise HTTPException(status_code=422, detail="The renewal must start after the current lease ends.")
    if payload.end_date and payload.end_date <= payload.start_date:
        raise HTTPException(status_code=422, detail="End date must be after the start date.")
    if payload.respond_by < today or payload.respond_by >= payload.start_date:
        raise HTTPException(status_code=422, detail="The response deadline must be between today and the renewal start date.")
    offer = RenewalOffer(org_id=ctx.org_id, lease_id=lease.id, created_by_user_id=ctx.user.id, **payload.model_dump())
    ctx.session.add(offer)
    ctx.session.flush()
    change = offer.rent_cents - lease.rent_cents
    audit.log(ctx, "lease", lease.id, "renewal_offer", f"Offered renewal at {money(offer.rent_cents, ctx.org.currency)}/mo")
    ctx.session.commit()

    term = f"{L._long(offer.start_date)} to {L._long(offer.end_date)}" if offer.end_date else f"month-to-month from {L._long(offer.start_date)}"
    rent_line = f"{money(offer.rent_cents, ctx.org.currency)} per month"
    if change:
        rent_line += f" ({'+' if change > 0 else '-'}{money(abs(change), ctx.org.currency)} from your current rent)"
    html = layout(
        "Your lease renewal offer",
        f"<p>{esc(ctx.org.name)} would like to renew your lease.</p><ul><li><strong>Term:</strong> {esc(term)}</li>"
        f"<li><strong>Rent:</strong> {esc(rent_line)}</li></ul>"
        + (f"<p>{esc(offer.message)}</p>" if offer.message else "")
        + f"<p>Please respond by <strong>{esc(L._long(offer.respond_by))}</strong> in your tenant portal.</p>",
        "Respond in the portal",
        f"{settings.frontend_url}/portal/leases/{lease.id}",
    )
    sent = 0
    for t in L.lease_tenant_rows(ctx.session, lease.id):
        if t.email:
            sent += notify(ctx.session, ctx.org_id, "renewal_offer", t.email, f"Lease renewal offer from {ctx.org.name}", html)
    return {**_offer_out(offer), "emails_sent": sent}


def _respond(ctx: Ctx, offer: RenewalOffer, accept: bool, note: str | None) -> RenewalOffer:
    session, org, user_id = ctx.session, ctx.org, ctx.user.id
    today = today_in(org.timezone)
    if offer.status != "sent":
        raise HTTPException(status_code=400, detail="This offer is no longer open.")
    if offer.respond_by < today:
        raise HTTPException(status_code=400, detail="This offer has expired.")
    lease = session.get(Lease, offer.lease_id)
    offer.responded_at = utcnow()
    offer.responded_by_user_id = user_id
    offer.response_note = note
    if accept:
        if lease.status != "active":
            raise HTTPException(status_code=400, detail="The current lease has ended, so it can't be renewed.")
        if not lease.end_date:  # month-to-month: the old lease stops the day before the renewal starts
            lease.end_date = offer.start_date - timedelta(days=1)
            session.add(lease)
        _check_overlap(ctx, lease.unit_id, offer.start_date, offer.end_date, exclude=lease.id)
        new = Lease(
            org_id=lease.org_id,
            unit_id=lease.unit_id,
            start_date=offer.start_date,
            end_date=offer.end_date,
            rent_cents=offer.rent_cents,
            due_day=lease.due_day,
            deposit_cents=lease.deposit_cents,
            late_fee_type=lease.late_fee_type,
            late_fee_amount=lease.late_fee_amount,
            grace_days=lease.grace_days,
            charges_start_on=offer.start_date,
            block_online_payments=lease.block_online_payments,
            renewal_of_id=lease.id,
            notes=f"Renewal of the lease starting {lease.start_date.isoformat()}.",
        )
        session.add(new)
        session.flush()
        for lt in session.exec(select(LeaseTenant).where(LeaseTenant.lease_id == lease.id)).all():
            session.add(LeaseTenant(lease_id=new.id, tenant_id=lt.tenant_id, is_primary=lt.is_primary))
        for c in session.exec(select(RecurringCharge).where(RecurringCharge.lease_id == lease.id)).all():
            session.add(RecurringCharge(org_id=lease.org_id, lease_id=new.id, charge_type=c.charge_type, description=c.description, amount_cents=c.amount_cents))
        offer.status = "accepted"
        offer.new_lease_id = new.id
    else:
        offer.status = "declined"
    session.add(offer)
    audit.record(session, org.id, user_id, "lease", lease.id, f"renewal_{offer.status}", f"Renewal offer {offer.status}")
    session.commit()

    html = layout(
        f"Renewal {offer.status}",
        f"<p>The renewal offer for the lease starting {esc(L._long(lease.start_date))} was <strong>{offer.status}</strong>.</p>"
        + (f"<p>Note: {esc(note)}</p>" if note else "")
        + ("<p>A new lease has been created. You can send it for signature from the lease page.</p>" if accept else ""),
        "Open lease",
        f"{settings.frontend_url}/leases/{offer.new_lease_id or lease.id}",
    )
    for email in staff_recipients(session, org.id, "lease_expiry"):
        notify(session, org.id, "renewal_response", email, f"Renewal {offer.status}", html)
    return offer


@router.post("/renewals/{offer_id}/respond")
def respond_for_tenant(offer_id: uuid.UUID, payload: RenewalResponseIn, ctx: Ctx = Depends(writer)):
    """Record the tenant's answer (e.g. given by phone or in person)."""
    offer = get_owned(ctx, RenewalOffer, offer_id, "Renewal offer")
    return _respond(ctx, offer, payload.accept, payload.note)


@router.post("/renewals/{offer_id}/withdraw")
def withdraw_renewal(offer_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    offer = get_owned(ctx, RenewalOffer, offer_id, "Renewal offer")
    if offer.status != "sent":
        raise HTTPException(status_code=400, detail="This offer is no longer open.")
    offer.status = "withdrawn"
    offer.updated_at = utcnow()
    ctx.session.add(offer)
    audit.log(ctx, "lease", offer.lease_id, "renewal_withdrawn", "Withdrew renewal offer")
    ctx.session.commit()
    return offer


@router.get("/portal/leases/{lease_id}/renewal")
def portal_renewal(lease_id: uuid.UUID, ctx: Ctx = Depends(tenant_only)):
    from app.routers.portal import _my_lease

    lease = _my_lease(ctx, lease_id)
    offer = ctx.session.exec(
        select(RenewalOffer).where(RenewalOffer.lease_id == lease.id, RenewalOffer.status.in_(("sent", "accepted", "declined"))).order_by(RenewalOffer.created_at.desc())
    ).first()
    if not offer:
        return None
    return {k: v for k, v in offer.model_dump().items() if k not in ("created_by_user_id", "responded_by_user_id")}


@router.post("/portal/renewals/{offer_id}/respond")
def portal_respond(offer_id: uuid.UUID, payload: RenewalResponseIn, ctx: Ctx = Depends(tenant_only)):
    from app.routers.portal import _my_lease

    offer = ctx.session.get(RenewalOffer, offer_id)
    if not offer or offer.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Offer not found")
    _my_lease(ctx, offer.lease_id)
    offer = _respond(ctx, offer, payload.accept, payload.note)
    return {k: v for k, v in offer.model_dump().items() if k not in ("created_by_user_id", "responded_by_user_id")}


# ── Inspections ──────────────────────────────────────────────────────────────


def _photo_docs(session: Session, insp: Inspection) -> dict[str, Document]:
    ids = [uuid.UUID(pid) for it in insp.items for pid in it.get("photo_ids", []) if _is_uuid(pid)]
    if not ids:
        return {}
    return {str(d.id): d for d in session.exec(select(Document).where(Document.id.in_(ids), Document.org_id == insp.org_id)).all()}


def _is_uuid(v: str) -> bool:
    try:
        uuid.UUID(v)
        return True
    except ValueError:
        return False


def _inspection_out(session: Session, insp: Inspection) -> dict:
    out = insp.model_dump()
    photos = _photo_docs(session, insp)
    out["photos"] = {k: {"id": k, "name": d.name, "content_type": d.content_type} for k, d in photos.items()}
    baseline = None
    if insp.kind == "move_out":
        move_in = session.exec(
            select(Inspection).where(Inspection.lease_id == insp.lease_id, Inspection.kind == "move_in").order_by(Inspection.created_at.desc())
        ).first()
        if move_in:
            baseline = {f"{it['area']}|{it['item']}": {"condition": it.get("condition", ""), "notes": it.get("notes", ""), "photo_ids": it.get("photo_ids", [])} for it in move_in.items}
            mi_photos = _photo_docs(session, move_in)
            out["photos"].update({k: {"id": k, "name": d.name, "content_type": d.content_type} for k, d in mi_photos.items()})
    out["baseline"] = baseline
    return out


@router.get("/leases/{lease_id}/inspections")
def list_inspections(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    rows = ctx.session.exec(select(Inspection).where(Inspection.lease_id == lease.id).order_by(Inspection.inspected_on)).all()
    out = []
    for r in rows:
        flagged = sum(1 for it in r.items if it.get("condition") in ("poor", "damaged"))
        checked = sum(1 for it in r.items if it.get("condition"))
        out.append({**r.model_dump(exclude={"items"}), "item_count": len(r.items), "checked_count": checked, "flagged_count": flagged})
    return out


@router.post("/leases/{lease_id}/inspections", status_code=201)
def create_inspection(lease_id: uuid.UUID, payload: InspectionIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    if ctx.session.exec(select(Inspection.id).where(Inspection.lease_id == lease.id, Inspection.kind == payload.kind, Inspection.status == "draft")).first():
        raise HTTPException(status_code=409, detail="There's already a draft inspection of this type. Finish or delete it first.")
    items = None
    if payload.kind == "move_out":
        move_in = ctx.session.exec(
            select(Inspection).where(Inspection.lease_id == lease.id, Inspection.kind == "move_in").order_by(Inspection.created_at.desc())
        ).first()
        if move_in:  # same checklist, so move-in and move-out line up item by item
            items = [L.new_item(it["area"], it["item"]) for it in move_in.items]
    if items is None:
        items = L.default_items(ctx.session.get(Unit, lease.unit_id))
    insp = Inspection(org_id=ctx.org_id, lease_id=lease.id, kind=payload.kind, inspected_on=payload.inspected_on, items=items, created_by_user_id=ctx.user.id)
    ctx.session.add(insp)
    ctx.session.flush()
    audit.log(ctx, "inspection", insp.id, "create", f"Started {payload.kind.replace('_', '-')} inspection")
    ctx.session.commit()
    return _inspection_out(ctx.session, insp)


@router.get("/inspections/{inspection_id}")
def get_inspection(inspection_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    return _inspection_out(ctx.session, get_owned(ctx, Inspection, inspection_id, "Inspection"))


def _draft(ctx: Ctx, inspection_id: uuid.UUID) -> Inspection:
    insp = get_owned(ctx, Inspection, inspection_id, "Inspection")
    if insp.status != "draft":
        raise HTTPException(status_code=400, detail="This inspection is completed and can't be changed.")
    return insp


@router.patch("/inspections/{inspection_id}")
def update_inspection(inspection_id: uuid.UUID, payload: InspectionUpdate, ctx: Ctx = Depends(writer)):
    insp = _draft(ctx, inspection_id)
    if payload.items is not None:
        known_photos = {pid for it in insp.items for pid in it.get("photo_ids", [])}
        items = [i.model_dump() for i in payload.items]
        for it in items:  # photos are only added through the upload endpoint
            it["photo_ids"] = [p for p in it["photo_ids"] if p in known_photos]
        insp.items = items
    if payload.notes is not None:
        insp.notes = payload.notes or None
    if payload.inspected_on is not None:
        insp.inspected_on = payload.inspected_on
    insp.updated_at = utcnow()
    ctx.session.add(insp)
    ctx.session.commit()
    return _inspection_out(ctx.session, insp)


@router.post("/inspections/{inspection_id}/photos", status_code=201)
async def add_inspection_photo(inspection_id: uuid.UUID, item_id: str = Form(...), file: UploadFile = File(...), ctx: Ctx = Depends(writer)):
    insp = _draft(ctx, inspection_id)
    items = [dict(it) for it in insp.items]
    item = next((it for it in items if it["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Inspection photos must be images.")
    if len(item.get("photo_ids", [])) >= 20:
        raise HTTPException(status_code=400, detail="Up to 20 photos per item.")
    doc = await store_upload(ctx.session, ctx.org_id, ctx.user.id, file, "lease", insp.lease_id, "inspection")
    ctx.session.flush()
    item["photo_ids"] = [*item.get("photo_ids", []), str(doc.id)]
    insp.items = items
    insp.updated_at = utcnow()
    ctx.session.add(insp)
    ctx.session.commit()
    return _inspection_out(ctx.session, insp)


@router.delete("/inspections/{inspection_id}/photos/{document_id}")
def remove_inspection_photo(inspection_id: uuid.UUID, document_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    from app.core import storage

    insp = _draft(ctx, inspection_id)
    key = str(document_id)
    items = [dict(it) for it in insp.items]
    for it in items:
        it["photo_ids"] = [p for p in it.get("photo_ids", []) if p != key]
    insp.items = items
    doc = ctx.session.get(Document, document_id)
    if doc and doc.org_id == ctx.org_id and doc.kind == "inspection":
        storage.delete(doc.storage_key, doc.storage_backend)
        ctx.session.delete(doc)
    ctx.session.add(insp)
    ctx.session.commit()
    return _inspection_out(ctx.session, insp)


@router.post("/inspections/{inspection_id}/complete")
def complete_inspection(inspection_id: uuid.UUID, payload: InspectionCompleteIn, ctx: Ctx = Depends(writer)):
    insp = _draft(ctx, inspection_id)
    lease = ctx.session.get(Lease, insp.lease_id)
    pdf = L.inspection_pdf(ctx.session, ctx.org, lease, insp, _photo_docs(ctx.session, insp))
    label = "move-in" if insp.kind == "move_in" else "move-out"
    doc = L.store_generated(ctx.session, ctx.org_id, ctx.user.id, lease.id, "inspection", f"{label}-inspection-{insp.inspected_on.isoformat()}.pdf", pdf, payload.share_with_tenant)
    insp.status = "completed"
    insp.completed_at = utcnow()
    insp.document_id = doc.id
    ctx.session.add(insp)
    audit.log(ctx, "inspection", insp.id, "complete", f"Completed {label} inspection")
    ctx.session.commit()
    return _inspection_out(ctx.session, insp)


@router.get("/inspections/{inspection_id}/report.pdf")
def inspection_preview(inspection_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    insp = get_owned(ctx, Inspection, inspection_id, "Inspection")
    lease = ctx.session.get(Lease, insp.lease_id)
    pdf = L.inspection_pdf(ctx.session, ctx.org, lease, insp, _photo_docs(ctx.session, insp))
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="inspection.pdf"'})


@router.delete("/inspections/{inspection_id}")
def delete_inspection(inspection_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    from app.core import storage

    insp = _draft(ctx, inspection_id)
    for pid, doc in _photo_docs(ctx.session, insp).items():
        storage.delete(doc.storage_key, doc.storage_backend)
        ctx.session.delete(doc)
    ctx.session.delete(insp)
    audit.log(ctx, "inspection", inspection_id, "delete", "Deleted draft inspection")
    ctx.session.commit()
    return {"ok": True}


# ── Security deposit disposition ─────────────────────────────────────────────


def _disposition(ctx: Ctx, lease: Lease) -> DepositDisposition | None:
    return ctx.session.exec(select(DepositDisposition).where(DepositDisposition.lease_id == lease.id)).first()


def _disposition_out(ctx: Ctx, lease: Lease, d: DepositDisposition) -> dict:
    return {**d.model_dump(), **L.disposition_totals(d), "lease_balance_cents": billing.lease_balance(ctx.session, lease.id)}


@router.get("/leases/{lease_id}/deposit")
def get_deposit(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    d = _disposition(ctx, lease)
    if d:
        return {**_disposition_out(ctx, lease, d), "saved": True}
    # Unsaved draft with suggestions: unpaid balance and items flagged at move-out.
    balance = max(0, billing.lease_balance(ctx.session, lease.id))
    move_out = ctx.session.exec(
        select(Inspection).where(Inspection.lease_id == lease.id, Inspection.kind == "move_out").order_by(Inspection.created_at.desc())
    ).first()
    suggestions = []
    if move_out:
        for it in move_out.items:
            if it.get("condition") in ("poor", "damaged"):
                text = f"{it['area']} - {it['item']}" + (f": {it['notes']}" if it.get("notes") else "")
                suggestions.append({"description": text[:200], "amount_cents": 0})
    draft = DepositDisposition(org_id=ctx.org_id, lease_id=lease.id, deposit_cents=lease.deposit_cents, deductions=suggestions, balance_applied_cents=min(balance, lease.deposit_cents))
    return {**_disposition_out(ctx, lease, draft), "id": None, "saved": False}


@router.put("/leases/{lease_id}/deposit")
def save_deposit(lease_id: uuid.UUID, payload: DepositDispositionIn, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    d = _disposition(ctx, lease)
    if d and d.status == "sent":
        raise HTTPException(status_code=400, detail="This statement was already sent.")
    d = d or DepositDisposition(org_id=ctx.org_id, lease_id=lease.id)
    d.deposit_cents = lease.deposit_cents
    d.deductions = [x.model_dump() for x in payload.deductions]
    d.balance_applied_cents = payload.balance_applied_cents
    d.forwarding_address = payload.forwarding_address or None
    d.notes = payload.notes or None
    d.updated_at = utcnow()
    ctx.session.add(d)
    ctx.session.commit()
    return {**_disposition_out(ctx, lease, d), "saved": True}


@router.get("/leases/{lease_id}/deposit/preview.pdf")
def preview_deposit(lease_id: uuid.UUID, ctx: Ctx = Depends(staff)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    d = _disposition(ctx, lease)
    if not d:
        raise HTTPException(status_code=404, detail="Save the statement first.")
    pdf = L.disposition_pdf(ctx.session, ctx.org, lease, d, today_in(ctx.org.timezone))
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="deposit-statement.pdf"'})


@router.post("/leases/{lease_id}/deposit/send")
def send_deposit(lease_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    lease = get_owned(ctx, Lease, lease_id, "Lease")
    d = _disposition(ctx, lease)
    if not d:
        raise HTTPException(status_code=400, detail="Save the statement first.")
    if d.status == "sent":
        raise HTTPException(status_code=400, detail="This statement was already sent.")
    if d.balance_applied_cents > d.deposit_cents:
        raise HTTPException(status_code=422, detail="You can't apply more than the deposit to the balance.")
    today = today_in(ctx.org.timezone)
    if d.balance_applied_cents:
        billing._add_once(
            ctx.session,
            LedgerEntry(
                org_id=ctx.org_id,
                lease_id=lease.id,
                entry_type="credit",
                description="Security deposit applied to balance",
                amount_cents=-d.balance_applied_cents,
                entry_date=today,
                source_key=f"deposit:{lease.id}",
                created_by_user_id=ctx.user.id,
            ),
        )
    pdf = L.disposition_pdf(ctx.session, ctx.org, lease, d, today)
    doc = L.store_generated(ctx.session, ctx.org_id, ctx.user.id, lease.id, "notice", f"deposit-statement-{today.isoformat()}.pdf", pdf)
    d.status = "sent"
    d.sent_at = utcnow()
    d.document_id = doc.id
    ctx.session.add(d)
    totals = L.disposition_totals(d)
    audit.log(ctx, "lease", lease.id, "deposit_statement", f"Sent deposit statement (refund {money(totals['refund_cents'], ctx.org.currency)})")
    ctx.session.commit()
    html = layout(
        "Your security deposit statement",
        f"<p>{esc(ctx.org.name)} has sent the itemized statement for your security deposit. It's attached to this email "
        "and available in your tenant portal.</p>",
    )
    sent = 0
    for t in L.lease_tenant_rows(ctx.session, lease.id):
        if t.email:
            sent += notify(ctx.session, ctx.org_id, "deposit_statement", t.email, f"Security deposit statement from {ctx.org.name}", html, attachments=[Attachment(doc.name, pdf)])
    return {**_disposition_out(ctx, lease, d), "saved": True, "emails_sent": sent}


# ── Daily housekeeping (called from jobs.run_daily_for_org) ───────────────────


def daily_leasing(session: Session, org: Organization, today: date) -> dict[str, int]:
    expired = 0
    for offer in session.exec(select(RenewalOffer).where(RenewalOffer.org_id == org.id, RenewalOffer.status == "sent", RenewalOffer.respond_by < today)).all():
        offer.status = "expired"
        offer.updated_at = utcnow()
        session.add(offer)
        expired += 1
    # A renewed lease ends on its end date; the renewal lease takes over billing.
    ended = 0
    renewed_ids = {lid for lid in session.exec(select(Lease.renewal_of_id).where(Lease.org_id == org.id, Lease.renewal_of_id.is_not(None))).all()}
    if renewed_ids:
        for lease in session.exec(select(Lease).where(Lease.id.in_(renewed_ids), Lease.status == "active", Lease.end_date < today)).all():
            lease.status = "ended"
            lease.ended_on = lease.end_date
            lease.updated_at = utcnow()
            session.add(lease)
            ended += 1
    session.commit()
    return {"renewals_expired": expired, "renewed_leases_ended": ended}
