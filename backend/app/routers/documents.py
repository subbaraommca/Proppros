import uuid
from urllib.parse import quote
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlmodel import Session, select

from app.core import audit, storage
from app.core.config import settings
from app.core.dates import today_in
from app.core.deps import Ctx, get_ctx, property_id_of, staff, tenant_in_scope, writer
from app.models import (
    DOCUMENT_KINDS,
    DOCUMENT_OWNER_TYPES,
    Document,
    Expense,
    Lease,
    LeaseTenant,
    Organization,
    Property,
    Tenant,
    Asset,
    Unit,
    User,
    Vendor,
    WorkOrder,
    utcnow,
)
from app.schemas import DocumentUpdate

router = APIRouter(prefix="/documents", tags=["documents"])

OWNER_MODELS = {
    "organization": Organization,
    "property": Property,
    "unit": Unit,
    "tenant": Tenant,
    "lease": Lease,
    "expense": Expense,
    "work_order": WorkOrder,
    "vendor": Vendor,
    "asset": Asset,
}

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "video/mp4",
    "video/quicktime",
}


def check_owner(session: Session, org_id: uuid.UUID, owner_type: str, owner_id: uuid.UUID) -> None:
    if owner_type not in OWNER_MODELS:
        raise HTTPException(status_code=422, detail="Unsupported document owner type.")
    if owner_type == "organization":
        if owner_id != org_id:
            raise HTTPException(status_code=404, detail="Organization not found")
        return
    obj = session.get(OWNER_MODELS[owner_type], owner_id)
    if not obj or obj.org_id != org_id:
        raise HTTPException(status_code=404, detail=f"{owner_type.replace('_', ' ').title()} not found")


