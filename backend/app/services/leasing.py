"""Leasing workflows: lease templates (merge fields), signed-document PDFs, inspections and deposit letters.

PDFs use fpdf2 core fonts (Latin-1), like payment receipts. Generation is synchronous: these documents
are a few pages, well inside a serverless request.
"""
import base64
import hashlib
import io
import re
import uuid
from datetime import date, datetime

from fastapi import HTTPException
from fpdf import FPDF
from sqlmodel import Session, select

from app.core import storage
from app.models import Document, Lease, LeaseTenant, Organization, Property, RecurringCharge, Signer, SignatureRequest, Tenant, Unit
from app.services.receipts import money

# ── Merge fields ─────────────────────────────────────────────────────────────

MERGE_FIELDS: dict[str, str] = {
    "landlord_name": "Your portfolio / company name",
    "tenant_names": "All tenants on the lease, e.g. “Ana Silva and Tom Lee”",
    "property_name": "Property name",
    "property_address": "Full street address",
    "unit_name": "Unit name",
    "lease_start": "Start date",
    "lease_end": "End date (or “month-to-month”)",
    "lease_term": "“from June 1, 2026 to May 31, 2027” or “month-to-month starting …”",
    "monthly_rent": "Monthly rent",
    "rent_due_day": "Due day, e.g. “1st”",
    "security_deposit": "Security deposit",
    "late_fee": "Late fee rule in words",
    "grace_days": "Grace period in days",
    "recurring_charges": "Other monthly charges as a list",
    "total_monthly": "Rent plus other monthly charges",
    "today": "Today's date",
}

_FIELD = re.compile(r"\{\{\s*([a-zA-Z_]+)\s*\}\}")


def _long(d: date | None) -> str:
    return d.strftime("%B %d, %Y").replace(" 0", " ") if d else ""


def ordinal(n: int) -> str:
    suffix = "th" if 11 <= n % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def join_names(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def lease_tenant_rows(session: Session, lease_id: uuid.UUID) -> list[Tenant]:
    rows = session.exec(
        select(Tenant, LeaseTenant.is_primary).join(LeaseTenant, LeaseTenant.tenant_id == Tenant.id).where(LeaseTenant.lease_id == lease_id)
    ).all()
    return [t for t, _ in sorted(rows, key=lambda r: not r[1])]


def merge_values(session: Session, org: Organization, lease: Lease, today: date) -> dict[str, str]:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id)
    tenants = lease_tenant_rows(session, lease.id)
    charges = session.exec(select(RecurringCharge).where(RecurringCharge.lease_id == lease.id)).all()
    cur = org.currency
    if lease.late_fee_type == "flat":
        late = f"{money(lease.late_fee_amount, cur)} if rent is not paid within {lease.grace_days} days of the due date"
    elif lease.late_fee_type == "percent":
        late = f"{lease.late_fee_amount / 100:g}% of the monthly rent if rent is not paid within {lease.grace_days} days of the due date"
    else:
        late = "No late fee"
    address = ", ".join(x for x in [prop.address_line1, prop.address_line2, f"{prop.city}, {prop.state} {prop.postal_code}"] if x)
    return {
        "landlord_name": org.name,
        "tenant_names": join_names([f"{t.first_name} {t.last_name}" for t in tenants]) or "Tenant",
        "property_name": prop.name,
        "property_address": address,
        "unit_name": unit.name,
        "lease_start": _long(lease.start_date),
        "lease_end": _long(lease.end_date) if lease.end_date else "month-to-month",
        "lease_term": f"from {_long(lease.start_date)} to {_long(lease.end_date)}"
        if lease.end_date
        else f"month-to-month starting {_long(lease.start_date)}",
        "monthly_rent": money(lease.rent_cents, cur),
        "rent_due_day": ordinal(lease.due_day),
        "security_deposit": money(lease.deposit_cents, cur),
        "late_fee": late,
        "grace_days": str(lease.grace_days),
        "recurring_charges": "\n".join(f"- {c.description}: {money(c.amount_cents, cur)} per month" for c in charges) or "None",
        "total_monthly": money(lease.rent_cents + sum(c.amount_cents for c in charges), cur),
        "today": _long(today),
    }


def unknown_fields(body: str) -> list[str]:
    return sorted({m.group(1) for m in _FIELD.finditer(body)} - MERGE_FIELDS.keys())


