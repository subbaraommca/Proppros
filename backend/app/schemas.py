"""Request bodies. Responses mostly return model rows or plain dicts."""
import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Role = Literal["owner", "manager", "accountant", "maintenance", "tenant", "vendor"]
PropertyType = Literal["single_family", "multi_family", "condo", "townhouse", "commercial", "other"]
UnitStatus = Literal["vacant", "occupied", "maintenance"]
LateFeeType = Literal["none", "flat", "percent"]
ChargeType = Literal["parking", "pet", "utility", "storage", "other"]
PaymentMethod = Literal["cash", "check", "zelle", "venmo", "bank_transfer", "card", "other"]
ExpenseCategory = Literal[
    "advertising", "auto_travel", "cleaning_maintenance", "commissions", "insurance", "legal_professional",
    "management_fees", "mortgage_interest", "other_interest", "repairs", "supplies", "taxes", "utilities",
    "hoa", "capital_improvement", "other",
]
WorkOrderCategory = Literal["plumbing", "electrical", "hvac", "appliance", "pest", "roof", "landscaping", "general", "other"]
WorkOrderPriority = Literal["low", "medium", "high", "emergency"]
WorkOrderStatus = Literal["new", "assigned", "scheduled", "in_progress", "completed", "closed"]
DocumentOwnerType = Literal["organization", "property", "unit", "tenant", "lease", "expense", "work_order", "vendor", "asset", "listing", "application"]
DocumentKind = Literal["photo", "lease", "insurance", "deed", "hoa", "inspection", "receipt", "invoice", "license", "id", "notice", "w9", "quote", "warranty", "manual", "other"]




class Base(BaseModel):
    model_config = {"str_strip_whitespace": True}


# ── Auth ──────────────────────────────────────────────────────────────────────


class RegisterIn(Base):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    organization_name: str | None = Field(default=None, max_length=160)


class LoginIn(Base):
    email: EmailStr
    password: str = Field(max_length=200)


class EmailIn(Base):
    email: EmailStr


class TokenIn(Base):
    token: str = Field(min_length=10, max_length=200)


class ResetPasswordIn(TokenIn):
    password: str = Field(min_length=1, max_length=200)


class AcceptInviteIn(TokenIn):
    # Only needed when the invitee doesn't have an account yet.
    name: str | None = Field(default=None, max_length=120)
    password: str | None = Field(default=None, max_length=200)


class MfaLoginIn(Base):
    mfa_token: str = Field(min_length=10, max_length=2000)
    code: str = Field(min_length=6, max_length=20)


class MfaCodeIn(Base):
    code: str = Field(min_length=6, max_length=20)


class MfaDisableIn(Base):
    password: str = Field(max_length=200)
    code: str = Field(min_length=6, max_length=20)


class ProfileUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class ChangePasswordIn(Base):
    current_password: str
    new_password: str


# ── Organization ─────────────────────────────────────────────────────────────


class OrgCreate(Base):
    name: str = Field(min_length=1, max_length=160)
    timezone: str = "America/New_York"


class OrgUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def valid_tz(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from zoneinfo import ZoneInfo

        try:
            ZoneInfo(v)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Unknown time zone") from exc
        return v


class InviteIn(Base):
    email: EmailStr
    role: Literal["manager", "accountant", "maintenance"]
    property_ids: list[uuid.UUID] | None = Field(default=None, max_length=500)  # None = all properties


class MemberUpdate(Base):
    role: Literal["owner", "manager", "accountant", "maintenance"] | None = None
    property_ids: list[uuid.UUID] | None = Field(default=None, max_length=500)
    all_properties: bool = False  # set True to clear the scope


class NotificationPrefs(Base):
    rent_reminders: bool = True
    maintenance_updates: bool = True
    lease_expiry: bool = True
    document_expiry: bool = True
    payment_receipts: bool = True


# ── Properties & units ───────────────────────────────────────────────────────


class PropertyIn(Base):
    name: str = Field(min_length=1, max_length=160)
    property_type: PropertyType = "single_family"
    address_line1: str = Field(min_length=1, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(default="US", min_length=2, max_length=2)
    purchase_date: date | None = None
    purchase_price_cents: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=5000)


class PropertyUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    property_type: PropertyType | None = None
    address_line1: str | None = Field(default=None, min_length=1, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    state: str | None = Field(default=None, min_length=1, max_length=100)
    postal_code: str | None = Field(default=None, min_length=1, max_length=20)
    country: str | None = Field(default=None, min_length=2, max_length=2)
    purchase_date: date | None = None
    purchase_price_cents: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=5000)
    cover_photo_id: uuid.UUID | None = None


class UnitIn(Base):
    name: str = Field(min_length=1, max_length=80)
    beds: float | None = Field(default=None, ge=0, le=50)
    baths: float | None = Field(default=None, ge=0, le=50)
    sqft: int | None = Field(default=None, ge=0, le=1_000_000)
    market_rent_cents: int | None = Field(default=None, ge=0)
    amenities: list[str] = Field(default_factory=list, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)


class UnitUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    beds: float | None = Field(default=None, ge=0, le=50)
    baths: float | None = Field(default=None, ge=0, le=50)
    sqft: int | None = Field(default=None, ge=0, le=1_000_000)
    market_rent_cents: int | None = Field(default=None, ge=0)
    amenities: list[str] | None = None
    notes: str | None = Field(default=None, max_length=5000)
    status: UnitStatus | None = None  # only "maintenance" ↔ derived status is allowed manually


# ── Tenants & leases ─────────────────────────────────────────────────────────


class TenantIn(Base):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_phone: str | None = Field(default=None, max_length=40)
    vehicles: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    pets: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, v: Any) -> Any:
        return None if v == "" else v


class TenantUpdate(TenantIn):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)  # type: ignore[assignment]
    last_name: str | None = Field(default=None, min_length=1, max_length=80)  # type: ignore[assignment]
    vehicles: list[dict[str, Any]] | None = None  # type: ignore[assignment]
    pets: list[dict[str, Any]] | None = None  # type: ignore[assignment]


class RecurringChargeIn(Base):
    charge_type: ChargeType = "other"
    description: str = Field(min_length=1, max_length=120)
    amount_cents: int = Field(gt=0, le=10_000_000)


class LeaseIn(Base):
    unit_id: uuid.UUID
    tenant_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)
    primary_tenant_id: uuid.UUID | None = None
    start_date: date
    end_date: date | None = None
    rent_cents: int = Field(gt=0, le=10_000_000)
    due_day: int = Field(default=1, ge=1, le=28)
    deposit_cents: int = Field(default=0, ge=0, le=10_000_000)
    late_fee_type: LateFeeType = "none"
    late_fee_amount: int = Field(default=0, ge=0, le=1_000_000)
    grace_days: int = Field(default=5, ge=0, le=27)
    charges_start_on: date | None = None
    opening_balance_cents: int = Field(default=0, ge=-10_000_000, le=10_000_000)
    recurring_charges: list[RecurringChargeIn] = Field(default_factory=list, max_length=20)
    notes: str | None = Field(default=None, max_length=5000)


class LeaseUpdate(Base):
    end_date: date | None = None
    rent_cents: int | None = Field(default=None, gt=0, le=10_000_000)
    due_day: int | None = Field(default=None, ge=1, le=28)
    deposit_cents: int | None = Field(default=None, ge=0, le=10_000_000)
    late_fee_type: LateFeeType | None = None
    late_fee_amount: int | None = Field(default=None, ge=0, le=1_000_000)
    grace_days: int | None = Field(default=None, ge=0, le=27)
    notes: str | None = Field(default=None, max_length=5000)
    tenant_ids: list[uuid.UUID] | None = Field(default=None, min_length=1, max_length=10)
    block_online_payments: bool | None = None


class LeaseEndIn(Base):
    ended_on: date


# ── Ledger & payments ────────────────────────────────────────────────────────


class PaymentIn(Base):
    amount_cents: int = Field(gt=0, le=10_000_000)
    method: PaymentMethod
    received_on: date
    tenant_id: uuid.UUID | None = None
    reference: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    send_receipt: bool = True


