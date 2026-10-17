"""All SQLModel tables. Add a model here, then create an Alembic migration.

Conventions:
  • Every org-owned table has `org_id`; every query must filter by it.
  • Money is stored as integer cents (`*_cents`).
  • Enum-like fields are plain strings validated in schemas.py (see the
    constants below) — keeps Postgres migrations free of ENUM types.
  • Datetimes are timezone-aware UTC (`utcnow()`); dates are calendar dates.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Enum-like constants ──────────────────────────────────────────────────────

ROLES = ("owner", "manager", "accountant", "maintenance", "tenant", "vendor")
STAFF_ROLES = ("owner", "manager", "accountant", "maintenance")
WRITE_ROLES = ("owner", "manager")

PROPERTY_TYPES = ("single_family", "multi_family", "condo", "townhouse", "commercial", "other")
UNIT_STATUSES = ("vacant", "occupied", "maintenance")
LEASE_STATUSES = ("active", "ended")
LATE_FEE_TYPES = ("none", "flat", "percent")
CHARGE_TYPES = ("parking", "pet", "utility", "storage", "other")
LEDGER_TYPES = ("rent", "recurring", "late_fee", "payment", "credit", "adjustment", "opening_balance", "charge", "payment_reversal", "returned_fee")
PAYMENT_STATUSES = ("processing", "succeeded", "failed", "reversed")
PAYMENT_SOURCES = ("manual", "online", "autopay")
PAYMENT_METHODS = ("cash", "check", "zelle", "venmo", "bank_transfer", "card", "other")
EXPENSE_CATEGORIES = (
    "advertising",
    "auto_travel",
    "cleaning_maintenance",
    "commissions",
    "insurance",
    "legal_professional",
    "management_fees",
    "mortgage_interest",
    "other_interest",
    "repairs",
    "supplies",
    "taxes",
    "utilities",
    "hoa",
    "capital_improvement",
    "other",
)
WORK_ORDER_CATEGORIES = ("plumbing", "electrical", "hvac", "appliance", "pest", "roof", "landscaping", "general", "other")
WORK_ORDER_PRIORITIES = ("low", "medium", "high", "emergency")
WORK_ORDER_STATUSES = ("new", "assigned", "scheduled", "in_progress", "completed", "closed")
DOCUMENT_OWNER_TYPES = ("organization", "property", "unit", "tenant", "lease", "expense", "work_order", "vendor")
DOCUMENT_KINDS = ("photo", "lease", "insurance", "deed", "hoa", "inspection", "receipt", "invoice", "license", "id", "other")


class TimestampMixin(SQLModel):
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)


# ── Accounts & organizations ─────────────────────────────────────────────────


class User(TimestampMixin, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True, max_length=255)
    name: str = Field(max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    password_hash: str
    email_verified_at: datetime | None = None
    token_version: int = 0  # bump to invalidate all issued JWTs (logout, password reset)
    is_superadmin: bool = False


class Organization(TimestampMixin, table=True):
    __tablename__ = "organizations"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=160)
    timezone: str = Field(default="America/New_York", max_length=64)
    currency: str = Field(default="USD", max_length=3)
    plan: str = Field(default="free", max_length=32)
    # Online payments (Stripe Connect Express — money goes to the owner's connected account)
    stripe_account_id: str | None = Field(default=None, max_length=64)
    stripe_charges_enabled: bool = False
    stripe_payouts_enabled: bool = False
    stripe_details_submitted: bool = False
    online_payments_enabled: bool = False
    allow_partial_payments: bool = True
    pass_card_fee: bool = False  # tenant pays the card processing fee
    returned_payment_fee_cents: int = 0


class Membership(TimestampMixin, table=True):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_membership_org_user"),)
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    role: str = Field(max_length=20)
    notification_prefs: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class AuthToken(SQLModel, table=True):
    """One-time tokens for email verification and password reset (hash stored only)."""

    __tablename__ = "auth_tokens"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    purpose: str = Field(max_length=20)  # verify_email | reset_password
    token_hash: str = Field(index=True, unique=True, max_length=64)
    expires_at: datetime
    used_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Invitation(SQLModel, table=True):
    __tablename__ = "invitations"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    email: str = Field(max_length=255, index=True)
    role: str = Field(max_length=20)
    tenant_id: uuid.UUID | None = Field(default=None, foreign_key="tenants.id")
    token_hash: str = Field(index=True, unique=True, max_length=64)
    invited_by_user_id: uuid.UUID = Field(foreign_key="users.id")
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


# ── Properties & units ───────────────────────────────────────────────────────


class Property(TimestampMixin, table=True):
    __tablename__ = "properties"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=160)
    property_type: str = Field(default="single_family", max_length=20)
    address_line1: str = Field(max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str = Field(max_length=100)
    state: str = Field(max_length=100)
    postal_code: str = Field(max_length=20)
    country: str = Field(default="US", max_length=2)
    purchase_date: date | None = None
    purchase_price_cents: int | None = None
    cover_photo_id: uuid.UUID | None = None
    notes: str | None = None
    archived_at: datetime | None = None


class Unit(TimestampMixin, table=True):
    __tablename__ = "units"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    property_id: uuid.UUID = Field(foreign_key="properties.id", index=True)
    name: str = Field(max_length=80)
    beds: float | None = None
    baths: float | None = None
    sqft: int | None = None
    market_rent_cents: int | None = None
    amenities: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    status: str = Field(default="vacant", max_length=20)
    notes: str | None = None


# ── Tenants & leases ─────────────────────────────────────────────────────────


class Tenant(TimestampMixin, table=True):
    __tablename__ = "tenants"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)  # portal account
    first_name: str = Field(max_length=80)
    last_name: str = Field(max_length=80)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_phone: str | None = Field(default=None, max_length=40)
    vehicles: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    pets: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    notes: str | None = None
    stripe_customer_id: str | None = Field(default=None, max_length=64)


class Lease(TimestampMixin, table=True):
    __tablename__ = "leases"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    unit_id: uuid.UUID = Field(foreign_key="units.id", index=True)
    status: str = Field(default="active", max_length=20)
    start_date: date
    end_date: date | None = None  # None → month-to-month
    rent_cents: int
    due_day: int = 1  # 1–28
    deposit_cents: int = 0
    late_fee_type: str = Field(default="none", max_length=10)
    late_fee_amount: int = 0  # cents when flat, basis points (500 = 5%) when percent
    grace_days: int = 5
    # Automatic charges are only posted for due dates on/after this date, so
    # entering an existing lease doesn't back-bill history (use opening balance).
    charges_start_on: date
    ended_on: date | None = None
    notes: str | None = None
    block_online_payments: bool = False  # e.g. after an eviction notice


class LeaseTenant(SQLModel, table=True):
    __tablename__ = "lease_tenants"
    lease_id: uuid.UUID = Field(foreign_key="leases.id", primary_key=True)
    tenant_id: uuid.UUID = Field(foreign_key="tenants.id", primary_key=True)
    is_primary: bool = False


class RecurringCharge(TimestampMixin, table=True):
    __tablename__ = "recurring_charges"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    lease_id: uuid.UUID = Field(foreign_key="leases.id", index=True)
    charge_type: str = Field(default="other", max_length=20)
    description: str = Field(max_length=120)
    amount_cents: int


# ── Ledger & payments ────────────────────────────────────────────────────────


class Payment(TimestampMixin, table=True):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("stripe_payment_intent_id", name="uq_payments_stripe_payment_intent_id"),)
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    lease_id: uuid.UUID = Field(foreign_key="leases.id", index=True)
    tenant_id: uuid.UUID | None = Field(default=None, foreign_key="tenants.id")
    receipt_number: str = Field(max_length=32, index=True)
    method: str = Field(max_length=20)
    amount_cents: int
    received_on: date
    reference: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    voided_at: datetime | None = None
    created_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    status: str = Field(default="succeeded", max_length=12)  # only succeeded payments are in the ledger
    source: str = Field(default="manual", max_length=10)
    fee_cents: int = 0  # card fee charged to the tenant on top of the rent amount
    stripe_payment_intent_id: str | None = Field(default=None, max_length=64)
    failure_reason: str | None = Field(default=None, max_length=300)


class LedgerEntry(SQLModel, table=True):
    """Balance-forward lease ledger. Positive = owed by tenant, negative = paid/credited."""

    __tablename__ = "ledger_entries"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    lease_id: uuid.UUID = Field(foreign_key="leases.id", index=True)
    entry_type: str = Field(max_length=20)
    description: str = Field(max_length=200)
    amount_cents: int
    entry_date: date
    period: str | None = Field(default=None, max_length=7)  # "YYYY-MM"
    # Idempotency key for automated entries, e.g. "rent:<lease>:2026-11".
    source_key: str | None = Field(default=None, unique=True, max_length=120)
    payment_id: uuid.UUID | None = Field(default=None, foreign_key="payments.id", index=True)
    created_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=utcnow)


class AutopayEnrollment(TimestampMixin, table=True):
    """A tenant's saved payment method, charged automatically on the lease's due date."""

    __tablename__ = "autopay_enrollments"
    __table_args__ = (UniqueConstraint("lease_id", "tenant_id", name="uq_autopay_lease_tenant"),)
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    lease_id: uuid.UUID = Field(foreign_key="leases.id", index=True)
    tenant_id: uuid.UUID = Field(foreign_key="tenants.id")
    stripe_customer_id: str = Field(max_length=64)
    stripe_payment_method_id: str = Field(max_length=64)
    method_type: str = Field(max_length=20)  # card | us_bank_account
    method_label: str = Field(default="", max_length=60)  # e.g. "Visa •••• 4242"
    active: bool = True


class StripeEvent(SQLModel, table=True):
    """Processed webhook events — Stripe retries deliveries, so each is applied once."""

    __tablename__ = "stripe_events"
    id: str = Field(primary_key=True, max_length=64)
    event_type: str = Field(max_length=60)
    processed_at: datetime = Field(default_factory=utcnow)


# ── Expenses ─────────────────────────────────────────────────────────────────


class Expense(TimestampMixin, table=True):
    __tablename__ = "expenses"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    property_id: uuid.UUID = Field(foreign_key="properties.id", index=True)
    unit_id: uuid.UUID | None = Field(default=None, foreign_key="units.id")
    work_order_id: uuid.UUID | None = Field(default=None, foreign_key="work_orders.id")
    category: str = Field(max_length=30)
    amount_cents: int
    expense_date: date = Field(index=True)
    vendor: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    receipt_document_id: uuid.UUID | None = None
    created_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")


# ── Maintenance ──────────────────────────────────────────────────────────────


class WorkOrder(TimestampMixin, table=True):
    __tablename__ = "work_orders"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    number: int = 0  # human-friendly per-org sequence
    property_id: uuid.UUID = Field(foreign_key="properties.id", index=True)
    unit_id: uuid.UUID | None = Field(default=None, foreign_key="units.id")
    tenant_id: uuid.UUID | None = Field(default=None, foreign_key="tenants.id")  # requester, if a tenant
    title: str = Field(max_length=160)
    description: str | None = None
    category: str = Field(default="general", max_length=20)
    priority: str = Field(default="medium", max_length=20)
    status: str = Field(default="new", max_length=20, index=True)
    assigned_to_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    scheduled_for: datetime | None = None
    completed_at: datetime | None = None
    closed_at: datetime | None = None
    permission_to_enter: bool = False
    created_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")


class WorkOrderComment(SQLModel, table=True):
    __tablename__ = "work_order_comments"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    work_order_id: uuid.UUID = Field(foreign_key="work_orders.id", index=True)
    author_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    body: str
    is_internal: bool = False  # hidden from tenants
    is_system: bool = False  # status-change events
    created_at: datetime = Field(default_factory=utcnow)


# ── Documents ────────────────────────────────────────────────────────────────


class Document(TimestampMixin, table=True):
    __tablename__ = "documents"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    owner_type: str = Field(max_length=20, index=True)
    owner_id: uuid.UUID = Field(index=True)
    kind: str = Field(default="other", max_length=20)
    name: str = Field(max_length=200)
    content_type: str = Field(max_length=120)
    size_bytes: int
    storage_backend: str = Field(max_length=10)
    storage_key: str = Field(max_length=500)
    expires_on: date | None = Field(default=None, index=True)
    visible_to_tenant: bool = False
    uploaded_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")


# ── Notifications & audit ────────────────────────────────────────────────────


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    template: str = Field(max_length=40)
    to_email: str = Field(max_length=255)
    subject: str = Field(max_length=200)
    # Prevents duplicate automated emails, e.g. "rent_due:<lease>:2026-11:<email>".
    dedupe_key: str | None = Field(default=None, unique=True, max_length=200)
    status: str = Field(default="sent", max_length=10)  # sent | failed
    error: str | None = Field(default=None, max_length=300)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    actor_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id")
    entity_type: str = Field(max_length=40, index=True)
    entity_id: uuid.UUID | None = None
    action: str = Field(max_length=40)
    summary: str = Field(default="", max_length=300)
    changes: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)
