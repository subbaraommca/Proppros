import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Trash2, UserPlus } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { AuditEntry, Me } from "../types";
import { Badge, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Tabs } from "../components/ui";
import { dateTime, label } from "../utils/format";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Asia/Kolkata",
  "Australia/Sydney",
];

interface Org {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}
interface Members {
  members: { membership_id: string; user_id: string; name: string; email: string; role: string }[];
  invitations: { id: string; email: string; role: string; expires_at: string }[];
}
type Prefs = Record<"rent_reminders" | "maintenance_updates" | "lease_expiry" | "document_expiry" | "payment_receipts", boolean>;

function OrgSettings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["org"], queryFn: () => api.get<Org>("/org") });
  const [f, setF] = useState<{ name: string; timezone: string } | null>(null);
  const form = f ?? (data ? { name: data.name, timezone: data.timezone } : null);
  const save = useMutation({
    mutationFn: () => api.patch("/org", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setF(null);
    },
  });
  const run = useMutation({ mutationFn: () => api.post<Record<string, number>>("/automation/run") });
  if (!form) return <Spinner />;
  const owner = can("owner");
  return (
    <div className="stack">
      <Card title="Portfolio">
        <div className="form" style={{ maxWidth: 520 }}>
          <ErrorBox error={save.error} />
          <Field label="Name">
            <Input value={form.name} disabled={!owner} onChange={(e) => setF({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Time zone" hint="rent due dates and reminders use this">
            <Select value={form.timezone} disabled={!owner} onChange={(e) => setF({ ...form, timezone: e.target.value })} options={Array.from(new Set([form.timezone, ...TIMEZONES]))} />
          </Field>
          {owner && (
            <div>
              <button className="btn btn-primary" disabled={!f || save.isPending} onClick={() => save.mutate()}>
                Save
              </button>
            </div>
          )}
        </div>
      </Card>
      {can("owner", "manager") && (
        <Card title="Automation">
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted">
              Every day Proppros posts rent and recurring charges, applies late fees after the grace period, and emails rent reminders and lease/document expiry alerts.
              It runs automatically; you can also run it now. Running it twice never duplicates charges.
            </p>
            <div>
              <button className="btn" onClick={() => run.mutate()} disabled={run.isPending}>
                <Play size={14} /> {run.isPending ? "Running…" : "Run today's automation now"}
              </button>
            </div>
            <ErrorBox error={run.error} />
            {run.data && (
              <div className="success-box">
                Done — {run.data.rent_entries} charges posted, {run.data.late_fees} late fees, {run.data.reminders} reminders, {run.data.lease_alerts + run.data.document_alerts} alerts sent.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Team() {
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["members"], queryFn: () => api.get<Members>("/org/members") });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const refresh = () => qc.invalidateQueries({ queryKey: ["members"] });
  const invite = useMutation({
    mutationFn: () => api.post("/org/invitations", { email, role }),
    onSuccess: () => {
      setEmail("");
      refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/org/invitations/${id}`), onSuccess: refresh });
  const changeRole = useMutation({ mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/org/members/${id}`, { role }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/org/members/${id}`), onSuccess: refresh });
  const owner = can("owner");
  return (
    <div className="stack">
      <ErrorBox error={error || invite.error || changeRole.error || remove.error} />
      <Card title="Invite a team member">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input className="input" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" style={{ minWidth: 240 }} />
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Role"
            options={[
              { value: "manager", label: "Manager — full access" },
              { value: "accountant", label: "Accountant — read-only finances" },
              { value: "maintenance", label: "Maintenance — work orders" },
            ]}
          />
          <button className="btn btn-primary" disabled={!email || invite.isPending} onClick={() => invite.mutate()}>
            <UserPlus size={15} /> Send invite
          </button>
        </div>
        {invite.isSuccess && <div className="success-box" style={{ marginTop: 12 }}>Invitation sent.</div>}
      </Card>
      <Card title="Members" pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.members.map((m) => (
                <tr key={m.membership_id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>
                    {owner && m.user_id !== me?.id ? (
                      <Select value={m.role} onChange={(e) => changeRole.mutate({ id: m.membership_id, role: e.target.value })} options={["owner", "manager", "accountant", "maintenance"]} aria-label="Role" />
                    ) : (
                      <Badge value={m.role} />
                    )}
                  </td>
                  <td className="right">
                    {owner && m.user_id !== me?.id && (
                      <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => window.confirm(`Remove ${m.name}?`) && remove.mutate(m.membership_id)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.invitations.map((i) => (
                <tr key={i.id}>
                  <td className="muted">Invited</td>
                  <td>{i.email}</td>
                  <td>
                    <Badge value={i.role} />
                  </td>
                  <td className="right">
                    <button className="btn btn-sm btn-ghost" onClick={() => revoke.mutate(i.id)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Account() {
  const { me, setMe } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ name: me?.name ?? "", phone: me?.phone ?? "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const { data: prefs } = useQuery({ queryKey: ["prefs"], queryFn: () => api.get<Prefs>("/org/notification-preferences") });
  const saveProfile = useMutation({ mutationFn: () => api.patch<Me>("/auth/me", { name: profile.name, phone: profile.phone || null }), onSuccess: setMe });
  const changePw = useMutation({ mutationFn: () => api.post("/auth/change-password", pw), onSuccess: () => setPw({ current_password: "", new_password: "" }) });
  const savePrefs = useMutation({ mutationFn: (p: Prefs) => api.put("/org/notification-preferences", p), onSuccess: () => qc.invalidateQueries({ queryKey: ["prefs"] }) });
  const PREF_LABELS: Partial<Record<keyof Prefs, string>> = {
    rent_reminders: "Rent reminders",
    maintenance_updates: "Maintenance requests & updates",
    lease_expiry: "Lease expiry alerts (90/60/30 days)",
    document_expiry: "Document expiry alerts",
  };
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title="Profile">
        <div className="form">
          <ErrorBox error={saveProfile.error} />
          <Field label="Name">
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={me?.email} disabled />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <div>
            <button className="btn btn-primary" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              Save profile
            </button>
          </div>
        </div>
      </Card>
      <div className="stack">
        <Card title="Email notifications">
          {prefs ? (
            <div className="stack" style={{ gap: 8 }}>
              {(Object.keys(PREF_LABELS) as (keyof Prefs)[]).map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={prefs[k]} onChange={(e) => savePrefs.mutate({ ...prefs, [k]: e.target.checked })} /> {PREF_LABELS[k]}
                </label>
              ))}
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
        <Card title="Change password">
          <div className="form">
            <ErrorBox error={changePw.error} />
            {changePw.isSuccess && <div className="success-box">Password updated.</div>}
            <Field label="Current password">
              <Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </Field>
            <Field label="New password" hint="10+ characters with a number or symbol">
              <Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <div>
              <button className="btn" onClick={() => changePw.mutate()} disabled={!pw.current_password || !pw.new_password || changePw.isPending}>
                Update password
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuditLog() {
  const [entity, setEntity] = useState("");
  const { data, error, isLoading } = useQuery({
    queryKey: ["audit", entity],
    queryFn: () => api.get<AuditEntry[]>(`/audit-log?limit=200${entity ? `&entity_type=${entity}` : ""}`),
  });
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <Select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          aria-label="Record type"
          options={[{ value: "", label: "All changes" }, ...["property", "unit", "tenant", "lease", "payment", "expense", "work_order", "document", "membership", "organization", "automation"].map((x) => ({ value: x, label: label(x) }))]}
        />
      </div>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap small">{dateTime(a.created_at)}</td>
                    <td>{a.actor_name}</td>
                    <td>
                      <Badge>{label(a.entity_type)}</Badge> {a.summary || label(a.action)}
                    </td>
                    <td className="small muted">
                      {Object.entries(a.changes ?? {})
                        .slice(0, 4)
                        .map(([k, v]) => (Array.isArray(v) ? `${label(k)}: ${fmt(v[0])} → ${fmt(v[1])}` : `${label(k)}: ${fmt(v)}`))
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
                {data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function SettingsPage() {
  const { can } = useAuth();
  const isWriter = can("owner", "manager");
  const [tab, setTab] = useState<"org" | "team" | "account" | "audit">(isWriter ? "org" : "account");
  const tabs = [
    ...(isWriter
      ? [
          { id: "org" as const, label: "Portfolio" },
          { id: "team" as const, label: "Team" },
        ]
      : []),
    { id: "account" as const, label: "My account" },
    ...(isWriter ? [{ id: "audit" as const, label: "Audit log" }] : []),
  ];
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "org" && <OrgSettings />}
      {tab === "team" && <Team />}
      {tab === "account" && <Account />}
      {tab === "audit" && <AuditLog />}
    </>
  );
}