class LedgerAdjustmentIn(Base):
    entry_type: Literal["charge", "credit", "adjustment"]
    description: str = Field(min_length=1, max_length=200)
    # charge: positive owed. credit: reduces balance. adjustment: signed.
    amount_cents: int = Field(ge=-10_000_000, le=10_000_000)
    entry_date: date

    @field_validator("amount_cents")
    @classmethod
    def non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("Amount cannot be zero")
        return v


# ── Expenses ─────────────────────────────────────────────────────────────────


class ExpenseIn(Base):
    property_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    category: ExpenseCategory
    amount_cents: int = Field(gt=0, le=100_000_000)
    expense_date: date
    vendor: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    receipt_document_id: uuid.UUID | None = None


class ExpenseUpdate(Base):
    property_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    category: ExpenseCategory | None = None
    amount_cents: int | None = Field(default=None, gt=0, le=100_000_000)
    expense_date: date | None = None
    vendor: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    receipt_document_id: uuid.UUID | None = None


# ── Work orders ──────────────────────────────────────────────────────────────


class WorkOrderIn(Base):
    property_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    category: WorkOrderCategory = "general"
    priority: WorkOrderPriority = "medium"
    assigned_to_user_id: uuid.UUID | None = None
    permission_to_enter: bool = False
    asset_id: uuid.UUID | None = None


class PortalWorkOrderIn(Base):
    lease_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    category: WorkOrderCategory = "general"
    priority: WorkOrderPriority = "medium"
    permission_to_enter: bool = False


class WorkOrderUpdate(Base):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    category: WorkOrderCategory | None = None
    priority: WorkOrderPriority | None = None
    status: WorkOrderStatus | None = None
    assigned_to_user_id: uuid.UUID | None = None
    scheduled_for: datetime | None = None
    unassign: bool = False

    @field_validator("scheduled_for")
    @classmethod
    def assume_utc(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            from datetime import timezone

            return v.replace(tzinfo=timezone.utc)
        return v


class CommentIn(Base):
    body: str = Field(min_length=1, max_length=5000)
    is_internal: bool = False


class CompleteWithExpenseIn(Base):
    amount_cents: int = Field(gt=0, le=100_000_000)
    category: ExpenseCategory = "repairs"
    vendor: str | None = Field(default=None, max_length=160)
    expense_date: date


# ── Documents ────────────────────────────────────────────────────────────────


class DocumentUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    kind: DocumentKind | None = None
    expires_on: date | None = None
    clear_expiry: bool = False
    visible_to_tenant: bool | None = None


# ── Leasing workflows ────────────────────────────────────────────────────────


class LeaseTemplateIn(Base):
    name: str = Field(min_length=1, max_length=120)
    body: str | None = Field(default=None, max_length=100_000)  # blank → starter template


class LeaseTemplateUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    body: str | None = Field(default=None, min_length=1, max_length=100_000)


class RenderIn(Base):
    template_id: uuid.UUID | None = None
    body: str | None = Field(default=None, max_length=100_000)


class SignatureRequestIn(Base):
    title: str = Field(min_length=1, max_length=200)
    template_id: uuid.UUID | None = None
    body: str | None = Field(default=None, max_length=100_000)  # edited text; wins over the template
    landlord_signs: bool = True


class SignIn(Base):
    signature_name: str = Field(min_length=2, max_length=160)
    signature_image: str | None = Field(default=None, max_length=300_000)  # PNG data URL from the signature pad
    consent: bool

    @field_validator("consent")
    @classmethod
    def must_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please agree to sign electronically.")
        return v


class RenewalOfferIn(Base):
    rent_cents: int = Field(gt=0, le=100_000_000)
    start_date: date
    end_date: date | None = None
    respond_by: date
    message: str | None = Field(default=None, max_length=2000)


class RenewalResponseIn(Base):
    accept: bool
    note: str | None = Field(default=None, max_length=2000)


class InspectionIn(Base):
    kind: Literal["move_in", "move_out"]
    inspected_on: date


class InspectionItemIn(Base):
    id: str = Field(min_length=1, max_length=20)
    area: str = Field(min_length=1, max_length=80)
    item: str = Field(min_length=1, max_length=120)
    condition: Literal["", "good", "fair", "poor", "damaged", "na"] = ""
    notes: str = Field(default="", max_length=1000)
    photo_ids: list[str] = Field(default_factory=list, max_length=20)


class InspectionUpdate(Base):
    inspected_on: date | None = None
    notes: str | None = Field(default=None, max_length=5000)
    items: list[InspectionItemIn] | None = Field(default=None, max_length=300)


class InspectionCompleteIn(Base):
    share_with_tenant: bool = True


class DeductionIn(Base):
    description: str = Field(min_length=1, max_length=200)
    amount_cents: int = Field(ge=0, le=100_000_000)


class DepositDispositionIn(Base):
    deductions: list[DeductionIn] = Field(default_factory=list, max_length=50)
    balance_applied_cents: int = Field(default=0, ge=0, le=100_000_000)
    forwarding_address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=5000)


