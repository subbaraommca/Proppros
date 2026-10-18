"""Vacancy marketing kit: ready-to-post ad text and a printable flyer for a published listing.

Text comes from deterministic templates over the listing's own fields (no AI, no external calls).
The templates are written to be fair-housing safe: they describe the property, never the people.
The landlord's own description is passed through as written, so we also flag risky phrases in it.
"""
import io
import re
from datetime import date

import segno
from PIL import Image

from app.core import storage
from app.models import Document, Listing, Organization, Property, Unit
from app.services.leasing import DocPDF, latin1

FAIR_HOUSING_NOTE = "Describe the home, not the people you want. Follow fair housing laws."

# Phrases that describe people rather than the home (HUD advertising guidance). Used to warn the
# landlord about their own description; our templates never contain any of them.
RISKY_PHRASES = (
    "adults only", "adult only", "no kids", "no children", "no families", "family", "families", "children", "kids",
    "couple", "couples", "single", "singles", "bachelor", "mature", "seniors", "senior", "elderly", "young", "retirees",
    "students", "professionals", "christian", "church", "muslim", "jewish", "catholic", "english only", "english speaking",
    "american", "immigrant", "handicap", "disabled", "able-bodied", "no wheelchairs", "perfect for", "ideal for",
    "no section 8", "male", "female", "man", "woman", "gentleman", "lady", "exclusive",
)
_RISKY = re.compile(r"\b(" + "|".join(re.escape(p) for p in sorted(RISKY_PHRASES, key=len, reverse=True)) + r")\b", re.I)

_KIND = {"single_family": "house", "multi_family": "apartment", "condo": "condo", "townhouse": "townhouse"}


def fair_housing_flags(*texts: str | None) -> list[str]:
    """Risky phrases found in landlord-written text, lower-cased and de-duplicated, in order of appearance."""
    found: list[str] = []
    for text in texts:
        for m in _RISKY.finditer(text or ""):
            p = m.group(1).lower()
            if p not in found:
                found.append(p)
    return found


def _price(cents: int, currency: str) -> str:
    symbol = "$" if currency == "USD" else f"{currency} "
    amount = f"{cents / 100:,.2f}"
    return symbol + (amount[:-3] if amount.endswith(".00") else amount)


def _num(x: float) -> str:
    return f"{x:g}"


def _long(d: date) -> str:
    return d.strftime("%B %d, %Y").replace(" 0", " ")


class Facts:
    """The listing's facts in words, shared by the text templates and the flyer."""

    def __init__(self, listing: Listing, prop: Property, unit: Unit, org: Organization, today: date):
        cur = org.currency
        self.title = listing.title
        self.rent = _price(listing.rent_cents, cur)
        self.deposit = _price(listing.deposit_cents, cur) if listing.deposit_cents else ""
        self.kind = _KIND.get(prop.property_type, "home")
        if self.kind == "house" and unit.name.lower() not in ("main", "house", "home"):
            self.kind = "home"
        n_beds, n_baths = listing.beds, listing.baths
        self.beds_long = "Studio" if n_beds == 0 else (f"{_num(n_beds)} bedroom{'' if n_beds == 1 else 's'}" if n_beds is not None else "")
        self.baths_long = f"{_num(n_baths)} bathroom{'' if n_baths == 1 else 's'}" if n_baths is not None else ""
        self.beds = "Studio" if listing.beds == 0 else (f"{_num(listing.beds)} bed" if listing.beds is not None else "")
        self.baths = f"{_num(listing.baths)} bath" if listing.baths is not None else ""
        self.size = f"{listing.sqft:,} sq ft" if listing.sqft else ""
        self.available = "now" if not listing.available_on or listing.available_on <= today else _long(listing.available_on)
        self.lease_term = f"{listing.lease_term_months} months" if listing.lease_term_months else ""
        self.pets = (listing.pet_policy or "").strip()
        self.utilities = (listing.utilities_included or "").strip()
        self.amenities = [a for a in (listing.amenities or []) if a][:8]
        self.city = prop.city
        self.area = f"{prop.city}, {prop.state}"
        street = prop.address_line1 + (f", {unit.name}" if unit.name.lower() not in ("main", "house", "home") else "")
        self.address = f"{street}, {prop.city}, {prop.state} {prop.postal_code}"
        self.description = (listing.description or "").strip()
        self.contact = " · ".join(x for x in (org.name, listing.contact_email, listing.contact_phone) if x)

    @property
    def specs(self) -> str:
        """'3 bed, 2 bath' (or just one of them)."""
        return ", ".join(x for x in (self.beds, self.baths) if x)


