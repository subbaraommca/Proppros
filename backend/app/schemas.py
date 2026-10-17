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
DocumentOwnerType = Literal["organization", "property", "unit", "tenant", "lease", "expense", "work_order", "vendor"]
DocumentKind = Literal["photo", "lease", "insurance", "deed", "hoa", "inspection", "receipt", "invoice", "license", "id", "other"]




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


class MemberUpdate(Base):
    role: Literal["owner", "manager", "accountant", "maintenance"]


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