# ── Vendors & preventive maintenance ─────────────────────────────────────────

AssetCategory = Literal["appliance", "hvac", "water_heater", "plumbing", "electrical", "roof", "safety", "exterior", "other"]
AccessKind = Literal["key", "fob", "remote", "code", "lockbox", "mailbox", "other"]


class VendorIn(Base):
    name: str = Field(min_length=1, max_length=160)
    contact_name: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=300)
    trades: list[WorkOrderCategory] = Field(default_factory=list, max_length=10)
    hourly_rate_cents: int | None = Field(default=None, ge=0, le=10_000_000)
    call_out_fee_cents: int | None = Field(default=None, ge=0, le=10_000_000)
    license_number: str | None = Field(default=None, max_length=80)
    w9_on_file: bool = False
    insurance_expires_on: date | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, v):
        return v or None


class VendorUpdate(VendorIn):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    trades: list[WorkOrderCategory] | None = Field(default=None, max_length=10)
    w9_on_file: bool | None = None
    archived: bool | None = None


class WorkOrderVendorIn(Base):
    vendor_id: uuid.UUID | None  # None → remove the vendor
    email_vendor: bool = False
    message: str | None = Field(default=None, max_length=2000)


class QuoteIn(Base):
    vendor_id: uuid.UUID
    amount_cents: int = Field(gt=0, le=100_000_000)
    description: str | None = Field(default=None, max_length=2000)
    valid_until: date | None = None
    document_id: uuid.UUID | None = None


class VendorInvoiceIn(Base):
    vendor_id: uuid.UUID | None = None  # defaults to the work order's vendor
    invoice_number: str | None = Field(default=None, max_length=60)
    amount_cents: int = Field(gt=0, le=100_000_000)
    invoice_date: date
    due_date: date | None = None
    category: ExpenseCategory = "repairs"
    document_id: uuid.UUID | None = None
    paid_on: date | None = None
    complete_work_order: bool = True


class InvoicePaidIn(Base):
    paid_on: date


class VendorRatingIn(Base):
    rating: int = Field(ge=1, le=5)


class ScheduleIn(Base):
    property_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category: WorkOrderCategory = "general"
    priority: WorkOrderPriority = "low"
    interval_months: int = Field(default=12, ge=1, le=120)
    next_due_on: date
    lead_days: int = Field(default=7, ge=0, le=90)
    vendor_id: uuid.UUID | None = None
    assigned_to_user_id: uuid.UUID | None = None
    asset_id: uuid.UUID | None = None


class ScheduleUpdate(Base):
    unit_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category: WorkOrderCategory | None = None
    priority: WorkOrderPriority | None = None
    interval_months: int | None = Field(default=None, ge=1, le=120)
    next_due_on: date | None = None
    lead_days: int | None = Field(default=None, ge=0, le=90)
    vendor_id: uuid.UUID | None = None
    assigned_to_user_id: uuid.UUID | None = None
    asset_id: uuid.UUID | None = None
    active: bool | None = None


