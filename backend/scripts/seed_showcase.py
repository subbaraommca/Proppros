"""Seed a FICTIONAL showcase database for marketing screenshots.

Every person, email, phone number and address below is invented (example.com
emails, 555-01xx phone numbers, made-up streets). Data is created through the
real API with FastAPI's TestClient, so it matches what the app would store.

Usage (from backend/):
    DATABASE_URL=sqlite:///./showcase.db ../.venv/Scripts/python scripts/seed_showcase.py

The script deletes and recreates showcase.db and the ./.showcase-uploads folder
each run. It refuses to touch proppros.db or any non-SQLite database.

Run the API against it with the same isolation settings, e.g.:
    DATABASE_URL=sqlite:///./showcase.db LOCAL_UPLOAD_DIR=./.showcase-uploads \
    RESEND_API_KEY= SMTP_HOST= BLOB_READ_WRITE_TOKEN= BLOB_STORE_ID= TWILIO_ACCOUNT_SID= \
    PUSH_ENABLED=false STRIPE_SECRET_KEY= UPSTASH_REDIS_REST_URL= SENTRY_DSN= DATABASE_URL_UNPOOLED= \
    ../.venv/Scripts/python -m uvicorn app.main:app --port 8001
"""
import io
import os
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path

# ── Safety: only a dedicated SQLite showcase file ────────────────────────────
URL = os.environ.get("DATABASE_URL", "")
if not URL.startswith("sqlite:///") or "proppros.db" in URL.lower() or "showcase" not in URL.lower():
    sys.exit(f"Refusing to run: DATABASE_URL must be a sqlite showcase file (got {URL!r}).")
DB_PATH = Path(URL.removeprefix("sqlite:///")).resolve()
if DB_PATH.name.lower() == "proppros.db":
    sys.exit("Refusing to run against proppros.db.")
UPLOADS = Path("./.showcase-uploads").resolve()
URL = f"sqlite:///{DB_PATH.as_posix()}"

