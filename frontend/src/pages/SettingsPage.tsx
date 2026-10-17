import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Play, Trash2, UserPlus } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { AuditEntry, Me } from "../types";
import { Badge, Card, ErrorBox, Field, Input, InviteLink, PageHeader, Select, Spinner, Tabs } from "../components/ui";
import { dateTime, label } from "../utils/format";
import { LANGUAGES, setLanguage } from "../i18n";
import { PaymentsSettingsTab } from "../components/OnlinePayments";
import { useSearchParams } from "react-router-dom";

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
  const { t } = useTranslation();
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
      <Card title={t("settings.portfolio")}>
        <div className="form" style={{ maxWidth: 520 }}>
          <ErrorBox error={save.error} />
          <Field label={t("common.name")}>
            <Input value={form.name} disabled={!owner} onChange={(e) => setF({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("settings.timezone")} hint={t("settings.timezone_hint")}>
            <Select
              value={form.timezone}
              disabled={!owner}
              onChange={(e) => setF({ ...form, timezone: e.target.value })}
              options={Array.from(new Set([form.timezone, ...TIMEZONES])).map((z) => ({ value: z, label: z }))}
            />
          </Field>
          {owner && (
            <div>
              <button className="btn btn-primary" disabled={!f || save.isPending} onClick={() => save.mutate()}>
                {t("common.save")}
              </button>
            </div>
          )}
        </div>
      </Card>
      {can("owner", "manager") && (
        <Card title={t("enums.automation")}>
          <div className="stack" style={{ gap: 10 }}>
            <p className="muted">{t("settings.automation_body")}</p>
            <div>
              <button className="btn" onClick={() => run.mutate()} disabled={run.isPending}>
                <Play size={14} /> {run.isPending ? t("settings.running") : t("settings.run_now")}
              </button>
            </div>
            <ErrorBox error={run.error} />
            {run.data && (
              <div className="success-box">
                {t("settings.run_result", {
                  charges: run.data.rent_entries,
                  late: run.data.late_fees,
                  reminders: run.data.reminders,
                  alerts: run.data.lease_alerts + run.data.document_alerts,
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Team() {
  const { t } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["members"], queryFn: () => api.get<Members>("/org/members") });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const refresh = () => qc.invalidateQueries({ queryKey: ["members"] });
  const invite = useMutation({
    mutationFn: () => api.post<{ invite_url: string; email_sent: boolean; email: string }>("/org/invitations", { email, role }),
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
      <Card title={t("settings.invite_title")}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input"
            type="email"
            placeholder={t("settings.email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={t("common.email")}
            style={{ minWidth: 240 }}
          />
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label={t("common.role")}
            options={[
              { value: "manager", label: t("settings.role_manager") },
              { value: "accountant", label: t("settings.role_accountant") },
              { value: "maintenance", label: t("settings.role_maintenance") },
            ]}
          />
          <button className="btn btn-primary" disabled={!email || invite.isPending} onClick={() => invite.mutate()}>
            <UserPlus size={15} /> {t("settings.send_invite")}
          </button>
        </div>
        {invite.data && (
          <div style={{ marginTop: 12 }}>
            <InviteLink url={invite.data.invite_url} emailSent={invite.data.email_sent} email={invite.data.email} />
          </div>
        )}
      </Card>
      <Card title={t("settings.members")} pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("common.email")}</th>
                <th>{t("common.role")}</th>
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
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ id: m.membership_id, role: e.target.value })}
                        options={["owner", "manager", "accountant", "maintenance"]}
                        aria-label={t("common.role")}
                      />
                    ) : (
                      <Badge value={m.role} />
                    )}
                  </td>
                  <td className="right">
                    {owner && m.user_id !== me?.id && (
                      <button
                        className="icon-btn"
                        aria-label={t("settings.remove_member", { name: m.name })}
                        onClick={() => window.confirm(t("settings.remove_member_confirm", { name: m.name })) && remove.mutate(m.membership_id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.invitations.map((i) => (
                <tr key={i.id}>
                  <td className="muted">{t("enums.invited")}</td>
                  <td>{i.email}</td>
                  <td>
                    <Badge value={i.role} />
                  </td>
                  <td className="right">
                    <button className="btn btn-sm btn-ghost" onClick={() => revoke.mutate(i.id)}>
                      {t("settings.revoke")}
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
  const { t, i18n } = useTranslation();
  const { me, setMe } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ name: me?.name ?? "", phone: me?.phone ?? "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const { data: prefs } = useQuery({ queryKey: ["prefs"], queryFn: () => api.get<Prefs>("/org/notification-preferences") });
  const saveProfile = useMutation({ mutationFn: () => api.patch<Me>("/auth/me", { name: profile.name, phone: profile.phone || null }), onSuccess: setMe });
  const changePw = useMutation({ mutationFn: () => api.post("/auth/change-password", pw), onSuccess: () => setPw({ current_password: "", new_password: "" }) });
  const savePrefs = useMutation({ mutationFn: (p: Prefs) => api.put("/org/notification-preferences", p), onSuccess: () => qc.invalidateQueries({ queryKey: ["prefs"] }) });
  const PREF_KEYS: (keyof Prefs)[] = ["rent_reminders", "maintenance_updates", "lease_expiry", "document_expiry"];
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <Card title={t("settings.profile")}>
        <div className="form">
          <ErrorBox error={saveProfile.error} />
          <Field label={t("common.name")}>
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </Field>
          <Field label={t("common.email")}>
            <Input value={me?.email} disabled />
          </Field>
          <Field label={t("common.phone")}>
            <Input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          {LANGUAGES.length > 1 && (
            <Field label={t("settings.language")}>
              <Select value={i18n.language} onChange={(e) => setLanguage(e.target.value)} options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} />
            </Field>
          )}
          <div>
            <button className="btn btn-primary" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {t("settings.save_profile")}
            </button>
          </div>
        </div>
      </Card>
      <div className="stack">
        <Card title={t("settings.email_notifications")}>
          {prefs ? (
            <div className="stack" style={{ gap: 8 }}>
              {PREF_KEYS.map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={prefs[k]} onChange={(e) => savePrefs.mutate({ ...prefs, [k]: e.target.checked })} /> {t(`settings.pref_${k}`)}
                </label>
              ))}
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
        <Card title={t("settings.change_password")}>
          <div className="form">
            <ErrorBox error={changePw.error} />
            {changePw.isSuccess && <div className="success-box">{t("settings.password_updated")}</div>}
            <Field label={t("settings.current_password")}>
              <Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </Field>
            <Field label={t("auth.newPassword")} hint={t("settings.password_hint")}>
              <Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <div>
              <button className="btn" onClick={() => changePw.mutate()} disabled={!pw.current_password || !pw.new_password || changePw.isPending}>
                {t("settings.update_password")}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuditLog() {
  const { t } = useTranslation();
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
          aria-label={t("settings.record_type")}
          options={[
            { value: "", label: t("settings.all_changes") },
            ...["property", "unit", "tenant", "lease", "payment", "expense", "work_order", "document", "membership", "organization", "automation"].map((x) => ({ value: x, label: label(x) })),
          ]}
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
                  <th>{t("settings.when")}</th>
                  <th>{t("settings.who")}</th>
                  <th>{t("settings.what")}</th>
                  <th>{t("settings.changes")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap small">{dateTime(a.created_at)}</td>
                    <td>{a.actor_name === "System" ? t("settings.system") : a.actor_name}</td>
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
                      {t("settings.no_activity")}
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
  const { t } = useTranslation();
  const { can } = useAuth();
  const isWriter = can("owner", "manager");
  type TabId = "org" | "team" | "payments" | "account" | "audit";
  const [params] = useSearchParams();
  const requested = params.get("tab") as TabId | null;
  const [tab, setTab] = useState<TabId>(requested && (isWriter || requested === "account") ? requested : isWriter ? "org" : "account");
  const tabs = [
    ...(isWriter
      ? [
          { id: "org" as const, label: t("settings.portfolio") },
          { id: "team" as const, label: t("settings.team") },
          { id: "payments" as const, label: t("settings.payments_tab") },
        ]
      : []),
    { id: "account" as const, label: t("settings.my_account") },
    ...(isWriter ? [{ id: "audit" as const, label: t("settings.audit_log") }] : []),
  ];
  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "org" && <OrgSettings />}
      {tab === "team" && <Team />}
      {tab === "payments" && <PaymentsSettingsTab />}
      {tab === "account" && <Account />}
      {tab === "audit" && <AuditLog />}
    </>
  );
}