class AssetIn(Base):
    property_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    category: AssetCategory = "appliance"
    make: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    serial_number: str | None = Field(default=None, max_length=80)
    installed_on: date | None = None
    purchase_price_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    warranty_expires_on: date | None = None
    location: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class AssetUpdate(AssetIn):
    property_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: AssetCategory | None = None
    archived: bool | None = None


class AccessItemIn(Base):
    property_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    kind: AccessKind = "key"
    label: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=120)
    quantity: int = Field(default=1, ge=0, le=999)
    holder: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    changed_on: date | None = None


class AccessItemUpdate(AccessItemIn):
    property_id: uuid.UUID | None = None
    kind: AccessKind | None = None
    label: str | None = Field(default=None, min_length=1, max_length=120)
    quantity: int | None = Field(default=None, ge=0, le=999)


# ── Listings & applications ──────────────────────────────────────────────────


class ListingIn(Base):
    unit_id: uuid.UUID
    title: str | None = Field(default=None, max_length=160)  # default: property + unit name


class ListingUpdate(Base):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    rent_cents: int | None = Field(default=None, gt=0, le=100_000_000)
    deposit_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    available_on: date | None = None
    lease_term_months: int | None = Field(default=None, ge=1, le=60)
    beds: float | None = Field(default=None, ge=0, le=50)
    baths: float | None = Field(default=None, ge=0, le=50)
    sqft: int | None = Field(default=None, ge=0, le=1_000_000)
    amenities: list[str] | None = Field(default=None, max_length=40)
    pet_policy: str | None = Field(default=None, max_length=300)
    utilities_included: str | None = Field(default=None, max_length=300)
    requirements: str | None = Field(default=None, max_length=2000)
    application_fee_cents: int | None = Field(default=None, ge=0, le=20_000)
    screening_url: str | None = Field(default=None, max_length=500)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    photo_order: list[str] | None = Field(default=None, max_length=40)

    @field_validator("screening_url")
    @classmethod
    def https_only(cls, v: str | None) -> str | None:
        if v and not v.startswith("https://"):
            raise ValueError("Use a link that starts with https://")
        return v or None

    @field_validator("contact_email", mode="before")
    @classmethod
    def blank_email(cls, v):
        return v or None


class CoApplicantIn(Base):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None


class ApplicationIn(Base):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=40)
    desired_move_in: date | None = None
    current_address: str = Field(min_length=3, max_length=300)
    current_rent_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    current_landlord_name: str | None = Field(default=None, max_length=120)
    current_landlord_phone: str | None = Field(default=None, max_length=40)
    years_at_address: float | None = Field(default=None, ge=0, le=80)
    employer: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=120)
    monthly_income_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    occupants: int = Field(default=1, ge=1, le=20)
    co_applicants: list[CoApplicantIn] = Field(default_factory=list, max_length=5)
    pets: str | None = Field(default=None, max_length=500)
    vehicles: str | None = Field(default=None, max_length=300)
    prior_eviction: bool = False
    message: str | None = Field(default=None, max_length=3000)
    signature_name: str = Field(min_length=2, max_length=160)
    consent: bool
    website: str | None = Field(default=None, max_length=200)  # honeypot: humans leave it empty

    @field_validator("consent")
    @classmethod
    def must_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please confirm the information is accurate and agree to screening.")
        return v


class ApplicationUpdate(Base):
    status: Literal["submitted", "screening", "approved", "declined", "withdrawn"] | None = None
    staff_notes: str | None = Field(default=None, max_length=5000)
    rating: int | None = Field(default=None, ge=1, le=5)
    fee_status: Literal["none", "unpaid", "paid", "waived"] | None = None


class ApplicationDecisionIn(Base):
    message: str | None = Field(default=None, max_length=2000)
    notify: bool = True


class ConvertApplicationIn(Base):
    start_date: date
    end_date: date | None = None
    rent_cents: int = Field(gt=0, le=100_000_000)
    deposit_cents: int = Field(default=0, ge=0, le=100_000_000)
    due_day: int = Field(default=1, ge=1, le=28)
    include_co_applicants: bool = True
    close_listing: bool = True
    invite_to_portal: bool = True