def _hashtag(text: str) -> str:
    return "#" + "".join(w.capitalize() for w in re.findall(r"[A-Za-z0-9]+", text))


def listing_site_title(f: Facts) -> str:
    specs = f"{f.specs} {f.kind}".strip() if f.specs else f.kind.capitalize()
    for cand in (
        f"{specs} for rent in {f.area} - {f.rent}/mo",
        f"{specs} for rent in {f.city} - {f.rent}/mo",
        f"{specs} for rent - {f.rent}/mo",
        f"{f.title} - {f.rent}/mo",
    ):
        if len(cand) <= 70:
            return cand
    return cand[:67].rsplit(" ", 1)[0] + "..."


def marketing_texts(f: Facts, share_url: str) -> dict:
    size_bits = [x for x in (f.beds_long, f.baths_long, f.size) if x]
    lines = [f.title, "", f"Rent: {f.rent}/month" + (f" · Deposit: {f.deposit}" if f.deposit else "")]
    if size_bits:
        lines.append(" · ".join(size_bits))
    lines.append(f"Available: {f.available}")
    if f.lease_term:
        lines.append(f"Lease term: {f.lease_term}")
    lines.append(f"Location: {f.address}")
    if f.pets:
        lines.append(f"Pets: {f.pets}")
    if f.utilities:
        lines.append(f"Utilities included: {f.utilities}")
    if f.amenities:
        lines.append(f"Features: {', '.join(f.amenities)}")
    if f.description:
        lines += ["", f.description]
    lines += ["", f"See all photos and apply online: {share_url}", f"Contact: {f.contact}", "", "Equal Housing Opportunity."]
    body = "\n".join(lines)

    facts = " · ".join(x for x in (f.specs, f.size) if x)
    tags = " ".join(dict.fromkeys(["#ForRent", _hashtag(f"{f.city} Rentals"), _hashtag(f"{f.kind} for rent"), _hashtag(f"{f.city} Real Estate")]))
    avail = "Available now" if f.available == "now" else f"Available {f.available}"
    social = f"For rent in {f.area}: {f.title}\n{f.rent}/mo" + (f" · {facts}" if facts else "") + f"\n{avail}. See photos and apply online: {share_url}\n\n{tags}"

    what = f"{f.specs} {f.kind}".strip() if f.specs else f.kind
    when = "available now" if f.available == "now" else f"available {f.available}"
    message = (
        f"Hi! I have a {what} for rent in {f.area}: {f.title}. "
        f"Rent is {f.rent}/month" + (f" with a {f.deposit} deposit" if f.deposit else "") + f", {when}. "
        f"You can see the photos and apply online here: {share_url}\n"
        "Please feel free to pass this along to anyone looking for a place."
    )
    return {"listing_site": {"title": listing_site_title(f), "body": body}, "social": social, "message": message}


# ── Flyer ────────────────────────────────────────────────────────────────────


def photo_bytes(doc: Document) -> bytes | None:
    """The stored photo's bytes, or None if it can't be read (missing file, network error...)."""
    try:
        if doc.storage_backend == "blobpriv":
            return storage.read_private(doc.storage_key)
        if doc.storage_backend == "blob":
            import httpx

            r = httpx.get(doc.storage_key, timeout=10)
            r.raise_for_status()
            return r.content
        return storage.local_path(doc.storage_key).read_bytes()
    except Exception:  # noqa: BLE001 — the flyer is still useful without a photo
        return None


