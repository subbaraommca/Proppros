import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LogIn, ShieldCheck } from "lucide-react";
import { api, setOrgId } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Badge, Card, Empty, ErrorBox, PageHeader, Select, Spinner, Stat, Tabs } from "../components/ui";
import { date, dateTime, label } from "../utils/format";

interface Overview {
  organizations: number;
  users: number;
  units: number;
  active_leases: number;
  payments_30d: number;
  new_feedback: number;
  billing_active: boolean;
}
interface AdminOrg {
  id: string;
  name: string;
  owner_email: string | null;
  plan: string;
  effective_plan: string;
  plan_comped: boolean;
  subscription_status: string;
  units: number;
  members: number;
  properties: number;
  online_payments: boolean;
  created_at: string;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  superadmin: boolean;
  mfa_enabled: boolean;
  created_at: string;
  organizations: { name: string; role: string }[];
}
interface FeedbackItem {
  id: string;
  kind: string;
  message: string;
  page: string | null;
  status: string;
  created_at: string;
  user_name: string;
  user_email: string;
}

function OrgsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-orgs", q], queryFn: () => api.get<AdminOrg[]>(`/admin/orgs?q=${encodeURIComponent(q)}`) });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminOrg> }) => api.patch(`/admin/orgs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orgs"] }),
  });
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <input className="input" placeholder={t("admin.search_orgs")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("admin.search_orgs")} />
      </div>
      <ErrorBox error={error || update.error} />
      {isLoading ? (
        <Spinner />
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("enums.organization")}</th>
                  <th>{t("enums.owner")}</th>
                  <th className="num">{t("properties.units")}</th>
                  <th className="num">{t("admin.members")}</th>
                  <th>{t("admin.plan")}</th>
                  <th>{t("admin.comped")}</th>
                  <th>{t("admin.created")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.name}</strong>
                      {o.online_payments && (
                        <div>
                          <Badge tone="lapis">{t("online.title")}</Badge>
                        </div>
                      )}
                    </td>
                    <td className="small">{o.owner_email ?? "—"}</td>
                    <td className="num">{o.units}</td>
                    <td className="num">{o.members}</td>
                    <td>
                      <Select
                        value={o.plan}
                        onChange={(e) => update.mutate({ id: o.id, body: { plan: e.target.value } })}
                        options={["free", "pro", "business"].map((p) => ({ value: p, label: t(`plans.${p}`) }))}
                        aria-label={t("admin.plan")}
                      />
                      <div className="small muted">
                        {t("admin.effective", { plan: t(`plans.${o.effective_plan}`) })} · {label(o.subscription_status)}
                      </div>
                    </td>
                    <td>
                      <input type="checkbox" checked={o.plan_comped} onChange={(e) => update.mutate({ id: o.id, body: { plan_comped: e.target.checked } })} aria-label={t("admin.comped")} />
                    </td>
                    <td className="small nowrap">{date(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const { setMe } = useAuth();
  const [q, setQ] = useState("");
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-users", q], queryFn: () => api.get<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`) });
  const impersonate = useMutation({
    mutationFn: (id: string) => api.post<Parameters<typeof setMe>[0]>(`/admin/impersonate/${id}`),
    onSuccess: (me) => {
      setOrgId(me.organizations[0]?.id ?? null);
      window.location.assign(me.organizations[0]?.role === "tenant" ? "/portal" : "/");
    },
  });
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <input className="input" placeholder={t("admin.search_users")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("admin.search_users")} />
      </div>
      <p className="small muted">{t("admin.impersonate_note")}</p>
      <ErrorBox error={error || impersonate.error} />
      {isLoading ? (
        <Spinner />
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("common.email")}</th>
                  <th>{t("admin.organizations")}</th>
                  <th>{t("admin.joined")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name} {u.superadmin && <Badge tone="carnelian">{t("admin.admin_badge")}</Badge>} {u.mfa_enabled && <ShieldCheck size={13} aria-label={t("settings.mfa_on")} />}
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">{u.organizations.map((o) => `${o.name} (${label(o.role)})`).join(", ") || "—"}</td>
                    <td className="small nowrap">{date(u.created_at)}</td>
                    <td className="right">
                      {!u.superadmin && (
                        <button className="btn btn-sm" onClick={() => window.confirm(t("admin.impersonate_confirm", { email: u.email })) && impersonate.mutate(u.id)}>
                          <LogIn size={13} /> {t("admin.impersonate")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FeedbackTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState("new");
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-feedback", status], queryFn: () => api.get<FeedbackItem[]>(`/admin/feedback${status ? `?status=${status}` : ""}`) });
  const update = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api.patch(`/admin/feedback/${id}`, { status: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-feedback"] }),
  });
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t("common.status")}
          options={[
            { value: "new", label: t("enums.new") },
            { value: "reviewed", label: t("admin.reviewed") },
            { value: "done", label: t("admin.done") },
            { value: "", label: t("common.all") },
          ]}
        />
      </div>
      <ErrorBox error={error || update.error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty title={t("admin.no_feedback")} />
        </Card>
      ) : (
        data?.map((f) => (
          <Card key={f.id}>
            <div className="comment-meta">
              <Badge tone={f.kind === "bug" ? "garnet" : f.kind === "idea" ? "lapis" : ""}>{t(`help.kind_${f.kind}`)}</Badge>
              <strong>{f.user_name}</strong>
              <span>{f.user_email}</span>
              <span>{dateTime(f.created_at)}</span>
              {f.page && <span className="mono">{f.page}</span>}
            </div>
            <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 12px" }}>{f.message}</p>
            <div className="actions">
              {["reviewed", "done"].map((s) => (
                <button key={s} className="btn btn-sm" disabled={f.status === s || update.isPending} onClick={() => update.mutate({ id: f.id, s })}>
                  {t(`admin.mark_${s}`)}
                </button>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"overview" | "orgs" | "users" | "feedback">("overview");
  const { data, error } = useQuery({ queryKey: ["admin-overview"], queryFn: () => api.get<Overview>("/admin/overview") });
  return (
    <>
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("admin.overview") },
          { id: "orgs", label: t("admin.organizations") },
          { id: "users", label: t("admin.users") },
          { id: "feedback", label: data?.new_feedback ? `${t("admin.feedback")} (${data.new_feedback})` : t("admin.feedback") },
        ]}
      />
      <ErrorBox error={error} />
      {tab === "overview" && data && (
        <div className="stack">
          <div className="grid grid-3">
            <Stat label={t("admin.organizations")} value={data.organizations} />
            <Stat label={t("admin.users")} value={data.users} />
            <Stat label={t("properties.units")} value={data.units} />
            <Stat label={t("admin.active_leases")} value={data.active_leases} />
            <Stat label={t("admin.payments_30d")} value={data.payments_30d} />
            <Stat label={t("admin.new_feedback")} value={data.new_feedback} />
          </div>
          <div className={data.billing_active ? "success-box" : "info-box"}>{data.billing_active ? t("admin.billing_on") : t("admin.billing_off")}</div>
        </div>
      )}
      {tab === "orgs" && <OrgsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "feedback" && <FeedbackTab />}
    </>
  );
}