class CreditSummaryIn(Base):
    total_debt_cents: int | None = Field(default=None, ge=0, le=10_000_000_000)
    open_accounts: int | None = Field(default=None, ge=0, le=500)
    late_payments: int | None = Field(default=None, ge=0, le=500)
    collections_count: int | None = Field(default=None, ge=0, le=500)
    collections_cents: int | None = Field(default=None, ge=0, le=10_000_000_000)
    bankruptcies: int | None = Field(default=None, ge=0, le=50)
    notes: str | None = Field(default=None, max_length=2000)


class CriminalRecordIn(Base):
    offense: str = Field(min_length=1, max_length=200)
    severity: Literal["felony", "misdemeanor", "infraction", "other"] = "other"
    offense_date: date | None = None
    jurisdiction: str | None = Field(default=None, max_length=120)
    disposition: str | None = Field(default=None, max_length=200)  # e.g. convicted, dismissed


class EvictionRecordIn(Base):
    filed_on: date | None = None
    court: str | None = Field(default=None, max_length=160)
    plaintiff: str | None = Field(default=None, max_length=160)
    outcome: Literal["judgment", "dismissed", "settled", "pending", "unknown"] = "unknown"
    amount_cents: int | None = Field(default=None, ge=0, le=100_000_000)


class ScreeningReportIn(Base):
    provider: str | None = Field(default=None, max_length=80)
    report_date: date | None = None
    credit_score: int | None = Field(default=None, ge=300, le=850)
    credit_summary: CreditSummaryIn = Field(default_factory=CreditSummaryIn)
    criminal_records: list[CriminalRecordIn] = Field(default_factory=list, max_length=50)
    eviction_records: list[EvictionRecordIn] = Field(default_factory=list, max_length=50)
    document_id: uuid.UUID | None = None
    result: Literal["pass", "review", "fail"] | None = None
    notes: str | None = Field(default=None, max_length=3000)


class AdverseActionIn(Base):
    """FCRA adverse action notice details (sent when declining based on a consumer report)."""

    reasons: list[str] = Field(min_length=1, max_length=8)
    agency_name: str = Field(min_length=2, max_length=160)
    agency_address: str = Field(min_length=5, max_length=300)
    agency_phone: str = Field(min_length=7, max_length=40)
    credit_score_used: bool = False


# ── Communication ────────────────────────────────────────────────────────────


class ThreadIn(Base):
    tenant_id: uuid.UUID
    subject: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)


class PortalThreadIn(Base):
    subject: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)


class MessageIn(Base):
    body: str = Field(min_length=1, max_length=5000)


class ThreadUpdate(Base):
    archived: bool


class AnnouncementIn(Base):
    property_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=5000)
    send_email: bool = True
    send_sms: bool = False


class NoticeFields(Base):
    effective_date: date | None = None
    new_rent_cents: int | None = Field(default=None, gt=0, le=100_000_000)
    entry_date: date | None = None
    entry_window: str | None = Field(default=None, max_length=60)
    entry_reason: str | None = Field(default=None, max_length=300)
    violation: str | None = Field(default=None, max_length=1000)
    cure_days: int | None = Field(default=None, ge=0, le=90)
    amount_due_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    pay_days: int | None = Field(default=None, ge=1, le=60)


class NoticePreviewIn(NoticeFields):
    kind: Literal["rent_increase", "entry", "violation", "pay_or_quit", "general"]
    body: str | None = Field(default=None, max_length=20_000)  # edited template text; blank → default template


class NoticeIn(NoticePreviewIn):
    title: str = Field(min_length=1, max_length=160)
    send_email: bool = True
    send_sms: bool = True


class SmsPrefsIn(Base):
    opt_in: bool
    phone: str | None = Field(default=None, max_length=40)


class MoveOutIn(Base):
    move_out_date: date
    forwarding_address: str | None = Field(default=None, max_length=500)
    reason: str | None = Field(default=None, max_length=2000)


class MoveOutAckIn(Base):
    set_lease_end: bool = True