def render(body: str, values: dict[str, str]) -> str:
    return _FIELD.sub(lambda m: values.get(m.group(1), m.group(0)), body)


def content_hash(title: str, body: str) -> str:
    return hashlib.sha256(f"{title}\n\n{body}".encode()).hexdigest()


STARTER_TEMPLATE = """# Residential Lease Agreement

This Residential Lease Agreement ("Lease") is made on {{today}} between **{{landlord_name}}** ("Landlord") and **{{tenant_names}}** ("Tenant").

## 1. Property
Landlord rents to Tenant the residence at **{{property_address}}** ({{property_name}}, {{unit_name}}) (the "Premises").

## 2. Term
The Lease runs {{lease_term}}.

## 3. Rent
Tenant will pay **{{monthly_rent}}** per month, due on the {{rent_due_day}} day of each month.

Other monthly charges:

{{recurring_charges}}

Total due each month: **{{total_monthly}}**.

## 4. Late fees
{{late_fee}}.

## 5. Security deposit
Tenant has paid a security deposit of **{{security_deposit}}**. Landlord will return the deposit, less any lawful deductions with an itemized statement, within the time required by law after Tenant moves out.

## 6. Use and occupancy
The Premises will be used only as a private residence by the people named in this Lease and their minor children. Guests staying longer than 14 days in a 6-month period need Landlord's written consent.

## 7. Maintenance and repairs
Tenant will keep the Premises clean and report repairs promptly through the Proppros tenant portal or in writing. Tenant pays for damage caused by Tenant or guests beyond normal wear and tear.

## 8. Entry
Landlord may enter the Premises with reasonable notice (at least 24 hours, unless state law requires more) to inspect, repair or show the Premises, or at any time in an emergency.

## 9. Pets, smoking and alterations
No pets, smoking or alterations (including painting and lock changes) without Landlord's written consent.

## 10. Moving out
At the end of the Lease, Tenant will return all keys and leave the Premises clean and in the same condition as at move-in, except normal wear and tear. A move-in and move-out inspection will be recorded.

## 11. Entire agreement
This Lease is the entire agreement between the parties. Changes must be in writing and signed by both parties. If any part of this Lease is invalid, the rest remains in effect.

---
*This starter template is a general example, not legal advice. Check your state and local requirements (for example deposit limits, notice periods and required disclosures such as lead-based paint for homes built before 1978) before using it.*
"""

# ── PDF building blocks ──────────────────────────────────────────────────────

_SMART = {"‘": "'", "’": "'", "“": '"', "”": '"', "—": "-", "–": "-", "…": "...", " ": " ", "•": "-"}


def latin1(text: str) -> str:
    for a, b in _SMART.items():
        text = text.replace(a, b)
    return text.encode("latin-1", "replace").decode("latin-1")


def _md_safe(text: str) -> str:
    # fpdf2's markdown treats "--" as underline; keep literal dashes.
    return latin1(text).replace("--", "- -")


