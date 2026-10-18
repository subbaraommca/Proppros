export type Role = "owner" | "manager" | "accountant" | "maintenance" | "tenant" | "vendor";

export interface Org {
  id: string;
  name: string;
  role: Role;
  currency: string;
  timezone: string;
}
export interface Me {
  id: string;
  name: string;
  email: string;
  organizations: Org[];
}
export type LoginResult = { access_token: string; me: Me } | { mfa_required: true; mfa_token: string };

export interface WorkOrder {
  id: string;
  number: number;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "emergency";
  status: "new" | "assigned" | "scheduled" | "in_progress" | "completed" | "closed";
  property_name?: string;
  unit_name?: string | null;
  tenant_name?: string | null;
  created_at: string;
  scheduled_for: string | null;
  permission_to_enter?: boolean;
  comments?: { id: string; body: string; author_name: string; is_system: boolean; is_internal: boolean; created_at: string }[];
  can_edit?: boolean;
}
export interface ThreadRow {
  id: string;
  subject: string;
  tenant_name: string;
  property_name: string | null;
  last_message_at: string;
  last_author_role: "staff" | "tenant";
  preview: string;
  unread: boolean;
}
export interface ChatMessage {
  id: string;
  body: string;
  author_role: "staff" | "tenant";
  author_name: string;
  via: "app" | "sms";
  created_at: string;
}
