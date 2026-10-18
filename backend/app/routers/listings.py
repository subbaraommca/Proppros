"""Vacancy: listings, public listing pages, rental applications, screening reports and converting to a lease."""
import hashlib
import html
import json
import re
import secrets
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session, func, select

from app.core import audit, storage
from app.core.config import settings
from app.core.database import get_session
from app.core.dates import today_in
from app.core.deps import Ctx, get_owned, require_roles, writer
from app.core.email import Attachment, esc, layout
from app.core.limiter import _client_ip, rate_limit
from app.models import Application, Document, Listing, Organization, Property, Tenant, Unit, utcnow
from app.routers.documents import serve, store_upload
from app.schemas import (
    AdverseActionIn,
    ApplicationDecisionIn,
    ApplicationIn,
    ApplicationUpdate,
    ConvertApplicationIn,
    LeaseIn,
    ListingIn,
    ListingUpdate,
    ScreeningReportIn,
)
from app.services import leasing as L
from app.services import listing_marketing as M
from app.services import stripe_gateway as gateway
from app.services.notify import notify, staff_recipients
from app.services.online_payments import org_accepts_online
from app.services.receipts import money

router = APIRouter(tags=["listings"])
share_router = APIRouter()  # /l/{slug}: server-rendered share page with preview tags

# Applications hold personal and screening data: owners and managers only (accountants and maintenance don't see them).
manager = require_roles("owner", "manager")
MAX_APPLICANT_FILES = 10


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "listing"


def _unique_slug(session: Session, title: str) -> str:
    base = _slugify(title)
    while True:
        slug = f"{base}-{secrets.token_hex(2)}"
        if not session.exec(select(Listing.id).where(Listing.slug == slug)).first():
            return slug


def _photos(session: Session, listing: Listing) -> list[Document]:
    docs = session.exec(select(Document).where(Document.owner_type == "listing", Document.owner_id == listing.id, Document.content_type.startswith("image/"))).all()
    order = {pid: i for i, pid in enumerate(listing.photo_order or [])}
    return sorted(docs, key=lambda d: (order.get(str(d.id), 999), d.created_at))


def _location(session: Session, listing: Listing) -> tuple[Property, Unit]:
    return session.get(Property, listing.property_id), session.get(Unit, listing.unit_id)


def _listing_out(session: Session, listing: Listing, counts: dict | None = None) -> dict:
    prop, unit = _location(session, listing)
    return {
        **listing.model_dump(),
        "property_name": prop.name,
        "unit_name": unit.name,
        "address": f"{prop.address_line1}, {prop.city}, {prop.state} {prop.postal_code}",
        "photos": [{"id": str(d.id), "name": d.name} for d in _photos(session, listing)],
        "public_url": f"{settings.frontend_url}/listings/{listing.slug}",
        "share_url": f"{settings.frontend_url}/l/{listing.slug}",
        "application_counts": counts or {},
    }


# ── Staff: listings ──────────────────────────────────────────────────────────