async def store_upload(
    session: Session,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    file: UploadFile,
    owner_type: str,
    owner_id: uuid.UUID,
    kind: str,
    expires_on: date | None = None,
    visible_to_tenant: bool = False,
) -> Document:
    if kind not in DOCUMENT_KINDS or owner_type not in DOCUMENT_OWNER_TYPES:
        raise HTTPException(status_code=422, detail="Invalid document kind or owner.")
    content_type = (file.content_type or "application/octet-stream").split(";")[0].lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="That file type isn't supported. Upload a PDF, image, video or Office document.")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Files must be {settings.max_upload_bytes // (1024 * 1024)} MB or smaller.")
    if not data:
        raise HTTPException(status_code=422, detail="The file is empty.")
    stored = storage.put(org_id, file.filename or "file", data, content_type)
    doc = Document(
        org_id=org_id,
        owner_type=owner_type,
        owner_id=owner_id,
        kind=kind,
        name=(file.filename or "file")[:200],
        content_type=content_type,
        size_bytes=len(data),
        storage_backend=stored.backend,
        storage_key=stored.key,
        expires_on=expires_on,
        visible_to_tenant=visible_to_tenant,
        uploaded_by_user_id=user_id,
    )
    session.add(doc)
    return doc


def content_disposition(kind: str, filename: str) -> str:
    """RFC 6266 header that survives non-ASCII names (headers must be latin-1)."""
    ascii_name = filename.encode("ascii", "replace").decode().replace('"', "").replace("?", "_") or "file"
    return f"{kind}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def serve(doc: Document, download: bool = False):
    disposition = "attachment" if download else "inline"
    if doc.storage_backend == "blob":  # public store: unguessable URL
        return RedirectResponse(doc.storage_key + ("?download=1" if download else ""), status_code=307)
    if doc.storage_backend == "blobpriv":  # private store: stream through after our permission check
        try:
            data = storage.read_private(doc.storage_key)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File missing from storage.")
        return Response(
            content=data,
            media_type=doc.content_type,
            headers={"Content-Disposition": content_disposition(disposition, doc.name), "Cache-Control": "private, max-age=300"},
        )
    path = storage.local_path(doc.storage_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing from storage.")
    return FileResponse(
        path,
        media_type=doc.content_type,
        filename=doc.name,
        content_disposition_type=disposition,
    )


def owner_in_scope(ctx: Ctx, owner_type: str, owner_id: uuid.UUID) -> bool:
    """Whether a property-scoped member may see records attached to this owner."""
    if ctx.scope is None:
        return True
    if owner_type == "organization":
        return False  # org-wide documents are for full-access members
    if owner_type == "tenant":
        return tenant_in_scope(ctx, owner_id)
    model = OWNER_MODELS.get(owner_type)
    obj = ctx.session.get(model, owner_id) if model else None
    return bool(obj) and ctx.can_see_property(property_id_of(ctx.session, obj))


def doc_in_scope(ctx: Ctx, doc: Document) -> bool:
    return owner_in_scope(ctx, doc.owner_type, doc.owner_id)


def tenant_can_view(session: Session, user: User, doc: Document) -> bool:
    if not doc.visible_to_tenant:
        return False
    tenants = session.exec(select(Tenant).where(Tenant.user_id == user.id, Tenant.org_id == doc.org_id)).all()
    tenant_ids = {t.id for t in tenants}
    if not tenant_ids:
        return False
    if doc.owner_type == "tenant":
        return doc.owner_id in tenant_ids
    lease_ids = {
        lt.lease_id for lt in session.exec(select(LeaseTenant).where(LeaseTenant.tenant_id.in_(tenant_ids))).all()
    }
    if doc.owner_type == "lease":
        return doc.owner_id in lease_ids
    if doc.owner_type == "unit":
        units = {l.unit_id for l in session.exec(select(Lease).where(Lease.id.in_(lease_ids))).all()} if lease_ids else set()
        return doc.owner_id in units
    if doc.owner_type == "work_order":
        wo = session.get(WorkOrder, doc.owner_id)
        return bool(wo and wo.tenant_id in tenant_ids)
    return False


def _with_owner_label(session: Session, docs: list[Document]) -> list[dict]:
    out = []
    cache: dict[tuple, str] = {}
    for d in docs:
        key = (d.owner_type, d.owner_id)
        if key not in cache:
            label = d.owner_type.replace("_", " ").title()
            model = OWNER_MODELS.get(d.owner_type)
            obj = session.get(model, d.owner_id) if model else None
            if isinstance(obj, (Property, Organization)):
                label = obj.name
            elif isinstance(obj, Unit):
                prop = session.get(Property, obj.property_id)
                label = f"{prop.name} — {obj.name}" if prop else obj.name
            elif isinstance(obj, Tenant):
                label = f"{obj.first_name} {obj.last_name}"
            elif isinstance(obj, Lease):
                unit = session.get(Unit, obj.unit_id)
                label = f"Lease — {unit.name if unit else ''} ({obj.start_date})"
            elif isinstance(obj, WorkOrder):
                label = f"Work order #{obj.number}"
            elif isinstance(obj, Expense):
                label = f"Expense {obj.expense_date}"
            cache[key] = label
        out.append({**d.model_dump(exclude={"storage_key"}), "owner_label": cache[key]})
    return out


@router.get("")
def list_documents(
    owner_type: str | None = None,
    owner_id: uuid.UUID | None = None,
    kind: str | None = None,
    expiring_within_days: int | None = None,
    ctx: Ctx = Depends(staff),
):
    q = select(Document).where(Document.org_id == ctx.org_id)
    if owner_type:
        q = q.where(Document.owner_type == owner_type)
    if owner_id:
        q = q.where(Document.owner_id == owner_id)
    if kind:
        q = q.where(Document.kind == kind)
    if expiring_within_days is not None:
        q = q.where(Document.expires_on.is_not(None), Document.expires_on <= today_in(ctx.org.timezone) + timedelta(days=expiring_within_days))
    docs = ctx.session.exec(q.order_by(Document.created_at.desc()).limit(1000)).all()
    if ctx.scope is not None:
        docs = [d for d in docs if doc_in_scope(ctx, d)]
    return _with_owner_label(ctx.session, list(docs))


@router.post("", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    owner_type: str = Form(...),
    owner_id: uuid.UUID = Form(...),
    kind: str = Form("other"),
    expires_on: date | None = Form(None),
    visible_to_tenant: bool = Form(False),
    ctx: Ctx = Depends(staff),
):
    if ctx.role == "accountant":
        raise HTTPException(status_code=403, detail="You don't have permission to do that.")
    if ctx.role == "maintenance" and owner_type != "work_order":
        raise HTTPException(status_code=403, detail="Maintenance staff can only attach files to work orders.")
    check_owner(ctx.session, ctx.org_id, owner_type, owner_id)
    if ctx.scope is not None and not owner_in_scope(ctx, owner_type, owner_id):
        raise HTTPException(status_code=404, detail="Record not found")
    doc = await store_upload(ctx.session, ctx.org_id, ctx.user.id, file, owner_type, owner_id, kind, expires_on, visible_to_tenant)
    ctx.session.flush()
    audit.log(ctx, "document", doc.id, "upload", f"Uploaded {doc.name} to {owner_type}")
    ctx.session.commit()
    ctx.session.refresh(doc)
    return _with_owner_label(ctx.session, [doc])[0]


@router.get("/{document_id}/file")
def download_document(document_id: uuid.UUID, download: bool = False, ctx: Ctx = Depends(get_ctx)):
    doc = ctx.session.get(Document, document_id)
    if not doc or doc.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if ctx.role == "tenant" and not tenant_can_view(ctx.session, ctx.user, doc):
        raise HTTPException(status_code=404, detail="Document not found")
    if ctx.role == "vendor" or (ctx.role != "tenant" and not doc_in_scope(ctx, doc)):
        raise HTTPException(status_code=404, detail="Document not found")
    return serve(doc, download)


@router.patch("/{document_id}")
def update_document(document_id: uuid.UUID, payload: DocumentUpdate, ctx: Ctx = Depends(writer)):
    doc = ctx.session.get(Document, document_id)
    if not doc or doc.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Document not found")
    data = payload.model_dump(exclude_unset=True)
    if data.pop("clear_expiry", False):
        doc.expires_on = None
        data.pop("expires_on", None)
    for k, v in data.items():
        if v is not None:
            setattr(doc, k, v)
    doc.updated_at = utcnow()
    ctx.session.add(doc)
    audit.log(ctx, "document", doc.id, "update", f"Updated {doc.name}")
    ctx.session.commit()
    return _with_owner_label(ctx.session, [doc])[0]


@router.delete("/{document_id}")
def delete_document(document_id: uuid.UUID, ctx: Ctx = Depends(writer)):
    doc = ctx.session.get(Document, document_id)
    if not doc or doc.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Document not found")
    for prop in ctx.session.exec(select(Property).where(Property.cover_photo_id == doc.id)).all():
        prop.cover_photo_id = None
        ctx.session.add(prop)
    for exp in ctx.session.exec(select(Expense).where(Expense.receipt_document_id == doc.id)).all():
        exp.receipt_document_id = None
        ctx.session.add(exp)
    ctx.session.delete(doc)
    audit.log(ctx, "document", doc.id, "delete", f"Deleted {doc.name}")
    ctx.session.commit()
    storage.delete(doc.storage_key, doc.storage_backend)
    return {"ok": True}