# Isolation: nothing is sent anywhere, files stay on local disk. These override backend/.env.
os.environ.update(
    {
        "ENVIRONMENT": "development",
        "JWT_SECRET": os.environ.get("JWT_SECRET") or "showcase-only-secret-key-not-for-production-0001",
        "DATABASE_URL_UNPOOLED": "",
        "RESEND_API_KEY": "",
        "SMTP_HOST": "",
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
        "BLOB_READ_WRITE_TOKEN": "",
        "BLOB_STORE_ID": "",
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "PUSH_ENABLED": "false",
        "STRIPE_SECRET_KEY": "",
        "UPSTASH_REDIS_REST_URL": "",
        "UPSTASH_REDIS_REST_TOKEN": "",
        "SENTRY_DSN": "",
        "LOCAL_UPLOAD_DIR": str(UPLOADS),
        "DATABASE_URL": URL,
    }
)
for k in ("POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "VERCEL"):
    os.environ.pop(k, None)

if DB_PATH.exists():
    DB_PATH.unlink()
shutil.rmtree(UPLOADS, ignore_errors=True)
UPLOADS.mkdir(parents=True)
# Settings read ./.env; on Windows an empty env var can't override it, so run from a folder without one.
BACKEND = Path(__file__).resolve().parents[1]
os.chdir(UPLOADS)

sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.main import app  # noqa: E402

from app.core import storage  # noqa: E402

assert settings.database_url == URL, settings.database_url
assert not settings.email_enabled and not settings.sms_enabled and not storage.blob_enabled() and not settings.stripe_enabled
assert not settings.sentry_dsn and not settings.upstash_redis_rest_url
SQLModel.metadata.create_all(engine)

PASSWORD = "Showcase123!"
TODAY = date.today()
HISTORY = 9  # months of rent, payments and expenses before this one
CITY, STATE, ZIP = "Springfield", "IL", "62704"


def ok(r, code=(200, 201)):
    codes = code if isinstance(code, tuple) else (code,)
    if r.status_code not in codes:
        raise SystemExit(f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text[:400]}")
    return r.json()


def month_start(offset: int) -> date:
    """First day of the month `offset` months before this one."""
    y, m = TODAY.year, TODAY.month - offset
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def on(offset: int, day: int) -> str:
    return month_start(offset).replace(day=day).isoformat()


# ── Owner ────────────────────────────────────────────────────────────────────
owner = TestClient(app)
me = ok(owner.post("/api/auth/register", json={"name": "Jordan Avery", "email": "showcase@example.com", "password": PASSWORD, "organization_name": "Maple Row Rentals"}))
owner.headers["X-Org-Id"] = me["organizations"][0]["id"]
ok(owner.patch("/api/auth/me", json={"phone": "(217) 555-0100"}), (200, 422))


def prop(name, ptype, street, price, bought):
    return ok(owner.post("/api/properties", json={"name": name, "property_type": ptype, "address_line1": street, "city": CITY, "state": STATE, "postal_code": ZIP, "purchase_price_cents": price, "purchase_date": bought}))


def unit(pid, name, beds, baths, sqft, rent, amenities=()):
    return ok(owner.post(f"/api/properties/{pid}/units", json={"name": name, "beds": beds, "baths": baths, "sqft": sqft, "market_rent_cents": rent, "amenities": list(amenities)}))


maple = prop("Maple Court", "multi_family", "214 Alder Lane", 61500000, "2019-04-12")
birch = prop("Birchwood Duplex", "multi_family", "88 Quillfeather Road", 38900000, "2021-08-30")
juniper = prop("Juniper Cottage", "single_family", "5 Wrenfield Way", 32400000, "2022-06-03")

u = {
    "1A": unit(maple["id"], "Unit 1A", 2, 1, 880, 125000, ["Laundry in building", "Off-street parking"]),
    "1B": unit(maple["id"], "Unit 1B", 1, 1, 640, 105000, ["Laundry in building"]),
    "2A": unit(maple["id"], "Unit 2A", 0, 1, 480, 95000, ["Laundry in building"]),
    "2B": unit(maple["id"], "Unit 2B", 2, 1.5, 910, 129500, ["Laundry in building", "Balcony", "Dishwasher", "Off-street parking"]),
    "BA": unit(birch["id"], "Unit A", 3, 2, 1240, 145000, ["Private yard", "Garage", "Washer/dryer"]),
    "BB": unit(birch["id"], "Unit B", 2, 1, 1020, 139500, ["Washer/dryer", "Driveway parking"]),
}
# Single-family homes get a default "Main" unit on creation; fill it in instead of adding a second one.
_main = next(x for x in ok(owner.get("/api/units")) if x["property_id"] == juniper["id"])
u["JC"] = ok(owner.patch(f"/api/units/{_main['id']}", json={"beds": 3, "baths": 2, "sqft": 1480, "market_rent_cents": 185000, "amenities": ["Fenced yard", "Garage", "Fireplace"]}))

# ── Tenants & leases ─────────────────────────────────────────────────────────
TENANTS = [
    # key, first, last, email, phone
    ("1A", "Riley", "Morgan", "riley.tenant@example.com", "(217) 555-0111"),
    ("1B", "Casey", "Lindqvist", "casey.lindqvist@example.com", "(217) 555-0112"),
    ("2A", "Devon", "Hartwell", "devon.hartwell@example.com", "(217) 555-0113"),
    ("BA", "Priya", "Castellano", "priya.castellano@example.com", "(217) 555-0114"),
    ("BB", "Theo", "Bramble", "theo.bramble@example.com", "(217) 555-0115"),
    ("JC", "Noor", "Halvorsen", "noor.halvorsen@example.com", "(217) 555-0116"),
]
tenants = {}
for key, first, last, email, phone in TENANTS:
    tenants[key] = ok(owner.post("/api/tenants", json={"first_name": first, "last_name": last, "email": email, "phone": phone, "emergency_contact_name": "Alex Example", "emergency_contact_phone": "(217) 555-0199"}))

ending_soon = TODAY.toordinal() + 52
LEASES = {
    # key: start, end, rent, deposit, extra
    "1A": ("2025-06-01", "2027-05-31", 125000, 125000, {}),
    "1B": ("2025-12-10", date.fromordinal(ending_soon).isoformat(), 105000, 105000, {}),
    "2A": ("2026-02-01", "2027-01-31", 95000, 95000, {}),
    "BA": ("2025-09-01", "2026-08-31", 145000, 145000, {"recurring_charges": [{"charge_type": "pet", "description": "Pet rent (1 dog)", "amount_cents": 3500}]}),
    "BB": ("2026-03-15", "2027-03-14", 139500, 139500, {"recurring_charges": [{"charge_type": "parking", "description": "Garage space", "amount_cents": 5000}]}),
    "JC": ("2024-08-01", "2027-07-31", 185000, 185000, {}),
}
# Birchwood A rolled to month-to-month: no end date.
LEASES["BA"] = ("2025-09-01", None, 145000, 145000, LEASES["BA"][4])
charges_from = month_start(HISTORY).isoformat()
leases = {}
for key, (start, end, rent, dep, extra) in LEASES.items():
    body = {"unit_id": u[key]["id"], "tenant_ids": [tenants[key]["id"]], "start_date": start, "end_date": end, "rent_cents": rent, "deposit_cents": dep, "due_day": 1, "grace_days": 5, "late_fee_type": "flat", "late_fee_amount": 5000, "charges_start_on": max(start, charges_from), **extra}
    leases[key] = ok(owner.post("/api/leases", json=body))

# ── Payments (six months; two leases carry a balance this month) ─────────────
METHODS = {"1A": "zelle", "1B": "bank_transfer", "2A": "venmo", "BA": "check", "BB": "bank_transfer", "JC": "check"}
for key, lease in leases.items():
    monthly = LEASES[key][2] + sum(c["amount_cents"] for c in LEASES[key][4].get("recurring_charges", []))
    first_month = max(date.fromisoformat(LEASES[key][0]), month_start(HISTORY))
    for offset in range(HISTORY, -1, -1):
        if month_start(offset) < first_month.replace(day=1):
            continue
        amount = monthly
        if offset == 0 and key == "2A":
            amount = 50000  # partial — $450 still due
        if offset == 0 and key == "BA":
            continue  # not paid yet this month
        day = {"1A": 2, "1B": 1, "2A": 3, "BA": 4, "BB": 1, "JC": 2}[key]
        if month_start(offset).replace(day=day) > TODAY:
            continue
        ref = f"CHK {1040 + offset}" if METHODS[key] == "check" else None
        ok(owner.post(f"/api/leases/{lease['id']}/payments", json={"amount_cents": amount, "method": METHODS[key], "received_on": on(offset, day), "reference": ref, "send_receipt": False}))

# ── Expenses ─────────────────────────────────────────────────────────────────
def expense(p, cat, cents, when, vendor, desc, unit_id=None):
    if date.fromisoformat(when) > TODAY:
        return  # no future-dated expenses
    ok(owner.post("/api/expenses", json={"property_id": p["id"], "unit_id": unit_id, "category": cat, "amount_cents": cents, "expense_date": when, "vendor": vendor, "description": desc}))


for offset in range(HISTORY, -1, -1):
    expense(maple, "utilities", 18400 + offset * 730, on(offset, 12), "Springfield Water Works (sample)", "Building water & sewer")
    expense(maple, "cleaning_maintenance", 9500, on(offset, 20), "Tidy Hall Cleaning", "Common-area cleaning")
    if offset % 2 == 0:
        expense(juniper, "cleaning_maintenance", 12000, on(offset, 15), "Greenleaf Yard Care", "Lawn & yard service")
expense(maple, "insurance", 118000, on(4, 5), "Harborline Mutual (sample)", "Quarterly landlord policy")
expense(birch, "insurance", 64000, on(4, 5), "Harborline Mutual (sample)", "Quarterly landlord policy")
expense(maple, "insurance", 118000, on(1, 5), "Harborline Mutual (sample)", "Quarterly landlord policy")
expense(birch, "insurance", 64000, on(1, 5), "Harborline Mutual (sample)", "Quarterly landlord policy")
expense(juniper, "taxes", 212500, on(3, 28), "County Treasurer", "Property tax — 2nd installment")
expense(birch, "repairs", 34500, on(3, 9), "Brightline Plumbing Co.", "Water heater valve replacement", u["BB"]["id"])
expense(maple, "supplies", 6850, on(2, 17), "Hardware store", "Smoke detector batteries & bulbs")
expense(maple, "advertising", 2900, on(0, 6), "Listing boost", "Unit 2B vacancy ad")
expense(juniper, "capital_improvement", 365000, on(2, 22), "Northgate Roofing", "Partial roof replacement")

# ── Vendor, work orders, schedule ────────────────────────────────────────────
vendor = ok(owner.post("/api/vendors", json={"name": "Brightline Plumbing Co.", "contact_name": "Pat Rowan", "email": "brightline.plumbing@example.com", "phone": "(217) 555-0142", "address": "300 Copperleaf Ave, Springfield", "trades": ["plumbing", "hvac"], "hourly_rate_cents": 9500, "call_out_fee_cents": 7500, "license_number": "PL-0000-SAMPLE", "w9_on_file": True, "insurance_expires_on": f"{TODAY.year + 1}-03-31"}))
ok(owner.post("/api/vendors", json={"name": "Northgate Roofing", "contact_name": "Sam Whitlow", "email": "northgate.roofing@example.com", "phone": "(217) 555-0143", "trades": ["roof"], "w9_on_file": True}))


def wo(p, unit_key, title, desc, cat, prio, enter=True):
    return ok(owner.post("/api/work-orders", json={"property_id": p["id"], "unit_id": u[unit_key]["id"] if unit_key else None, "title": title, "description": desc, "category": cat, "priority": prio, "permission_to_enter": enter}))


w1 = wo(maple, "2A", "Kitchen faucet dripping", "Tenant reports a steady drip from the kitchen faucet, worse with hot water.", "plumbing", "medium")
ok(owner.put(f"/api/work-orders/{w1['id']}/vendor", json={"vendor_id": vendor["id"], "email_vendor": False}))
ok(owner.patch(f"/api/work-orders/{w1['id']}", json={"status": "in_progress"}))
ok(owner.post(f"/api/work-orders/{w1['id']}/comments", json={"body": "Pat from Brightline is replacing the cartridge; parts on hand.", "is_internal": False}))
ok(owner.post(f"/api/work-orders/{w1['id']}/quotes", json={"vendor_id": vendor["id"], "amount_cents": 16500, "description": "Replace faucet cartridge and supply lines"}))

w2 = wo(birch, "BA", "Dishwasher not draining", "Standing water after each cycle. Filter was cleaned, no change.", "appliance", "high")
sched_at = datetime.combine(date.fromordinal(TODAY.toordinal() + 2), datetime.min.time()).replace(hour=14, tzinfo=timezone.utc).isoformat()
ok(owner.patch(f"/api/work-orders/{w2['id']}", json={"status": "scheduled", "scheduled_for": sched_at}))

wo(juniper, "JC", "Clean gutters before winter", "Leaves building up on the north side gutters.", "roof", "low", enter=False)

w4 = wo(maple, "1A", "Bathroom exhaust fan noisy", "Fan rattles loudly when switched on.", "electrical", "low")
ok(owner.post(f"/api/work-orders/{w4['id']}/complete-with-expense", json={"amount_cents": 18500, "category": "repairs", "vendor": "Volt & Vine Electric", "expense_date": on(1, 18)}))

w5 = wo(birch, "BB", "Replace HVAC filter", "Seasonal filter change.", "hvac", "low")
ok(owner.patch(f"/api/work-orders/{w5['id']}", json={"status": "completed"}))
ok(owner.patch(f"/api/work-orders/{w5['id']}", json={"status": "closed"}))

ok(owner.post("/api/maintenance-schedules", json={"property_id": maple["id"], "title": "Furnace tune-up", "description": "Annual boiler/furnace service before heating season.", "category": "hvac", "priority": "medium", "interval_months": 12, "next_due_on": date.fromordinal(TODAY.toordinal() + 28).isoformat(), "lead_days": 14, "vendor_id": vendor["id"]}))
ok(owner.post("/api/maintenance-schedules", json={"property_id": birch["id"], "title": "Test smoke & CO detectors", "category": "general", "interval_months": 6, "next_due_on": date.fromordinal(TODAY.toordinal() + 45).isoformat()}))

# ── Vacancy listing with illustrated photos and one application ──────────────
def illustration(seed: int) -> bytes:
    """Flat abstract house on a gradient (no real photos)."""
    w, h = 1600, 1066
    palettes = [((233, 196, 154), (120, 160, 190), (64, 92, 120), (196, 98, 72)), ((200, 222, 205), (86, 140, 120), (40, 72, 66), (226, 178, 92)), ((240, 214, 200), (160, 128, 170), (70, 60, 96), (90, 150, 160))]
    top, bottom, body, roof = palettes[seed % 3]
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    d.ellipse([w * 0.72, h * 0.10, w * 0.86, h * 0.31], fill=(250, 238, 210))
    d.rectangle([0, h * 0.78, w, h], fill=tuple(max(0, c - 40) for c in bottom))
    x0, x1, yb, yt = w * (0.28 + 0.04 * seed), w * (0.66 + 0.04 * seed), h * 0.80, h * 0.44
    d.rectangle([x0, yt, x1, yb], fill=body)
    d.polygon([(x0 - 50, yt), ((x0 + x1) / 2, h * 0.20), (x1 + 50, yt)], fill=roof)
    d.rectangle([(x0 + x1) / 2 - 55, yb - 190, (x0 + x1) / 2 + 55, yb], fill=roof)
    for wx in (x0 + 60, x1 - 180):
        d.rectangle([wx, yt + 70, wx + 120, yt + 190], fill=(250, 232, 180))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


listing = ok(owner.post("/api/listings", json={"unit_id": u["2B"]["id"], "title": "Sunny 2-bed with balcony at Maple Court"}))
ok(owner.patch(f"/api/listings/{listing['id']}", json={
    "description": "Bright second-floor two-bedroom with a private balcony, updated kitchen with dishwasher, and plenty of closet space. Quiet, well-kept building with on-site laundry and off-street parking. Close to parks, cafes and the bus line.",
    "rent_cents": 129500,
    "deposit_cents": 129500,
    "available_on": date.fromordinal(TODAY.toordinal() + 14).isoformat(),
    "lease_term_months": 12,
    "pet_policy": "Cats and small dogs welcome with a $35/month pet rent.",
    "utilities_included": "Water, sewer and trash",
    "application_fee_cents": 0,
    "contact_email": "showcase@example.com",
    "contact_phone": "(217) 555-0100",
}))
for i, label in enumerate(["exterior", "street-view", "garden"]):
    ok(owner.post("/api/documents", data={"owner_type": "listing", "owner_id": listing["id"], "kind": "photo"}, files={"file": (f"maple-court-{label}.png", illustration(i), "image/png")}))
listing = ok(owner.post(f"/api/listings/{listing['id']}/publish"))
public = TestClient(app)
ok(public.post(f"/api/public/listings/{listing['slug']}/apply", json={
    "first_name": "Jamie", "last_name": "Solberg", "email": "jamie.applicant@example.com", "phone": "(217) 555-0177",
    "desired_move_in": date.fromordinal(TODAY.toordinal() + 21).isoformat(), "current_address": "41 Thistle Row, Springfield, IL",
    "current_rent_cents": 115000, "years_at_address": 3, "employer": "Lakeside Community Library", "job_title": "Program coordinator",
    "monthly_income_cents": 520000, "occupants": 1, "pets": "One cat", "message": "I love the balcony and the location near the park!",
    "signature_name": "Jamie Solberg", "consent": True,
}))
ok(public.post(f"/api/public/listings/{listing['slug']}/apply", json={
    "first_name": "Marlo", "last_name": "Fenwick", "email": "marlo.applicant@example.com", "phone": "(217) 555-0178",
    "current_address": "9 Bellflower Court, Springfield, IL", "employer": "Riverbend Bakery", "job_title": "Head baker",
    "monthly_income_cents": 465000, "occupants": 2, "signature_name": "Marlo Fenwick", "consent": True,
}))

# ── Tenant portal for Riley ──────────────────────────────────────────────────
inv = ok(owner.post(f"/api/tenants/{tenants['1A']['id']}/invite"))
token = inv["invite_url"].split("token=")[1].split("&")[0]
riley = TestClient(app)
ok(riley.post("/api/auth/invitations/accept", json={"token": token, "name": "Riley Morgan", "password": PASSWORD}))
riley.headers["X-Org-Id"] = me["organizations"][0]["id"]

# ── Messages & announcement ──────────────────────────────────────────────────
t1 = ok(owner.post("/api/messages/threads", json={"tenant_id": tenants["1A"]["id"], "subject": "Furnace tune-up next month", "body": "Hi Riley, Brightline Plumbing will service the building furnace in the next few weeks. We'll confirm the exact day once it's booked."}))
ok(riley.post(f"/api/portal/messages/{t1['id']}", json={"body": "Thanks for the heads-up! Mornings work best for me if they need to get into the unit."}))
ok(owner.post(f"/api/messages/threads/{t1['id']}", json={"body": "Noted, we'll ask for a morning slot and send a reminder the day before."}))
ok(riley.post("/api/portal/messages", json={"subject": "Bike storage", "body": "Is there room in the basement to keep a bike over the winter?"}))
t3 = ok(owner.post("/api/messages/threads", json={"tenant_id": tenants["BA"]["id"], "subject": "October rent reminder", "body": "Hi Priya, just a friendly reminder that this month's rent and pet rent are still open. Let me know if you need anything."}))
ok(owner.post("/api/announcements", json={"property_id": maple["id"], "title": "Water shut-off Thursday 9-11 am", "body": "The city is replacing a valve on Alder Lane. Water will be off for about two hours Thursday morning. Thanks for your patience!", "send_email": False, "send_sms": False}))

# ── Summary ──────────────────────────────────────────────────────────────────
dash = ok(owner.get("/api/dashboard"))
print("Seeded", DB_PATH)
print("Owner: showcase@example.com /", PASSWORD, "| Tenant: riley.tenant@example.com /", PASSWORD)
print("Listing slug:", listing["slug"])
print("Lease ids:", {k: v["id"] for k, v in leases.items()})
print("Dashboard keys:", list(dash)[:20])
