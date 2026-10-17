import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Mail, Phone, Plus, Send, Trash2, Users, Pencil } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Tenant } from "../types";
import { DocumentsPanel } from "../components/Documents";
import { Badge, BalanceText, Card, Empty, ErrorBox, Field, Input, InviteLink, Modal, PageHeader, Spinner, Textarea } from "../components/ui";
import { date, money } from "../utils/format";

type TenantForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vehicles: string;
  pets: string;
  notes: string;
};

const toLines = (items: Record<string, string>[]) => items.map((i) => i.description ?? Object.values(i).join(" ")).join("\n");
const fromLines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((description) => ({ description }));

export function TenantFormModal({ tenant, onClose, onSaved }: { tenant?: Tenant; onClose: () => void; onSaved?: (t: Tenant) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState<TenantForm>({
    first_name: tenant?.first_name ?? "",
    last_name: tenant?.last_name ?? "",
    email: tenant?.email ?? "",
    phone: tenant?.phone ?? "",
    emergency_contact_name: tenant?.emergency_contact_name ?? "",
    emergency_contact_phone: tenant?.emergency_contact_phone ?? "",
    vehicles: toLines(tenant?.vehicles ?? []),
    pets: toLines(tenant?.pets ?? []),
    notes: tenant?.notes ?? "",
  });
  const set = (k: keyof TenantForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        email: f.email || null,
        phone: f.phone || null,
        emergency_contact_name: f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        notes: f.notes || null,
        vehicles: fromLines(f.vehicles),
        pets: fromLines(f.pets),
      };
      return tenant ? api.patch<Tenant>(`/tenants/${tenant.id}`, body) : api.post<Tenant>("/tenants", body);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant", saved.id] });
      onSaved?.(saved);
      onClose();
    },
  });
  return (
    <Modal
      title={tenant ? t("tenants.edit_title") : t("tenants.add")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.first_name || !f.last_name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("tenants.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("tenants.first_name")}>
            <Input value={f.first_name} onChange={set("first_name")} autoFocus />
          </Field>
          <Field label={t("tenants.last_name")}>
            <Input value={f.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.email")} hint={t("tenants.email_hint")}>
            <Input type="email" value={f.email} onChange={set("email")} />
          </Field>
          <Field label={t("common.phone")}>
            <Input type="tel" value={f.phone} onChange={set("phone")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("tenants.emergency_contact")}>
            <Input value={f.emergency_contact_name} onChange={set("emergency_contact_name")} />
          </Field>
          <Field label={t("tenants.emergency_phone")}>
            <Input type="tel" value={f.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("tenants.vehicles")} hint={t("tenants.one_per_line")}>
            <Textarea value={f.vehicles} onChange={set("vehicles")} placeholder={t("tenants.vehicles_placeholder")} />
          </Field>
          <Field label={t("tenants.pets")} hint={t("tenants.one_per_line")}>
            <Textarea value={f.pets} onChange={set("pets")} placeholder={t("tenants.pets_placeholder")} />
          </Field>
        </div>
        <Field label={t("common.notes")} hint={t("tenants.notes_hint")}>
          <Textarea value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export function TenantsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data, error, isLoading } = useQuery({ queryKey: ["tenants"], queryFn: () => api.get<Tenant[]>("/tenants") });
  const canEdit = can("owner", "manager");
  const filtered = (data ?? []).filter((tn) => `${tn.first_name} ${tn.last_name} ${tn.email ?? ""} ${tn.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title={t("nav.tenants")}
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> {t("tenants.add")}
            </button>
          )
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty
            icon={<Users size={40} />}
            title={t("tenants.empty_title")}
            action={
              canEdit && (
                <button className="btn btn-primary" onClick={() => setAdding(true)}>
                  {t("tenants.add")}
                </button>
              )
            }
          >
            {t("tenants.empty_body")}
          </Empty>
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <input className="input" placeholder={t("tenants.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("tenants.search")} />
          </div>
          <Card pad={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("common.name")}</th>
                    <th>{t("tenants.contact")}</th>
                    <th>{t("tenants.current_lease")}</th>
                    <th>{t("tenants.portal")}</th>
                    <th className="num">{t("common.balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tn) => (
                    <tr key={tn.id} onClick={() => navigate(`/tenants/${tn.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <Link to={`/tenants/${tn.id}`} className="row-link">
                          {tn.first_name} {tn.last_name}
                        </Link>
                      </td>
                      <td className="small">
                        {tn.email && <div>{tn.email}</div>}
                        {tn.phone && <div className="muted">{tn.phone}</div>}
                      </td>
                      <td className="small">{tn.current_lease ? `${tn.current_lease.property_name} · ${tn.current_lease.unit_name}` : <span className="muted">—</span>}</td>
                      <td>{tn.user_id ? <Badge value="active" /> : <span className="muted small">—</span>}</td>
                      <td className="num">{tn.current_lease ? <BalanceText cents={tn.current_lease.balance_cents} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {adding && <TenantFormModal onClose={() => setAdding(false)} onSaved={(saved) => navigate(`/tenants/${saved.id}`)} />}
    </>
  );
}

export function TenantDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const canEdit = can("owner", "manager");
  const { data: tenant, error, isLoading } = useQuery({ queryKey: ["tenant", id], queryFn: () => api.get<Tenant>(`/tenants/${id}`) });
  const invite = useMutation({
    mutationFn: () => api.post<{ invite_url: string; email_sent: boolean }>(`/tenants/${id}/invite`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", id] }),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/tenants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      navigate("/tenants");
    },
  });
  if (isLoading) return <Spinner />;
  if (error || !tenant) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/tenants">{t("nav.tenants")}</Link>}
        title={`${tenant.first_name} ${tenant.last_name}`}
        actions={
          canEdit && (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={15} /> {t("common.edit")}
              </button>
              {(tenant.leases?.length ?? 0) === 0 && (
                <button className="btn btn-danger" aria-label={t("common.delete")} onClick={() => window.confirm(t("tenants.delete_confirm")) && remove.mutate()}>
                  <Trash2 size={15} />
                </button>
              )}
            </>
          )
        }
      />
      <div className="stack">
        <ErrorBox error={invite.error || remove.error} />
        <div className="two-col">
          <div className="stack">
            <Card
              title={t("nav.leases")}
              actions={
                canEdit && (
                  <Link className="btn btn-sm" to={`/leases/new?tenant=${tenant.id}`}>
                    <Plus size={14} /> {t("leases.new")}
                  </Link>
                )
              }
              pad={false}
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("common.unit")}</th>
                      <th>{t("leases.term")}</th>
                      <th>{t("common.status")}</th>
                      <th className="num">{t("common.rent")}</th>
                      <th className="num">{t("common.balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.leases?.map((l) => (
                      <tr key={l.lease_id}>
                        <td>
                          <Link to={`/leases/${l.lease_id}`} className="row-link">
                            {l.property_name} · {l.unit_name}
                          </Link>
                        </td>
                        <td className="small">
                          {date(l.start_date)} – {l.end_date ? date(l.end_date) : t("common.month_to_month")}
                        </td>
                        <td>
                          <Badge value={l.status} />
                        </td>
                        <td className="num">{money(l.rent_cents)}</td>
                        <td className="num">
                          <BalanceText cents={l.balance_cents} />
                        </td>
                      </tr>
                    ))}
                    {tenant.leases?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="muted">
                          {t("tenants.no_lease")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <DocumentsPanel ownerType="tenant" ownerId={tenant.id} allowTenantShare />
          </div>
          <div className="stack">
            <Card title={t("tenants.contact")}>
              <dl className="dl">
                <dt>
                  <Mail size={14} aria-label={t("common.email")} />
                </dt>
                <dd>{tenant.email ? <a href={`mailto:${tenant.email}`}>{tenant.email}</a> : "—"}</dd>
                <dt>
                  <Phone size={14} aria-label={t("common.phone")} />
                </dt>
                <dd>{tenant.phone ? <a href={`tel:${tenant.phone}`}>{tenant.phone}</a> : "—"}</dd>
                <dt>{t("tenants.emergency")}</dt>
                <dd>
                  {tenant.emergency_contact_name || "—"} {tenant.emergency_contact_phone && <span className="muted">· {tenant.emergency_contact_phone}</span>}
                </dd>
                <dt>{t("tenants.vehicles")}</dt>
                <dd>{tenant.vehicles.length ? tenant.vehicles.map((v, i) => <div key={i}>{v.description}</div>) : "—"}</dd>
                <dt>{t("tenants.pets")}</dt>
                <dd>{tenant.pets.length ? tenant.pets.map((v, i) => <div key={i}>{v.description}</div>) : "—"}</dd>
              </dl>
              {tenant.notes && (
                <p className="small muted" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {tenant.notes}
                </p>
              )}
            </Card>
            <Card title={t("tenants.portal_title")}>
              {tenant.portal_status === "active" ? (
                <p>
                  <Badge value="active" /> {t("tenants.portal_active", { name: tenant.first_name })}
                </p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <p className="muted">{tenant.portal_status === "invited" ? t("tenants.portal_invited") : t("tenants.portal_none")}</p>
                  {canEdit && (
                    <button className="btn" disabled={!tenant.email || invite.isPending} onClick={() => invite.mutate()}>
                      <Send size={14} /> {tenant.portal_status === "invited" ? t("tenants.resend_invite") : t("tenants.invite")}
                    </button>
                  )}
                  {!tenant.email && <p className="small muted">{t("tenants.add_email_first")}</p>}
                  {invite.data && <InviteLink url={invite.data.invite_url} emailSent={invite.data.email_sent} email={tenant.email} />}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
      {editing && <TenantFormModal tenant={tenant} onClose={() => setEditing(false)} />}
    </>
  );
}