class DocPDF(FPDF):
    def __init__(self, org_name: str, footer_note: str = ""):
        super().__init__(format="Letter")
        self.org_name = latin1(org_name)
        self.footer_note = latin1(footer_note)
        self.set_margins(22, 20, 22)
        self.set_auto_page_break(True, margin=20)
        self.alias_nb_pages()

    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(164, 80, 42)
        self.cell(0, 5, self.org_name, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(15, 23, 42)
        self.ln(3)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(100, 116, 139)
        self.cell(0, 5, f"{self.footer_note}   Page {self.page_no()} of {{nb}}".strip(), align="C")
        self.set_text_color(15, 23, 42)

    @property
    def width(self) -> float:
        return self.w - self.l_margin - self.r_margin

    def heading(self, text: str, size: float = 13):
        self.ln(2)
        self.set_font("Helvetica", "B", size)
        self.multi_cell(0, size * 0.5, latin1(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def para(self, text: str, size: float = 10, style: str = ""):
        self.set_font("Helvetica", style, size)
        self.multi_cell(0, 5, _md_safe(text), markdown=True, new_x="LMARGIN", new_y="NEXT")

    def rule(self):
        self.ln(2)
        self.set_draw_color(203, 213, 225)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)

    def kv(self, label: str, value: str, label_w: float = 50):
        self.set_font("Helvetica", "B", 9.5)
        self.cell(label_w, 6, latin1(label))
        self.set_font("Helvetica", "", 9.5)
        self.multi_cell(0, 6, latin1(value), new_x="LMARGIN", new_y="NEXT")

    def markdown_body(self, body: str):
        """Render the template subset: #/##/### headings, - bullets, --- rules, **bold**, *italic* paragraphs."""
        para: list[str] = []

        def flush():
            if para:
                self.para(" ".join(para))
                self.ln(2)
                para.clear()

        for raw in body.splitlines():
            line = raw.rstrip()
            if not line.strip():
                flush()
                continue
            if line.startswith("### "):
                flush()
                self.heading(line[4:], 11)
            elif line.startswith("## "):
                flush()
                self.heading(line[3:], 12)
            elif line.startswith("# "):
                flush()
                self.heading(line[2:], 17)
                self.ln(1)
            elif line.strip() in ("---", "***"):
                flush()
                self.rule()
            elif re.match(r"^\s*[-*] ", line):
                flush()
                self.set_font("Helvetica", "", 10)
                self.set_x(self.l_margin + 4)
                self.cell(4, 5, "-")
                self.multi_cell(0, 5, _md_safe(re.sub(r"^\s*[-*] ", "", line)), markdown=True, new_x="LMARGIN", new_y="NEXT")
            else:
                text = line.strip()
                if text.startswith("*") and text.endswith("*") and not text.startswith("**"):
                    text = "__" + text.strip("*") + "__"  # fpdf2 italics marker
                para.append(text)
        flush()


def signature_png(data_url: str | None) -> bytes | None:
    if not data_url or not data_url.startswith("data:image/png;base64,"):
        return None
    try:
        return base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except ValueError:
        return None


def _when(dt: datetime | None) -> str:
    return dt.strftime("%B %d, %Y at %H:%M UTC").replace(" 0", " ") if dt else ""


def signed_pdf(org: Organization, req: SignatureRequest, signers: list[Signer]) -> bytes:
    pdf = DocPDF(org.name, f"Document ID {req.id}")
    pdf.add_page()
    pdf.markdown_body(req.body)

    pdf.add_page()
    pdf.heading("Signatures", 14)
    for s in signers:
        if pdf.get_y() > pdf.h - 70:
            pdf.add_page()
        pdf.rule()
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, latin1(f"{s.name} ({'Landlord' if s.role == 'landlord' else 'Tenant'})"), new_x="LMARGIN", new_y="NEXT")
        png = signature_png(s.signature_image)
        if png:
            pdf.image(io.BytesIO(png), w=60, h=20)
        elif s.signature_name:
            pdf.set_font("Times", "I", 22)
            pdf.cell(0, 14, latin1(s.signature_name), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(71, 85, 105)
        if s.signed_at:
            pdf.multi_cell(
                0,
                4.5,
                latin1(f"Signed electronically as \"{s.signature_name}\" on {_when(s.signed_at)}. IP {s.ip_address or 'unknown'}."),
                new_x="LMARGIN",
                new_y="NEXT",
            )
        pdf.set_text_color(15, 23, 42)

    pdf.add_page()
    pdf.heading("Signing certificate", 14)
    pdf.kv("Document", req.title)
    pdf.kv("Document ID", str(req.id))
    pdf.kv("SHA-256 of text", req.content_hash)
    pdf.kv("Sent", _when(req.created_at))
    pdf.kv("Completed", _when(req.completed_at))
    pdf.rule()
    for s in signers:
        pdf.kv(s.name, f"{(s.email or 'no email')} - viewed {_when(s.viewed_at) or 'n/a'} - signed {_when(s.signed_at)}")
        if s.user_agent:
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(100, 116, 139)
            pdf.multi_cell(0, 4, latin1(f"Device: {s.user_agent}"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(15, 23, 42)
    pdf.ln(4)
    pdf.para(
        "Each signer agreed to sign electronically and adopted the signature shown. The SHA-256 fingerprint identifies the exact "
        "text that was signed; any change to the text produces a different fingerprint.",
        8.5,
    )
    return bytes(pdf.output())


# ── Stored generated files ───────────────────────────────────────────────────


def store_generated(
    session: Session,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None,
    lease_id: uuid.UUID,
    kind: str,
    name: str,
    data: bytes,
    visible_to_tenant: bool = True,
) -> Document:
    stored = storage.put(org_id, name, data, "application/pdf")
    doc = Document(
        org_id=org_id,
        owner_type="lease",
        owner_id=lease_id,
        kind=kind,
        name=name[:200],
        content_type="application/pdf",
        size_bytes=len(data),
        storage_backend=stored.backend,
        storage_key=stored.key,
        visible_to_tenant=visible_to_tenant,
        uploaded_by_user_id=user_id,
    )
    session.add(doc)
    session.flush()
    return doc


def read_document(doc: Document) -> bytes | None:
    try:
        if doc.storage_backend == "blobpriv":
            return storage.read_private(doc.storage_key)
        if doc.storage_backend == "blob":
            import httpx

            r = httpx.get(doc.storage_key, timeout=20)
            return r.content if r.status_code == 200 else None
        path = storage.local_path(doc.storage_key)
        return path.read_bytes() if path.exists() else None
    except Exception:  # noqa: BLE001 — a missing photo shouldn't break a report
        return None


def file_slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-")[:60] or "document"


# ── Inspections ──────────────────────────────────────────────────────────────

_AREAS = {
    "Entry & living room": ["Walls & paint", "Ceiling", "Floors", "Windows & screens", "Doors & locks", "Lights & outlets", "Smoke / CO detector"],
    "Kitchen": ["Walls & floors", "Cabinets & counters", "Sink & faucet", "Refrigerator", "Stove / oven", "Dishwasher", "Microwave"],
    "Bedroom": ["Walls & paint", "Floors", "Closet", "Windows & blinds", "Doors", "Lights & outlets"],
    "Bathroom": ["Walls & floors", "Toilet", "Sink & vanity", "Tub / shower", "Exhaust fan", "Mirror & fixtures"],
    "Systems & other": ["Heating & cooling", "Water heater", "Laundry", "Exterior & yard", "Garage / parking", "Keys & remotes"],
}


def default_items(unit: Unit) -> list[dict]:
    beds = max(1, int(unit.beds or 1))
    baths = max(1, int(round(unit.baths or 1)))
    areas: list[tuple[str, list[str]]] = [("Entry & living room", _AREAS["Entry & living room"]), ("Kitchen", _AREAS["Kitchen"])]
    areas += [(f"Bedroom {i}" if beds > 1 else "Bedroom", _AREAS["Bedroom"]) for i in range(1, beds + 1)]
    areas += [(f"Bathroom {i}" if baths > 1 else "Bathroom", _AREAS["Bathroom"]) for i in range(1, baths + 1)]
    areas.append(("Systems & other", _AREAS["Systems & other"]))
    return [new_item(area, item) for area, items in areas for item in items]


def new_item(area: str, item: str) -> dict:
    return {"id": uuid.uuid4().hex[:10], "area": area, "item": item, "condition": "", "notes": "", "photo_ids": []}


CONDITION_LABELS = {"good": "Good", "fair": "Fair", "poor": "Poor", "damaged": "Damaged", "na": "N/A", "": "Not checked"}


def inspection_pdf(session: Session, org: Organization, lease: Lease, insp, photos: dict[str, Document]) -> bytes:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id)
    title = "Move-in inspection" if insp.kind == "move_in" else "Move-out inspection"
    pdf = DocPDF(org.name, f"{title} - {prop.name} {unit.name}")
    pdf.add_page()
    pdf.heading(title, 17)
    pdf.kv("Property", f"{prop.name} - {unit.name}")
    pdf.kv("Tenants", join_names([f"{t.first_name} {t.last_name}" for t in lease_tenant_rows(session, lease.id)]))
    pdf.kv("Inspection date", _long(insp.inspected_on))
    if insp.notes:
        pdf.kv("Notes", insp.notes)
    current = None
    for it in insp.items:
        if it["area"] != current:
            current = it["area"]
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_fill_color(241, 245, 249)
            pdf.cell(0, 7, latin1(current), fill=True, new_x="LMARGIN", new_y="NEXT")
        cond = CONDITION_LABELS.get(it.get("condition") or "", it.get("condition") or "")
        pdf.set_font("Helvetica", "", 9.5)
        y = pdf.get_y()
        pdf.cell(62, 6, latin1(it["item"]))
        if it.get("condition") in ("poor", "damaged"):
            pdf.set_text_color(185, 28, 28)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.cell(24, 6, latin1(cond))
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "", 9)
        note = it.get("notes") or ""
        if it.get("photo_ids"):
            note = (note + " " if note else "") + f"[{len(it['photo_ids'])} photo{'s' if len(it['photo_ids']) != 1 else ''}]"
        pdf.multi_cell(0, 6, latin1(note), new_x="LMARGIN", new_y="NEXT")
        if pdf.get_y() < y + 6:
            pdf.set_y(y + 6)

    with_photos = [(it, pid) for it in insp.items for pid in it.get("photo_ids", []) if pid in photos]
    if with_photos:
        pdf.add_page()
        pdf.heading("Photos", 14)
        col_w, img_h, gap = (pdf.width - 6) / 2, 62, 6
        col = 0
        for it, pid in with_photos:
            data = read_document(photos[pid])
            if not data:
                continue
            if col == 0 and pdf.get_y() + img_h + 12 > pdf.h - 20:
                pdf.add_page()
            x = pdf.l_margin + col * (col_w + gap)
            y = pdf.get_y()
            try:
                pdf.image(io.BytesIO(data), x=x, y=y, w=col_w, h=img_h, keep_aspect_ratio=True)
            except Exception:  # noqa: BLE001 — unsupported image (e.g. HEIC): caption only
                pass
            pdf.set_xy(x, y + img_h + 1)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(col_w, 4, latin1(f"{it['area']} - {it['item']}"))
            if col == 1:
                pdf.set_xy(pdf.l_margin, y + img_h + 8)
            else:
                pdf.set_xy(pdf.l_margin, y)
            col = 1 - col
        if col == 1:
            pdf.ln(img_h + 8)
    pdf.ln(8)
    pdf.para("Landlord signature: ______________________________     Tenant signature: ______________________________", 9)
    return bytes(pdf.output())


# ── Deposit disposition ──────────────────────────────────────────────────────


def disposition_totals(dispo) -> dict[str, int]:
    deductions = sum(int(d.get("amount_cents") or 0) for d in dispo.deductions)
    total = deductions + dispo.balance_applied_cents
    return {"deductions_cents": deductions, "total_withheld_cents": total, "refund_cents": dispo.deposit_cents - total}


def disposition_pdf(session: Session, org: Organization, lease: Lease, dispo, today: date) -> bytes:
    unit = session.get(Unit, lease.unit_id)
    prop = session.get(Property, unit.property_id)
    tenants = lease_tenant_rows(session, lease.id)
    totals = disposition_totals(dispo)
    cur = org.currency
    pdf = DocPDF(org.name, "Security deposit statement")
    pdf.add_page()
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, latin1(_long(today)), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.multi_cell(0, 5, latin1(join_names([f"{t.first_name} {t.last_name}" for t in tenants])), new_x="LMARGIN", new_y="NEXT")
    if dispo.forwarding_address:
        pdf.multi_cell(0, 5, latin1(dispo.forwarding_address), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.heading("Itemized security deposit statement", 14)
    address = f"{prop.address_line1}, {prop.city}, {prop.state} {prop.postal_code}"
    pdf.kv("Premises", f"{address} ({unit.name})")
    pdf.kv("Lease", f"{_long(lease.start_date)} to {_long(lease.ended_on or lease.end_date) or 'present'}")
    pdf.ln(3)

    def row(label: str, cents: int, bold: bool = False):
        pdf.set_font("Helvetica", "B" if bold else "", 10)
        pdf.cell(pdf.width - 40, 7, latin1(label))
        pdf.cell(40, 7, money(cents, cur), align="R", new_x="LMARGIN", new_y="NEXT")

    row("Security deposit held", dispo.deposit_cents, True)
    pdf.rule()
    for d in dispo.deductions:
        row(f"Less: {d.get('description', '')}", -int(d.get("amount_cents") or 0))
    if dispo.balance_applied_cents:
        row("Less: unpaid rent and charges", -dispo.balance_applied_cents)
    if not dispo.deductions and not dispo.balance_applied_cents:
        pdf.para("No deductions.", 10)
    pdf.rule()
    if totals["refund_cents"] >= 0:
        row("Amount refunded to tenant", totals["refund_cents"], True)
    else:
        row("Amount still owed by tenant", -totals["refund_cents"], True)
    if dispo.notes:
        pdf.ln(4)
        pdf.para(dispo.notes, 10)
    pdf.ln(10)
    pdf.para(f"Sincerely,\n\n{org.name}", 10)
    return bytes(pdf.output())
