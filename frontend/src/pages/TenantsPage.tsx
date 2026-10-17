import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Phone, Plus, Send, Trash2, Users } from "lucide-react";
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
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant", t.id] });
      onSaved?.(t);
      onClose();
    },
  });
  return (
    <Modal
      title={tenant ? "Edit tenant" : "Add tenant"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!f.first_name || !f.last_name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save tenant"}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label="First name">
            <Input value={f.first_name} onChange={set("first_name")} autoFocus />
          </Field>
          <Field label="Last name">
            <Input value={f.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Email" hint="needed for receipts, reminders and portal">
            <Input type="email" value={f.email} onChange={set("email")} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={f.phone} onChange={set("phone")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Emergency contact">
            <Input value={f.emergency_contact_name} onChange={set("emergency_contact_name")} />
          </Field>
          <Field label="Emergency phone">
            <Input type="tel" value={f.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Vehicles" hint="one per line">
            <Textarea value={f.vehicles} onChange={set("vehicles")} placeholder="Blue Honda Civic · ABC-1234" />
          </Field>
          <Field label="Pets" hint="one per line">
            <Textarea value={f.pets} onChange={set("pets")} placeholder="Dog · Max · 30 lb" />
          </Field>
        </div>
        <Field label="Notes" hint="private — never shown to the tenant">
          <Textarea value={f.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export function TenantsPage() {
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data, error, isLoading } = useQuery({ queryKey: ["tenants"], queryFn: () => api.get<Tenant[]>("/tenants") });
  const canEdit = can("owner", "manager");
  const filtered = (data ?? []).filter((t) => `${t.first_name} ${t.last_name} ${t.email ?? ""} ${t.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Tenants"
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add tenant
            </button>
          )
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<Users size={40} />} title="No tenants yet" action={canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}>Add tenant</button>}>
            Add your tenants, then create a lease to link them to a unit.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <input className="input" placeholder="Search tenants…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tenants" />
          </div>
          <Card pad={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Current lease</th>
                    <th>Portal</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} onClick={() => navigate(`/tenants/${t.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <Link to={`/tenants/${t.id}`} className="row-link">
                          {t.first_name} {t.last_name}
                        </Link>
                      </td>
                      <td className="small">
                        {t.email && <div>{t.email}</div>}
                        {t.phone && <div className="muted">{t.phone}</div>}
                      </td>
                      <td className="small">{t.current_lease ? `${t.current_lease.property_name} · ${t.current_lease.unit_name}` : <span className="muted">—</span>}</td>
                      <td>{t.user_id ? <Badge value="active">Active</Badge> : <span className="muted small">—</span>}</td>
                      <td className="num">{t.current_lease ? <BalanceText cents={t.current_lease.balance_cents} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {adding && <TenantFormModal onClose={() => setAdding(false)} onSaved={(t) => navigate(`/tenants/${t.id}`)} />}
    </>
  );
}

export function TenantDetailPage() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const canEdit = can("owner", "manager");
  const { data: t, error, isLoading } = useQuery({ queryKey: ["tenant", id], queryFn: () => api.get<Tenant>(`/tenants/${id}`) });
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
  if (error || !t) return <ErrorBox error={error} />;

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/tenants">Tenants</Link>}
        title={`${t.first_name} ${t.last_name}`}
        actions={
          canEdit && (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={15} /> Edit
              </button>
              {(t.leases?.length ?? 0) === 0 && (
                <button className="btn btn-danger" onClick={() => window.confirm("Delete this tenant?") && remove.mutate()}>
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
              title="Leases"
              actions={
                canEdit && (
                  <Link className="btn btn-sm" to={`/leases/new?tenant=${t.id}`}>
                    <Plus size={14} /> New lease
                  </Link>
                )
              }
              pad={false}
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Term</th>
                      <th>Status</th>
                      <th className="num">Rent</th>
                      <th className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.leases?.map((l) => (
                      <tr key={l.lease_id}>
                        <td>
                          <Link to={`/leases/${l.lease_id}`} className="row-link">
                            {l.property_name} · {l.unit_name}
                          </Link>
                        </td>
                        <td className="small">
                          {date(l.start_date)} – {l.end_date ? date(l.end_date) : "month-to-month"}
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
                    {t.leases?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="muted">
                          Not on a lease yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <DocumentsPanel ownerType="tenant" ownerId={t.id} allowTenantShare />
          </div>
          <div className="stack">
            <Card title="Contact">
              <dl className="dl">
                <dt>
                  <Mail size={14} />
                </dt>
                <dd>{t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : "—"}</dd>
                <dt>
                  <Phone size={14} />
                </dt>
                <dd>{t.phone ? <a href={`tel:${t.phone}`}>{t.phone}</a> : "—"}</dd>
                <dt>Emergency</dt>
                <dd>
                  {t.emergency_contact_name || "—"} {t.emergency_contact_phone && <span className="muted">· {t.emergency_contact_phone}</span>}
                </dd>
                <dt>Vehicles</dt>
                <dd>{t.vehicles.length ? t.vehicles.map((v, i) => <div key={i}>{v.description}</div>) : "—"}</dd>
                <dt>Pets</dt>
                <dd>{t.pets.length ? t.pets.map((v, i) => <div key={i}>{v.description}</div>) : "—"}</dd>
              </dl>
              {t.notes && <p className="small muted" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{t.notes}</p>}
            </Card>
            <Card title="Tenant portal">
              {t.portal_status === "active" ? (
                <p>
                  <Badge value="active">Active</Badge> {t.first_name} can sign in to see their balance and submit requests.
                </p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <p className="muted">
                    {t.portal_status === "invited" ? "Invitation sent — waiting for the tenant to accept." : "Invite the tenant to view their lease, payments and submit maintenance requests."}
                  </p>
                  {canEdit && (
                    <button className="btn" disabled={!t.email || invite.isPending} onClick={() => invite.mutate()}>
                      <Send size={14} /> {t.portal_status === "invited" ? "Resend invitation" : "Invite to portal"}
                    </button>
                  )}
                  {!t.email && <p className="small muted">Add an email address first.</p>}
                  {invite.data && <InviteLink url={invite.data.invite_url} emailSent={invite.data.email_sent} email={t.email} />}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
      {editing && <TenantFormModal tenant={t} onClose={() => setEditing(false)} />}
    </>
  );
}