def _image(data: bytes | None) -> Image.Image | None:
    if not data:
        return None
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        return img
    except Exception:  # noqa: BLE001 — not a decodable image
        return None


class FlyerPDF(DocPDF):
    def footer(self):
        self.set_y(-16)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(15, 23, 42)
        self.cell(0, 5, "Equal Housing Opportunity", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 7)
        self.set_text_color(100, 116, 139)
        self.cell(0, 4, "We do not discriminate on the basis of race, color, religion, sex, disability, familial status or national origin.", align="C")


def flyer_pdf(f: Facts, org: Organization, share_url: str, photo: bytes | None) -> bytes:
    pdf = FlyerPDF(org.name)
    pdf.set_auto_page_break(False)
    pdf.add_page()
    left, width = pdf.l_margin, pdf.width
    accent = (164, 80, 42)  # Strata carnelian (light theme)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*accent)
    pdf.cell(0, 6, "FOR RENT", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "B", 22)
    title = f.title if len(f.title) <= 90 else f.title[:87] + "..."
    pdf.multi_cell(0, 10, latin1(title), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*accent)
    pdf.cell(0, 13, latin1(f"{f.rent} / month"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(15, 23, 42)
    pdf.ln(2)

    img = _image(photo)
    if img:
        max_h = 80.0
        w, h = width, width * img.height / img.width
        if h > max_h:
            h, w = max_h, max_h * img.width / img.height
        pdf.image(img, x=left + (width - w) / 2, y=pdf.get_y(), w=w, h=h)
        pdf.set_y(pdf.get_y() + h + 5)

    # Key facts (left) and QR code (right).
    top = pdf.get_y()
    qr_size = 46.0
    qr_x = pdf.w - pdf.r_margin - qr_size
    facts_w = qr_x - left - 6
    rows = [
        ("Rent", f"{f.rent} per month"),
        ("Deposit", f.deposit),
        ("Bedrooms", f.beds_long),
        ("Bathrooms", f.baths_long),
        ("Size", f.size),
        ("Available", f.available.capitalize() if f.available == "now" else f.available),
        ("Lease term", f.lease_term),
        ("Pets", f.pets[:120]),
        ("Utilities", f.utilities[:120]),
        ("Address", f.address),
    ]
    for label, value in rows:
        if not value:
            continue
        pdf.set_x(left)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(28, 6, latin1(label))
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(facts_w - 28, 6, latin1(value), new_x="LMARGIN", new_y="NEXT")
    facts_end = pdf.get_y()

    qr = segno.make(share_url, error="m")
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=10, border=2)
    buf.seek(0)
    pdf.image(buf, x=qr_x, y=top, w=qr_size, h=qr_size)
    pdf.set_xy(qr_x - 4, top + qr_size + 1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.multi_cell(qr_size + 8, 4.5, "Scan to see photos and apply online", align="C")
    pdf.set_y(max(facts_end, pdf.get_y()) + 4)

    # Description, cut to the space left above the contact block and footer.
    bottom = pdf.h - 22 - 24
    if f.description and pdf.get_y() < bottom - 10:
        lines = int((bottom - pdf.get_y()) / 5)
        budget = max(lines * 95 - 10, 0)
        text = f.description if len(f.description) <= budget else f.description[:budget].rsplit(" ", 1)[0] + "..."
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(0, 5, latin1(text), new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(15, 23, 42)

    # Contact and link, pinned above the footer.
    pdf.set_y(pdf.h - 22 - 20)
    pdf.set_draw_color(203, 213, 225)
    pdf.line(left, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, latin1(f"Contact: {f.contact}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*accent)
    pdf.cell(0, 6, latin1(f"Apply online: {share_url}"), link=share_url, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(15, 23, 42)
    return bytes(pdf.output())