@router.get("/listings")
def list_listings(ctx: Ctx = Depends(manager)):
    q = select(Listing).where(Listing.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(Listing.property_id.in_(ctx.scope))
    listings = ctx.session.exec(q.order_by(Listing.status, Listing.created_at.desc())).all()
    counts: dict[uuid.UUID, dict[str, int]] = {}
    if listings:
        for lid, st, n in ctx.session.exec(
            select(Application.listing_id, Application.status, func.count()).where(Application.listing_id.in_([l.id for l in listings])).group_by(Application.listing_id, Application.status)
        ).all():
            counts.setdefault(lid, {})[st] = n
    return [_listing_out(ctx.session, l, counts.get(l.id)) for l in listings]


@router.post("/listings", status_code=201)
def create_listing(payload: ListingIn, ctx: Ctx = Depends(writer)):
    unit = get_owned(ctx, Unit, payload.unit_id, "Unit")
    prop = ctx.session.get(Property, unit.property_id)
    title = payload.title or (prop.name if unit.name.lower() in ("main", "house", "home") else f"{prop.name} · {unit.name}")
    listing = Listing(
        org_id=ctx.org_id,
        property_id=prop.id,
        unit_id=unit.id,
        slug=_unique_slug(ctx.session, f"{title} {prop.city}"),
        title=title[:160],
        rent_cents=unit.market_rent_cents or 0,
        deposit_cents=unit.market_rent_cents or 0,
        beds=unit.beds,
        baths=unit.baths,
        sqft=unit.sqft,
        amenities=list(unit.amenities or []),
        contact_email=ctx.user.email,
        requirements="Gross monthly income of at least 3x the rent. No prior evictions. Credit and background check required.",
    )
    ctx.session.add(listing)
    ctx.session.flush()
    audit.log(ctx, "listing", listing.id, "create", f"Created listing {listing.title}")
    ctx.session.commit()
    return _listing_out(ctx.session, listing)


@router.get("/listings/{listing_id}")
def get_listing(listing_id: uuid.UUID, ctx: Ctx = Depends(manager)):
    return _listing_out(ctx.session, get_owned(ctx, Listing, listing_id, "Listing"))


# ── Staff: marketing kit (ad text and flyer) ─────────────────────────────────
# Only for published listings: the share link of a draft or closed listing doesn't open, so
# advertising it would send people to a dead page. Those get 409 with a clear message.


def _marketing_listing(ctx: Ctx, listing_id: uuid.UUID) -> tuple[Listing, "M.Facts", str]:
    listing = get_owned(ctx, Listing, listing_id, "Listing")
    if listing.status != "published":
        raise HTTPException(status_code=409, detail="Publish the listing before marketing it. Its link only works while it is published.")
    prop, unit = _location(ctx.session, listing)
    facts = M.Facts(listing, prop, unit, ctx.org, today_in(ctx.org.timezone))
    return listing, facts, f"{settings.frontend_url}/l/{listing.slug}"


@router.get("/listings/{listing_id}/marketing")
def listing_marketing(listing_id: uuid.UUID, ctx: Ctx = Depends(manager)):
    listing, facts, share_url = _marketing_listing(ctx, listing_id)
    return {
        "share_url": share_url,
        "texts": M.marketing_texts(facts, share_url),
        "fair_housing_note": M.FAIR_HOUSING_NOTE,
        # Risky phrases in the landlord's own words, which the ad text repeats as written.
        "fair_housing_flags": M.fair_housing_flags(listing.title, listing.description, listing.pet_policy),
    }


@router.get("/listings/{listing_id}/flyer.pdf")
def listing_flyer(listing_id: uuid.UUID, ctx: Ctx = Depends(manager)):
    listing, facts, share_url = _marketing_listing(ctx, listing_id)
    photos = _photos(ctx.session, listing)
    pdf = M.flyer_pdf(facts, ctx.org, share_url, M.photo_bytes(photos[0]) if photos else None)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="flyer-{listing.slug}.pdf"'})


@router.patch("/listings/{listing_id}")
def update_listing(listing_id: uuid.UUID, payload: ListingUpdate, ctx: Ctx = Depends(writer)):
    listing = get_owned(ctx, Listing, listing_id, "Listing")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is None and k in ("title", "rent_cents", "deposit_cents", "amenities", "application_fee_cents", "photo_order"):
            continue
        setattr(listing, k, v)
    listing.updated_at = utcnow()
    ctx.session.add(listing)
    ctx.session.commit()
    return _listing_out(ctx.session, listing)


@router.post("/listings/{listing_id}/publish")
def publish_listing(listing_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    listing = get_owned(ctx, Listing, listing_id, "Listing")
    missing = [name for name, ok in (("rent", listing.rent_cents > 0), ("description", bool(listing.description)), ("contact email", bool(listing.contact_email))) if not ok]
    if missing:
        raise HTTPException(status_code=422, detail=f"Add the {', '.join(missing)} before publishing.")
    listing.status = "published"
    listing.published_at = listing.published_at or utcnow()
    listing.closed_at = None
    ctx.session.add(listing)
    audit.log(ctx, "listing", listing.id, "publish", f"Published listing {listing.title}")
    ctx.session.commit()
    return _listing_out(ctx.session, listing)


@router.post("/listings/{listing_id}/close")
def close_listing(listing_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    listing = get_owned(ctx, Listing, listing_id, "Listing")
    listing.status = "closed"
    listing.closed_at = utcnow()
    ctx.session.add(listing)
    audit.log(ctx, "listing", listing.id, "close", f"Closed listing {listing.title}")
    ctx.session.commit()
    return _listing_out(ctx.session, listing)


@router.delete("/listings/{listing_id}")
def delete_listing(listing_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    listing = get_owned(ctx, Listing, listing_id, "Listing")
    if ctx.session.exec(select(Application.id).where(Application.listing_id == listing.id)).first():
        raise HTTPException(status_code=400, detail="This listing has applications. Close it instead.")
    for d in ctx.session.exec(select(Document).where(Document.owner_type == "listing", Document.owner_id == listing.id)).all():
        storage.delete(d.storage_key, d.storage_backend)
        ctx.session.delete(d)
    ctx.session.delete(listing)
    audit.log(ctx, "listing", listing_id, "delete", "Deleted draft listing")
    ctx.session.commit()
    return {"ok": True}


# ── Public: listing page, share page, apply ──────────────────────────────────


def _published(session: Session, slug: str) -> Listing:
    listing = session.exec(select(Listing).where(Listing.slug == slug)).first()
    if not listing or listing.status != "published":
        raise HTTPException(status_code=404, detail="This listing isn't available.")
    return listing


@router.get("/public/listings/{slug}", dependencies=[Depends(rate_limit("listing_view", 60, 60))])
def public_listing(slug: str, session: Session = Depends(get_session)):
    listing = _published(session, slug)
    listing.views += 1
    session.add(listing)
    session.commit()
    prop, unit = _location(session, listing)
    org = session.get(Organization, listing.org_id)
    return {
        "slug": listing.slug,
        "title": listing.title,
        "description": listing.description,
        "rent_cents": listing.rent_cents,
        "deposit_cents": listing.deposit_cents,
        "available_on": listing.available_on,
        "lease_term_months": listing.lease_term_months,
        "beds": listing.beds,
        "baths": listing.baths,
        "sqft": listing.sqft,
        "amenities": listing.amenities,
        "pet_policy": listing.pet_policy,
        "utilities_included": listing.utilities_included,
        "requirements": listing.requirements,
        "application_fee_cents": listing.application_fee_cents,
        "fee_online": bool(listing.application_fee_cents) and org_accepts_online(org),
        "contact_email": listing.contact_email,
        "contact_phone": listing.contact_phone,
        "property_type": prop.property_type,
        "address": f"{prop.address_line1}" + (f", {unit.name}" if unit.name.lower() not in ("main", "house", "home") else ""),
        "city": prop.city,
        "state": prop.state,
        "postal_code": prop.postal_code,
        "organization": org.name,
        "photos": [str(d.id) for d in _photos(session, listing)],
    }


@router.get("/public/listings/{slug}/photos/{document_id}")
def public_listing_photo(slug: str, document_id: uuid.UUID, session: Session = Depends(get_session)):
    listing = _published(session, slug)
    doc = session.get(Document, document_id)
    if not doc or doc.owner_type != "listing" or doc.owner_id != listing.id or not doc.content_type.startswith("image/"):
        raise HTTPException(status_code=404, detail="Photo not found")
    resp = serve(doc)
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


def share_page(slug: str, session: Session) -> HTMLResponse:
    """Small server-rendered page so link previews (and crawlers) get the title, photo and price."""
    listing = session.exec(select(Listing).where(Listing.slug == slug)).first()
    target = f"{settings.frontend_url}/listings/{slug}"
    if not listing or listing.status != "published":
        return HTMLResponse(f'<!doctype html><meta http-equiv="refresh" content="0;url={html.escape(target)}">', status_code=404)
    prop, unit = _location(session, listing)
    photos = _photos(session, listing)
    price = money(listing.rent_cents)
    bits = [f"{listing.beds:g} bd" if listing.beds is not None else "", f"{listing.baths:g} ba" if listing.baths is not None else "", f"{listing.sqft} sq ft" if listing.sqft else ""]
    summary = f"{price}/mo · " + " · ".join(b for b in bits if b) + f" · {prop.city}, {prop.state}"
    desc = (listing.description or summary)[:200]
    image = f"{settings.frontend_url}/api/public/listings/{slug}/photos/{photos[0].id}" if photos else ""
    ld = {
        "@context": "https://schema.org",
        "@type": "Accommodation" if unit.name.lower() not in ("main", "house", "home") else "SingleFamilyResidence",
        "name": listing.title,
        "description": desc,
        "numberOfRooms": listing.beds,
        "floorSize": {"@type": "QuantitativeValue", "value": listing.sqft, "unitCode": "FTK"} if listing.sqft else None,
        "address": {"@type": "PostalAddress", "addressLocality": prop.city, "addressRegion": prop.state, "postalCode": prop.postal_code, "addressCountry": prop.country},
        "image": image or None,
    }
    e = html.escape
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{e(listing.title)} — {e(price)}/mo</title>
<meta name="description" content="{e(summary)}">
<link rel="canonical" href="{e(target)}">
<meta property="og:type" content="website"><meta property="og:title" content="{e(listing.title)} — {e(price)}/mo">
<meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{e(target)}">
{f'<meta property="og:image" content="{e(image)}">' if image else ''}
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps({k: v for k, v in ld.items() if v is not None}).replace("</", "<\\/")}</script>
<meta http-equiv="refresh" content="0;url={e(target)}">
</head><body><p><a href="{e(target)}">{e(listing.title)} — {e(summary)}</a></p></body></html>"""
    return HTMLResponse(page, headers={"Cache-Control": "public, max-age=300"})


@share_router.get("/l/{slug}", include_in_schema=False)
def share(slug: str, session: Session = Depends(get_session)):
    return share_page(slug, session)


@router.get("/l/{slug}", include_in_schema=False)
def share_api(slug: str, session: Session = Depends(get_session)):
    return share_page(slug, session)


def _fee_checkout(session: Session, org: Organization, listing: Listing, app: Application, token: str) -> str | None:
    if not app.fee_cents or app.fee_status != "unpaid" or not org_accepts_online(org):
        return None
    session_id, url = gateway.checkout_application_fee(
        destination=org.stripe_account_id,
        amount_cents=app.fee_cents,
        email=app.email,
        description=f"Application fee — {listing.title}",
        metadata={"purpose": "application_fee", "org_id": str(org.id), "application_id": str(app.id), "source": "application_fee"},
        success_url=f"{settings.frontend_url}/application/{token}?fee=paid",
        cancel_url=f"{settings.frontend_url}/application/{token}?fee=cancelled",
    )
    app.stripe_session_id = session_id
    session.add(app)
    session.commit()
    return url


@router.post("/public/listings/{slug}/apply", status_code=201, dependencies=[Depends(rate_limit("apply", 5, 600))])
def apply(slug: str, payload: ApplicationIn, request: Request, session: Session = Depends(get_session)):
    listing = _published(session, slug)
    if payload.website:  # honeypot filled in → bot
        raise HTTPException(status_code=400, detail="Something went wrong. Please try again.")
    org = session.get(Organization, listing.org_id)
    token = secrets.token_urlsafe(32)
    data = payload.model_dump(exclude={"consent", "website", "co_applicants"})
    app = Application(
        org_id=org.id,
        listing_id=listing.id,
        co_applicants=[c.model_dump() for c in payload.co_applicants],
        consent_at=utcnow(),
        ip_address=_client_ip(request)[:64],
        status_token_hash=_hash(token),
        fee_cents=listing.application_fee_cents,
        fee_status="unpaid" if listing.application_fee_cents else "none",
        **data,
    )
    session.add(app)
    session.flush()
    audit.record(session, org.id, None, "application", app.id, "submit", f"Application from {app.first_name} {app.last_name} for {listing.title}")
    session.commit()

    status_url = f"{settings.frontend_url}/application/{token}"
    notify(
        session,
        org.id,
        "application_received",
        app.email,
        f"We received your application for {listing.title}",
        layout(
            "Application received",
            f"<p>Hi {esc(app.first_name)},</p><p>Thanks for applying for <strong>{esc(listing.title)}</strong>. {esc(org.name)} will review it and get back to you.</p>"
            "<p>Use the link below to check your application status or upload documents such as pay stubs. Keep it private.</p>",
            "View my application",
            status_url,
        ),
    )
    staff_html = layout(
        "New rental application",
        f"<p><strong>{esc(app.first_name)} {esc(app.last_name)}</strong> applied for {esc(listing.title)}.</p>"
        + (f"<p>Stated income: {money(app.monthly_income_cents)}/mo (rent {money(listing.rent_cents)})</p>" if app.monthly_income_cents else ""),
        "Review application",
        f"{settings.frontend_url}/vacancy/{listing.id}",
    )
    for email in staff_recipients(session, org.id, "maintenance_updates"):
        notify(session, org.id, "application_new", email, f"New application: {listing.title}", staff_html)
    checkout_url = _fee_checkout(session, org, listing, app, token)
    return {"status_url": status_url, "token": token, "checkout_url": checkout_url, "fee_cents": app.fee_cents, "fee_online": bool(checkout_url)}


def _by_token(session: Session, token: str) -> Application:
    app = session.exec(select(Application).where(Application.status_token_hash == _hash(token))).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found. Check the link in your confirmation email.")
    return app


@router.get("/public/applications/{token}", dependencies=[Depends(rate_limit("application_status", 30, 60))])
def application_status(token: str, session: Session = Depends(get_session)):
    app = _by_token(session, token)
    listing = session.get(Listing, app.listing_id)
    org = session.get(Organization, app.org_id)
    docs = session.exec(select(Document).where(Document.owner_type == "application", Document.owner_id == app.id)).all()
    return {
        "first_name": app.first_name,
        "listing_title": listing.title,
        "listing_slug": listing.slug if listing.status == "published" else None,
        "organization": org.name,
        "status": app.status,
        "submitted_at": app.created_at,
        "fee_cents": app.fee_cents,
        "fee_status": app.fee_status,
        "fee_online": app.fee_status == "unpaid" and bool(app.fee_cents) and org_accepts_online(org),
        "screening_requested": app.screening_status == "requested",
        "screening_url": listing.screening_url if app.screening_status == "requested" else None,
        "documents": [{"id": str(d.id), "name": d.name, "uploaded_at": d.created_at} for d in docs],
        "can_upload": app.status in ("submitted", "screening") and len(docs) < MAX_APPLICANT_FILES,
    }


@router.post("/public/applications/{token}/documents", status_code=201, dependencies=[Depends(rate_limit("application_upload", 10, 600))])
async def applicant_upload(token: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    app = _by_token(session, token)
    if app.status not in ("submitted", "screening"):
        raise HTTPException(status_code=400, detail="This application is closed.")
    count = session.exec(select(func.count()).select_from(Document).where(Document.owner_type == "application", Document.owner_id == app.id)).one()
    if count >= MAX_APPLICANT_FILES:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_APPLICANT_FILES} files per application.")
    ctype = (file.content_type or "").split(";")[0].lower()
    if not (ctype == "application/pdf" or ctype.startswith("image/")):
        raise HTTPException(status_code=415, detail="Upload a PDF or a photo.")
    doc = await store_upload(session, app.org_id, None, file, "application", app.id, "other")
    session.commit()
    return {"id": str(doc.id), "name": doc.name}


@router.post("/public/applications/{token}/pay")
def applicant_pay(token: str, session: Session = Depends(get_session)):
    app = _by_token(session, token)
    listing = session.get(Listing, app.listing_id)
    url = _fee_checkout(session, session.get(Organization, app.org_id), listing, app, token)
    if not url:
        raise HTTPException(status_code=400, detail="Online payment isn't available for this application.")
    return {"checkout_url": url}


@router.post("/public/applications/{token}/withdraw")
def applicant_withdraw(token: str, session: Session = Depends(get_session)):
    app = _by_token(session, token)
    if app.status not in ("submitted", "screening"):
        raise HTTPException(status_code=400, detail="This application can no longer be withdrawn.")
    app.status = "withdrawn"
    app.updated_at = utcnow()
    session.add(app)
    audit.record(session, app.org_id, None, "application", app.id, "withdraw", f"{app.first_name} {app.last_name} withdrew their application")
    session.commit()
    return {"status": app.status}


def application_fee_paid(session: Session, cs: dict) -> str:
    """Stripe checkout.session.completed for an application fee (called from the webhook handler)."""
    if cs.get("payment_status") != "paid":
        return "ignored"
    try:
        app = session.get(Application, uuid.UUID((cs.get("metadata") or {})["application_id"]))
    except (KeyError, ValueError):
        return "ignored"
    if not app or app.fee_status == "paid":
        return "ignored"
    app.fee_status = "paid"
    app.fee_paid_at = utcnow()
    session.add(app)
    audit.record(session, app.org_id, None, "application", app.id, "fee_paid", f"Application fee {money(app.fee_cents)} paid online")
    return "application_fee_paid"


# ── Staff: applications ──────────────────────────────────────────────────────


def _application(ctx: Ctx, application_id: uuid.UUID) -> Application:
    return get_owned(ctx, Application, application_id, "Application")


def _app_summary(app: Application, listing: Listing) -> dict:
    ratio = round(app.monthly_income_cents / listing.rent_cents, 1) if app.monthly_income_cents and listing.rent_cents else None
    return {
        "id": str(app.id),
        "listing_id": str(app.listing_id),
        "listing_title": listing.title,
        "status": app.status,
        "name": f"{app.first_name} {app.last_name}",
        "email": app.email,
        "phone": app.phone,
        "created_at": app.created_at,
        "desired_move_in": app.desired_move_in,
        "monthly_income_cents": app.monthly_income_cents,
        "income_to_rent": ratio,
        "occupants": app.occupants,
        "co_applicants": len(app.co_applicants or []),
        "pets": app.pets,
        "prior_eviction": app.prior_eviction,
        "fee_status": app.fee_status,
        "screening_status": app.screening_status,
        "credit_score": app.credit_score,
        "criminal_count": len(app.criminal_records or []),
        "eviction_count": len(app.eviction_records or []),
        "screening_result": app.screening_result,
        "rating": app.rating,
    }


@router.get("/applications")
def list_applications(listing_id: uuid.UUID | None = None, status: str | None = None, ctx: Ctx = Depends(manager)):
    q = select(Application, Listing).join(Listing, Listing.id == Application.listing_id).where(Application.org_id == ctx.org_id)
    if ctx.scope is not None:
        q = q.where(Listing.property_id.in_(ctx.scope))
    if listing_id:
        q = q.where(Application.listing_id == listing_id)
    if status:
        q = q.where(Application.status == status)
    return [_app_summary(a, l) for a, l in ctx.session.exec(q.order_by(Application.created_at.desc())).all()]


@router.get("/applications/{application_id}")
def get_application(application_id: uuid.UUID, ctx: Ctx = Depends(manager)):
    app = _application(ctx, application_id)
    listing = ctx.session.get(Listing, app.listing_id)
    docs = ctx.session.exec(select(Document).where(Document.owner_type == "application", Document.owner_id == app.id).order_by(Document.created_at)).all()
    out = {**app.model_dump(exclude={"status_token_hash", "stripe_session_id"}), **_app_summary(app, listing)}
    out["listing"] = {"id": str(listing.id), "title": listing.title, "rent_cents": listing.rent_cents, "deposit_cents": listing.deposit_cents, "unit_id": str(listing.unit_id), "screening_url": listing.screening_url, "requirements": listing.requirements, "available_on": listing.available_on, "lease_term_months": listing.lease_term_months}
    out["documents"] = [{"id": str(d.id), "name": d.name, "content_type": d.content_type, "created_at": d.created_at} for d in docs]
    return out


@router.patch("/applications/{application_id}")
def update_application(application_id: uuid.UUID, payload: ApplicationUpdate, ctx: Ctx = Depends(writer)):
    app = _application(ctx, application_id)
    if app.status == "converted":
        raise HTTPException(status_code=400, detail="This application was converted to a lease.")
    data = payload.model_dump(exclude_unset=True)
    if data.get("status") in ("approved", "declined"):
        raise HTTPException(status_code=400, detail="Use Approve or Decline so the applicant is notified.")
    for k, v in data.items():
        setattr(app, k, v)
    app.updated_at = utcnow()
    ctx.session.add(app)
    ctx.session.commit()
    return get_application(application_id, ctx)


@router.delete("/applications/{application_id}")
def delete_application(application_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    """Erase an application and its files (e.g. after your retention period)."""
    app = _application(ctx, application_id)
    for d in ctx.session.exec(select(Document).where(Document.owner_type == "application", Document.owner_id == app.id)).all():
        storage.delete(d.storage_key, d.storage_backend)
        ctx.session.delete(d)
    ctx.session.flush()
    name = f"{app.first_name} {app.last_name}"
    ctx.session.delete(app)
    audit.log(ctx, "application", application_id, "delete", f"Deleted application from {name}")
    ctx.session.commit()
    return {"ok": True}


@router.post("/applications/{application_id}/request-screening")
def request_screening(application_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    app = _application(ctx, application_id)
    listing = ctx.session.get(Listing, app.listing_id)
    if not listing.screening_url:
        raise HTTPException(status_code=400, detail="Add your screening provider's link to the listing first.")
    if app.status not in ("submitted", "screening"):
        raise HTTPException(status_code=400, detail="This application is closed.")
    app.screening_status = "requested"
    app.screening_requested_at = utcnow()
    app.status = "screening"
    ctx.session.add(app)
    audit.log(ctx, "application", app.id, "screening_requested", f"Requested screening for {app.first_name} {app.last_name}")
    ctx.session.commit()
    html_body = layout(
        "Next step: background and credit check",
        f"<p>Hi {esc(app.first_name)},</p><p>{esc(ctx.org.name)} would like to run a credit, criminal and eviction check for your application "
        f"for <strong>{esc(listing.title)}</strong>.</p><p>The check is done by a screening company, which will ask for your consent and "
        "personal details (such as your Social Security number) directly. Proppros never sees or stores those.</p>",
        "Start the screening",
        listing.screening_url,
    )
    sent = notify(ctx.session, ctx.org_id, "screening_request", app.email, f"Screening for your application — {listing.title}", html_body)
    return {"email_sent": sent, "screening_url": listing.screening_url}


@router.put("/applications/{application_id}/screening")
def save_screening_report(application_id: uuid.UUID, payload: ScreeningReportIn, ctx: Ctx = Depends(writer)):
    """Record the screening report: credit, criminal and eviction history (from the provider's report)."""
    app = _application(ctx, application_id)
    if payload.document_id:
        doc = ctx.session.get(Document, payload.document_id)
        if not doc or doc.org_id != ctx.org_id or doc.owner_type != "application" or doc.owner_id != app.id:
            raise HTTPException(status_code=404, detail="Report file not found")
    app.screening_provider = payload.provider
    app.screening_report_date = payload.report_date
    app.credit_score = payload.credit_score
    app.credit_summary = payload.credit_summary.model_dump(exclude_none=True)
    app.criminal_records = [r.model_dump(mode="json") for r in payload.criminal_records]
    app.eviction_records = [r.model_dump(mode="json") for r in payload.eviction_records]
    app.screening_document_id = payload.document_id
    app.screening_result = payload.result
    app.screening_notes = payload.notes
    app.screening_status = "completed"
    app.updated_at = utcnow()
    ctx.session.add(app)
    # Never copy report contents into the audit log — only that it was recorded.
    audit.log(ctx, "application", app.id, "screening_recorded", f"Recorded screening report for {app.first_name} {app.last_name}")
    ctx.session.commit()
    return get_application(application_id, ctx)


@router.post("/applications/{application_id}/report-file", status_code=201)
async def upload_report_file(application_id: uuid.UUID, file: UploadFile = File(...), ctx: Ctx = Depends(writer)):
    app = _application(ctx, application_id)
    doc = await store_upload(ctx.session, ctx.org_id, ctx.user.id, file, "application", app.id, "other")
    ctx.session.commit()
    return {"id": str(doc.id), "name": doc.name}


def _decide(ctx: Ctx, app: Application, status: str) -> Listing:
    if app.status not in ("submitted", "screening", "approved", "declined"):
        raise HTTPException(status_code=400, detail="This application is closed.")
    app.status = status
    app.decided_at = utcnow()
    app.decided_by_user_id = ctx.user.id
    app.updated_at = utcnow()
    ctx.session.add(app)
    return ctx.session.get(Listing, app.listing_id)


@router.post("/applications/{application_id}/approve")
def approve_application(application_id: uuid.UUID, payload: ApplicationDecisionIn, ctx: Ctx = Depends(writer)):
    app = _application(ctx, application_id)
    listing = _decide(ctx, app, "approved")
    audit.log(ctx, "application", app.id, "approve", f"Approved {app.first_name} {app.last_name}")
    ctx.session.commit()
    sent = False
    if payload.notify:
        sent = notify(
            ctx.session,
            ctx.org_id,
            "application_approved",
            app.email,
            f"Your application for {listing.title} was approved",
            layout("Good news — you're approved", f"<p>Hi {esc(app.first_name)},</p><p>Your application for <strong>{esc(listing.title)}</strong> was approved.</p>"
                   + (f"<p>{esc(payload.message)}</p>" if payload.message else "") + f"<p>{esc(ctx.org.name)} will be in touch about the lease and move-in.</p>"),
        )
    return {**get_application(application_id, ctx), "email_sent": sent}


@router.post("/applications/{application_id}/decline")
def decline_application(application_id: uuid.UUID, payload: ApplicationDecisionIn, ctx: Ctx = Depends(writer)):
    app = _application(ctx, application_id)
    listing = _decide(ctx, app, "declined")
    audit.log(ctx, "application", app.id, "decline", f"Declined {app.first_name} {app.last_name}")
    ctx.session.commit()
    sent = False
    if payload.notify:
        sent = notify(
            ctx.session,
            ctx.org_id,
            "application_declined",
            app.email,
            f"Update on your application for {listing.title}",
            layout("Application update", f"<p>Hi {esc(app.first_name)},</p><p>Thank you for applying for <strong>{esc(listing.title)}</strong>. "
                   "After review, we're unable to offer you this home.</p>" + (f"<p>{esc(payload.message)}</p>" if payload.message else "")),
        )
    return {**get_application(application_id, ctx), "email_sent": sent}


def adverse_action_pdf(org: Organization, app: Application, listing: Listing, p: AdverseActionIn, today: date) -> bytes:
    pdf = L.DocPDF(org.name, "Notice of adverse action")
    pdf.add_page()
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, L.latin1(L._long(today)), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.multi_cell(0, 5, L.latin1(f"{app.first_name} {app.last_name}\n{app.current_address or ''}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.heading("Notice of adverse action", 15)
    pdf.para(f"Thank you for your application to rent **{listing.title}**. We regret to inform you that your application has been "
             "declined (or approved only on less favorable terms) based in whole or in part on information in a consumer report.")
    pdf.ln(2)
    pdf.heading("Principal reasons", 11)
    for r in p.reasons:
        pdf.para(f"- {r}")
    pdf.ln(2)
    pdf.heading("The consumer reporting agency", 11)
    pdf.para(f"The report was provided by **{p.agency_name}**, {p.agency_address}, phone {p.agency_phone}. "
             "The consumer reporting agency did not make this decision and is unable to tell you the specific reasons why it was made.")
    pdf.ln(2)
    pdf.heading("Your rights", 11)
    pdf.para("Under the Fair Credit Reporting Act you have the right to obtain a free copy of your consumer report from the agency named above "
             "if you request it within 60 days of receiving this notice. You also have the right to dispute directly with the agency the "
             "accuracy or completeness of any information in the report.")
    if p.credit_score_used and app.credit_score:
        pdf.ln(2)
        pdf.heading("Credit score", 11)
        pdf.para(f"Your credit score: **{app.credit_score}** (scores range from 300 to 850). "
                 + (f"Date: {L._long(app.screening_report_date)}. " if app.screening_report_date else "") + f"Source: {p.agency_name}.")
    pdf.ln(8)
    pdf.para(f"Sincerely,\n\n{org.name}")
    return bytes(pdf.output())


@router.post("/applications/{application_id}/adverse-action")
def send_adverse_action(application_id: uuid.UUID, payload: AdverseActionIn, ctx: Ctx = Depends(writer)):
    """FCRA notice when declining based on a screening report: emails a PDF letter and keeps a copy."""
    app = _application(ctx, application_id)
    listing = ctx.session.get(Listing, app.listing_id)
    pdf = adverse_action_pdf(ctx.org, app, listing, payload, today_in(ctx.org.timezone))
    name = f"adverse-action-notice-{L.file_slug(app.last_name)}.pdf"
    stored = storage.put(ctx.org_id, name, pdf, "application/pdf")
    doc = Document(org_id=ctx.org_id, owner_type="application", owner_id=app.id, kind="notice", name=name, content_type="application/pdf", size_bytes=len(pdf),
                   storage_backend=stored.backend, storage_key=stored.key, uploaded_by_user_id=ctx.user.id)
    ctx.session.add(doc)
    app.adverse_action_sent_at = utcnow()
    if app.status in ("submitted", "screening"):
        _decide(ctx, app, "declined")
    ctx.session.add(app)
    audit.log(ctx, "application", app.id, "adverse_action", f"Sent adverse action notice to {app.first_name} {app.last_name}")
    ctx.session.commit()
    sent = notify(
        ctx.session, ctx.org_id, "adverse_action", app.email, f"Notice regarding your application for {listing.title}",
        layout("Notice regarding your rental application", f"<p>Hi {esc(app.first_name)},</p><p>Please see the attached notice about your application for "
               f"<strong>{esc(listing.title)}</strong>, including your rights under the Fair Credit Reporting Act.</p>"),
        attachments=[Attachment(name, pdf)],
    )
    return {**get_application(application_id, ctx), "email_sent": sent, "document_id": str(doc.id)}


@router.post("/applications/{application_id}/convert")
def convert_application(application_id: uuid.UUID, payload: ConvertApplicationIn, ctx: Ctx = Depends(writer)):
    """Approved applicant → tenant(s) + lease, optionally inviting them to the portal and closing the listing."""
    from app.routers.leases import create_lease
    from app.routers.orgs import create_invitation

    app = _application(ctx, application_id)
    if app.status != "approved":
        raise HTTPException(status_code=400, detail="Approve the application first.")
    listing = ctx.session.get(Listing, app.listing_id)
    people = [(app.first_name, app.last_name, app.email, app.phone)]
    if payload.include_co_applicants:
        for c in app.co_applicants or []:
            first, _, last = (c.get("name") or "").strip().partition(" ")
            people.append((first or "Co-applicant", last or "", c.get("email"), None))
    tenants = []
    for first, last, email, phone in people:
        existing = ctx.session.exec(select(Tenant).where(Tenant.org_id == ctx.org_id, Tenant.email == email)).first() if email else None
        t = existing or Tenant(org_id=ctx.org_id, first_name=first[:80], last_name=(last or "-")[:80], email=email, phone=phone, notes="Created from a rental application.")
        ctx.session.add(t)
        tenants.append(t)
    ctx.session.flush()
    tenant_ids = [t.id for t in tenants]
    ctx.session.commit()
    lease = create_lease(
        LeaseIn(unit_id=listing.unit_id, tenant_ids=tenant_ids, primary_tenant_id=tenant_ids[0], start_date=payload.start_date, end_date=payload.end_date,
                rent_cents=payload.rent_cents, deposit_cents=payload.deposit_cents, due_day=payload.due_day),
        ctx,
    )
    app = ctx.session.get(Application, app.id)
    app.status = "converted"
    app.tenant_id = tenant_ids[0]
    app.lease_id = uuid.UUID(str(lease["id"]))
    ctx.session.add(app)
    if payload.close_listing:
        listing = ctx.session.get(Listing, listing.id)
        listing.status = "closed"
        listing.closed_at = utcnow()
        ctx.session.add(listing)
    audit.log(ctx, "application", app.id, "convert", f"Converted {app.first_name} {app.last_name} to a lease")
    ctx.session.commit()
    invites = []
    if payload.invite_to_portal:
        for t in tenants:
            t = ctx.session.get(Tenant, t.id)
            if t.email and not t.user_id:
                try:
                    _, link, sent = create_invitation(ctx, t.email, "tenant", tenant_id=t.id)
                    ctx.session.commit()
                    invites.append({"name": f"{t.first_name} {t.last_name}", "email": t.email, "url": link, "email_sent": sent})
                except HTTPException:
                    ctx.session.rollback()
    return {"lease_id": str(lease["id"]), "tenant_ids": [str(t) for t in tenant_ids], "invites": invites}


@router.get("/applications/{application_id}/documents/{document_id}")
def application_document(application_id: uuid.UUID, document_id: uuid.UUID, ctx: Ctx = Depends(manager)):
    app = _application(ctx, application_id)
    doc = ctx.session.get(Document, document_id)
    if not doc or doc.owner_type != "application" or doc.owner_id != app.id:
        raise HTTPException(status_code=404, detail="File not found")
    return serve(doc)

