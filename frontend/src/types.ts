export type Role = "owner" | "manager" | "accountant" | "maintenance" | "tenant" | "vendor";

export interface OrgSummary {
  id: string;
  name: string;
  role: Role;
  timezone: string;
  currency: string;
  scoped?: boolean;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  email_verified: boolean;
  is_superadmin: boolean;
  mfa_enabled?: boolean;
  google_linked?: boolean;
  impersonated_by?: string | null;
  organizations: OrgSummary[];
}

export interface Unit {
  id: string;
  property_id: string;
  name: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  market_rent_cents: number | null;
  amenities: string[];
  status: "vacant" | "occupied" | "maintenance";
  notes: string | null;
  property_name?: string;
}

export interface Property {
  id: string;
  name: string;
  property_type: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  purchase_date: string | null;
  purchase_price_cents: number | null;
  cover_photo_id: string | null;
  notes: string | null;
  archived_at: string | null;
  unit_count: number;
  occupied_count: number;
  occupancy_pct: number;
  units?: Unit[];
}

export interface TenantLeaseRef {
  lease_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  rent_cents: number;
  unit_name: string;
  property_name: string;
  balance_cents: number;
}

export interface Tenant {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  vehicles: Record<string, string>[];
  pets: Record<string, string>[];
  notes: string | null;
  current_lease?: TenantLeaseRef | null;
  leases?: TenantLeaseRef[];
  portal_status?: "active" | "invited" | "none";
}

export interface LeaseTenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export interface RecurringCharge {
  id: string;
  charge_type: string;
  description: string;
  amount_cents: number;
}

export interface Lease {
  id: string;
  unit_id: string;
  status: "active" | "ended";
  start_date: string;
  end_date: string | null;
  rent_cents: number;
  due_day: number;
  deposit_cents: number;
  late_fee_type: "none" | "flat" | "percent";
  late_fee_amount: number;
  grace_days: number;
  charges_start_on: string;
  ended_on: string | null;
  notes?: string | null;
  block_online_payments?: boolean;
  balance_cents: number;
  tenants: LeaseTenant[];
  unit_name?: string;
  property_name?: string;
  property_id?: string;
  unit?: { id: string; name: string };
  property?: { id: string; name: string; address: string };
  recurring_charges?: RecurringCharge[];
  monthly_total_cents?: number;
}

export interface LedgerRow {
  id: string;
  entry_type: string;
  description: string;
  amount_cents: number;
  entry_date: string;
  period: string | null;
  payment_id: string | null;
  balance_cents: number;
}

export interface Payment {
  id: string;
  lease_id: string;
  tenant_id: string | null;
  receipt_number: string;
  method: string;
  amount_cents: number;
  received_on: string;
  reference: string | null;
  notes: string | null;
  voided_at: string | null;
  status: "processing" | "succeeded" | "failed" | "reversed";
  source: "manual" | "online" | "autopay";
  fee_cents: number;
  failure_reason: string | null;
  unit_name?: string;
  property_name?: string;
  tenant_name?: string | null;
}

export interface Expense {
  id: string;
  property_id: string;
  unit_id: string | null;
  work_order_id: string | null;
  category: string;
  amount_cents: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  receipt_document_id: string | null;
  property_name?: string;
  unit_name?: string | null;
}

export interface Comment {
  id: string;
  body: string;
  is_internal: boolean;
  is_system: boolean;
  created_at: string;
  author_name: string;
  author_user_id: string | null;
}

export interface WorkOrder {
  id: string;
  number: number;
  property_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "emergency";
  status: "new" | "assigned" | "scheduled" | "in_progress" | "completed" | "closed";
  assigned_to_user_id: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  permission_to_enter: boolean;
  created_at: string;
  updated_at: string;
  property_name?: string;
  unit_name?: string | null;
  tenant_name?: string | null;
  assignee_name?: string | null;
  comments?: Comment[];
  expenses?: Expense[];
  attachments?: DocumentRow[];
  can_edit?: boolean;
}

export interface DocumentRow {
  id: string;
  owner_type: string;
  owner_id: string;
  kind: string;
  name: string;
  content_type: string;
  size_bytes: number;
  expires_on: string | null;
  visible_to_tenant: boolean;
  created_at: string;
  owner_label?: string;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor_name: string;
}
