import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Archive, CalendarClock, HardHat, Mail, Pause, Pencil, Phone, Play, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property } from "../types";
import { DocumentsPanel } from "../components/Documents";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Stat, Textarea } from "../components/ui";
import { date, fromCents, label, money, toCents } from "../utils/format";
import { WO_CATEGORIES, WO_PRIORITIES } from "./MaintenancePages";

export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  trades: string[];
  hourly_rate_cents: number | null;
  call_out_fee_cents: number | null;
  license_number: string | null;
  w9_on_file: boolean;
  insurance_expires_on: string | null;
  insurance_status: "ok" | "expiring" | "expired" | null;
  notes: string | null;
  archived_at: string | null;
  rating: number | null;
  rating_count: number;
  job_count: number;
}

export function Stars({ value, onChange, size = 14 }: { value: number | null; onChange?: (v: number) => void; size?: number }) {
  const { t } = useTranslation();
  return (
    <span className="stars" role={onChange ? "radiogroup" : "img"} aria-label={value ? t("vendors.rating_of", { value }) : t("vendors.no_rating")}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t("vendors.stars", { count: n })} onClick={() => onChange(n)}>
            <Star size={size} className={value && n <= value ? "on" : ""} />
          </button>
        ) : (
          <Star key={n} size={size} className={value && n <= Math.round(value) ? "on" : ""} />
        ),
      )}
    </span>
  );
}

function InsuranceBadge({ v }: { v: Pick<Vendor, "insurance_status" | "insurance_expires_on"> }) {
  const { t } = useTranslation();
  if (!v.insurance_status) return <span className="small muted">{t("vendors.no_insurance")}</span>;
  const tone = v.insurance_status === "ok" ? "jade" : v.insurance_status === "expiring" ? "citrine" : "garnet";
  return <Badge tone={tone}>{t(`vendors.insurance_${v.insurance_status}`, { date: date(v.insurance_expires_on) })}</Badge>;
}

function VendorModal({ vendor, onClose }: { vendor?: Vendor; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: vendor?.name ?? "",
    contact_name: vendor?.contact_name ?? "",
    email: vendor?.email ?? "",
    phone: vendor?.phone ?? "",
    address: vendor?.address ?? "",
    trades: vendor?.trades ?? [],
    hourly: vendor?.hourly_rate_cents != null ? fromCents(vendor.hourly_rate_cents) : "",
    callout: vendor?.call_out_fee_cents != null ? fromCents(vendor.call_out_fee_cents) : "",
    license_number: vendor?.license_number ?? "",
    w9_on_file: vendor?.w9_on_file ?? false,
    insurance_expires_on: vendor?.insurance_expires_on ?? "",
    notes: vendor?.notes ?? "",
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        contact_name: f.contact_name || null,
        email: f.email || null,
        phone: f.phone || null,
        address: f.address || null,
        trades: f.trades,
        hourly_rate_cents: f.hourly ? toCents(f.hourly) : null,
        call_out_fee_cents: f.callout ? toCents(f.callout) : null,
        license_number: f.license_number || null,
        w9_on_file: f.w9_on_file,
        insurance_expires_on: f.insurance_expires_on || null,
        notes: f.notes || null,
      };
      return vendor ? api.patch(`/vendors/${vendor.id}`, body) : api.post("/vendors", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor"] });
      onClose();
    },
  });
  const toggleTrade = (c: string) => setF({ ...f, trades: f.trades.includes(c) ? f.trades.filter((x) => x !== c) : [...f.trades, c] });
  return (
    <Modal
      title={vendor ? t("vendors.edit") : t("vendors.add")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("vendors.company")}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus maxLength={160} />
          </Field>
          <Field label={t("vendors.contact")}>
            <Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} maxLength={120} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.email")}>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label={t("common.phone")}>
            <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </div>
        <div className="field">
          <span>{t("vendors.trades")}</span>
          <div className="chip-list">
            {WO_CATEGORIES.map((c) => (
              <label key={c} className="check small">
                <input type="checkbox" checked={f.trades.includes(c)} onChange={() => toggleTrade(c)} /> {label(c)}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row-3">
          <Field label={t("vendors.hourly_rate")}>
            <MoneyInput value={f.hourly} onChange={(hourly) => setF({ ...f, hourly })} />
          </Field>
          <Field label={t("vendors.call_out_fee")}>
            <MoneyInput value={f.callout} onChange={(callout) => setF({ ...f, callout })} />
          </Field>
          <Field label={t("vendors.license")}>
            <Input value={f.license_number} onChange={(e) => setF({ ...f, license_number: e.target.value })} maxLength={80} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("vendors.insurance_expires")} hint={t("vendors.insurance_hint")}>
            <Input type="date" value={f.insurance_expires_on} onChange={(e) => setF({ ...f, insurance_expires_on: e.target.value })} />
          </Field>
          <Field label={t("vendors.address")}>
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={300} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.w9_on_file} onChange={(e) => setF({ ...f, w9_on_file: e.target.checked })} /> {t("vendors.w9_on_file")}
        </label>
        <Field label={t("common.notes")}>
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={5000} />
        </Field>
      </div>
    </Modal>
  );
}

export function VendorsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [trade, setTrade] = useState("");
  const [archived, setArchived] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["vendors", trade, archived],
    queryFn: () => api.get<Vendor[]>(`/vendors?include_archived=${archived}${trade ? `&trade=${trade}` : ""}`),
  });
  const canEdit = can("owner", "manager");
  return (
    <>
      <PageHeader
        title={t("nav.vendors")}
        subtitle={t("vendors.subtitle")}
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> {t("vendors.add")}
            </button>
          )
        }
      />
      <div className="toolbar">
        <Select value={trade} onChange={(e) => setTrade(e.target.value)} options={[{ value: "", label: t("vendors.all_trades") }, ...WO_CATEGORIES.map((c) => ({ value: c, label: label(c) }))]} aria-label={t("vendors.trades")} />
        <label className="check small">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> {t("vendors.show_archived")}
        </label>
      </div>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<HardHat size={40} />} title={t("vendors.empty_title")} action={canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}>{t("vendors.add")}</button>}>
            {t("vendors.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("vendors.trades")}</th>
                  <th>{t("vendors.contact")}</th>
                  <th>{t("vendors.rating")}</th>
                  <th>{t("vendors.insurance")}</th>
                  <th className="num">{t("vendors.jobs")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((v) => (
                  <tr key={v.id} className={v.archived_at ? "voided" : ""}>
                    <td>
                      <Link to={`/vendors/${v.id}`} className="row-link">
                        {v.name}
                      </Link>
                      {v.w9_on_file && <span className="small muted"> · W-9</span>}
                    </td>
                    <td className="small">{v.trades.map(label).join(", ") || "—"}</td>
                    <td className="small">
                      {v.contact_name && <div>{v.contact_name}</div>}
                      {v.phone && <div className="muted">{v.phone}</div>}
                    </td>
                    <td>
                      {v.rating ? (
                        <span className="nowrap">
                          <Stars value={v.rating} /> <span className="small muted">({v.rating_count})</span>
                        </span>
                      ) : (
                        <span className="small muted">—</span>
                      )}
                    </td>
                    <td>
                      <InsuranceBadge v={v} />
                    </td>
                    <td className="num">{v.job_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {adding && <VendorModal onClose={() => setAdding(false)} />}
    </>
  );
}

interface VendorDetail extends Vendor {
  jobs: { id: string; number: number; title: string; status: string; property_name: string; created_at: string; vendor_rating: number | null }[];
  invoices: { id: string; invoice_number: string | null; amount_cents: number; invoice_date: string; status: string; work_order_id: string }[];
  total_billed_cents: number;
  unpaid_cents: number;
}

export function VendorDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { can, org } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: v, error, isLoading } = useQuery({ queryKey: ["vendor", id], queryFn: () => api.get<VendorDetail>(`/vendors/${id}`) });
  const archive = useMutation({
    mutationFn: (archived: boolean) => api.patch(`/vendors/${id}`, { archived }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
  if (isLoading) return <Spinner />;
  if (error || !v) return <ErrorBox error={error} />;
  const canEdit = can("owner", "manager");
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/vendors">{t("nav.vendors")}</Link>}
        title={
          <>
            {v.name} {v.archived_at && <Badge>{t("vendors.archived")}</Badge>}
          </>
        }
        subtitle={v.trades.map(label).join(" · ") || undefined}
        actions={
          canEdit && (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={15} /> {t("common.edit")}
              </button>
              <button className="btn btn-ghost" onClick={() => archive.mutate(!v.archived_at)}>
                <Archive size={15} /> {v.archived_at ? t("vendors.restore") : t("vendors.archive")}
              </button>
            </>
          )
        }
      />
      <div className="stack">
        <ErrorBox error={archive.error} />
        <div className="grid grid-4">
          <Stat label={t("vendors.jobs")} value={v.job_count} />
          <Stat label={t("vendors.rating")} value={v.rating ? <Stars value={v.rating} size={18} /> : "—"} sub={v.rating_count ? t("vendors.ratings_count", { count: v.rating_count }) : undefined} />
          <Stat label={t("vendors.total_billed")} value={money(v.total_billed_cents, org?.currency)} />
          <Stat label={t("vendors.unpaid")} value={money(v.unpaid_cents, org?.currency)} />
        </div>
        <div className="two-col">
          <div className="stack">
            <Card title={t("vendors.jobs")} pad={!v.jobs.length}>
              {v.jobs.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <tbody>
                      {v.jobs.map((j) => (
                        <tr key={j.id}>
                          <td>
                            <Link to={`/maintenance/${j.id}`} className="row-link">
                              #{j.number} {j.title}
                            </Link>
                            <div className="small muted">{j.property_name}</div>
                          </td>
                          <td>
                            <Badge value={j.status} />
                          </td>
                          <td>{j.vendor_rating ? <Stars value={j.vendor_rating} /> : null}</td>
                          <td className="small nowrap">{date(j.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">{t("vendors.no_jobs")}</p>
              )}
            </Card>
            <DocumentsPanel ownerType="vendor" ownerId={v.id} />
          </div>
          <div className="stack">
            <Card title={t("vendors.details")}>
              <dl className="dl small">
                {v.contact_name && (
                  <>
                    <dt>{t("vendors.contact")}</dt>
                    <dd>{v.contact_name}</dd>
                  </>
                )}
                {v.email && (
                  <>
                    <dt>{t("common.email")}</dt>
                    <dd>
                      <a href={`mailto:${v.email}`}>
                        <Mail size={12} /> {v.email}
                      </a>
                    </dd>
                  </>
                )}
                {v.phone && (
                  <>
                    <dt>{t("common.phone")}</dt>
                    <dd>
                      <a href={`tel:${v.phone}`}>
                        <Phone size={12} /> {v.phone}
                      </a>
                    </dd>
                  </>
                )}
                {v.address && (
                  <>
                    <dt>{t("vendors.address")}</dt>
                    <dd>{v.address}</dd>
                  </>
                )}
                <dt>{t("vendors.hourly_rate")}</dt>
                <dd>{v.hourly_rate_cents != null ? money(v.hourly_rate_cents) : "—"}</dd>
                <dt>{t("vendors.call_out_fee")}</dt>
                <dd>{v.call_out_fee_cents != null ? money(v.call_out_fee_cents) : "—"}</dd>
                <dt>{t("vendors.license")}</dt>
                <dd>{v.license_number || "—"}</dd>
                <dt>W-9</dt>
                <dd>{v.w9_on_file ? t("vendors.on_file") : t("vendors.missing")}</dd>
                <dt>{t("vendors.insurance")}</dt>
                <dd>
                  <InsuranceBadge v={v} />
                </dd>
              </dl>
              {v.notes && <p className="small" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{v.notes}</p>}
            </Card>
            <Card title={t("vendors.invoices")}>
              {v.invoices.length ? (
                <ul className="list-plain">
                  {v.invoices.map((i) => (
                    <li key={i.id}>
                      <Link to={`/maintenance/${i.work_order_id}`} className="small">
                        {i.invoice_number ? `#${i.invoice_number}` : t("vendors.invoice")} · {date(i.invoice_date)}
                      </Link>
                      <span className="nowrap">
                        <span className="mono">{money(i.amount_cents)}</span> <Badge value={i.status === "paid" ? "paid" : "pending"}>{t(`vendors.invoice_${i.status}`)}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t("vendors.no_invoices")}</p>
              )}
            </Card>
          </div>
        </div>
      </div>
      {editing && <VendorModal vendor={v} onClose={() => setEditing(false)} />}
    </>
  );
}

// ── Preventive maintenance schedules ─────────────────────────────────────────

interface Schedule {
  id: string;
  property_id: string;
  property_name: string;
  unit_id: string | null;
  unit_name: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  interval_months: number;
  next_due_on: string;
  lead_days: number;
  vendor_id: string | null;
  vendor_name: string | null;
  asset_name: string | null;
  active: boolean;
  last_work_order_id: string | null;
}

const INTERVALS = [1, 3, 6, 12, 24];
const PRESETS = [
  { title: "Replace HVAC filter", category: "hvac", interval: 3 },
  { title: "Service furnace / AC", category: "hvac", interval: 12 },
  { title: "Test smoke & CO detectors", category: "general", interval: 6 },
  { title: "Clean gutters", category: "roof", interval: 6 },
  { title: "Flush water heater", category: "plumbing", interval: 12 },
  { title: "Pest control", category: "pest", interval: 3 },
];

function ScheduleModal({ schedule, onClose }: { schedule?: Schedule; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const { data: vendors } = useQuery({ queryKey: ["vendors", "", false], queryFn: () => api.get<Vendor[]>("/vendors") });
  const [f, setF] = useState({
    property_id: schedule?.property_id ?? "",
    unit_id: schedule?.unit_id ?? "",
    title: schedule?.title ?? "",
    description: schedule?.description ?? "",
    category: schedule?.category ?? "general",
    priority: schedule?.priority ?? "low",
    interval_months: schedule?.interval_months ?? 12,
    next_due_on: schedule?.next_due_on ?? "",
    lead_days: schedule?.lead_days ?? 7,
    vendor_id: schedule?.vendor_id ?? "",
  });
  const prop = properties?.find((p) => p.id === (f.property_id || properties?.[0]?.id));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, property_id: f.property_id || prop?.id, unit_id: f.unit_id || null, vendor_id: f.vendor_id || null, description: f.description || null };
      if (schedule) {
        const { property_id: _p, ...rest } = body;
        void _p;
        return api.patch(`/maintenance-schedules/${schedule.id}`, rest);
      }
      return api.post("/maintenance-schedules", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onClose();
    },
  });
  return (
    <Modal
      title={schedule ? t("schedules.edit") : t("schedules.add")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.title.trim() || !f.next_due_on || !prop || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        {!schedule && (
          <div className="field">
            <span>{t("schedules.presets")}</span>
            <div className="chip-list">
              {PRESETS.map((p) => (
                <button key={p.title} type="button" className="btn btn-sm" onClick={() => setF({ ...f, title: p.title, category: p.category, interval_months: p.interval })}>
                  {t(`schedules.preset_${PRESETS.indexOf(p)}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="form-row">
          <Field label={t("schedules.task")}>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
          </Field>
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={WO_CATEGORIES.map((c) => ({ value: c, label: label(c) }))} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.property")}>
            <Select
              value={prop?.id ?? ""}
              disabled={!!schedule}
              onChange={(e) => setF({ ...f, property_id: e.target.value, unit_id: "" })}
              options={(properties ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label={t("common.unit")}>
            <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} options={[{ value: "", label: t("schedules.whole_property") }, ...(prop?.units ?? []).map((u) => ({ value: u.id, label: u.name }))]} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("schedules.every")}>
            <Select value={String(f.interval_months)} onChange={(e) => setF({ ...f, interval_months: Number(e.target.value) })} options={INTERVALS.map((m) => ({ value: String(m), label: t("schedules.months", { count: m }) }))} />
          </Field>
          <Field label={t("schedules.next_due")}>
            <Input type="date" value={f.next_due_on} onChange={(e) => setF({ ...f, next_due_on: e.target.value })} />
          </Field>
          <Field label={t("schedules.lead_days")} hint={t("schedules.lead_hint")}>
            <Input type="number" min={0} max={90} value={f.lead_days} onChange={(e) => setF({ ...f, lead_days: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("schedules.vendor")}>
            <Select value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })} options={[{ value: "", label: t("schedules.no_vendor") }, ...(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))]} />
          </Field>
          <Field label={t("maintenance.priority")}>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={WO_PRIORITIES.map((p) => ({ value: p, label: label(p) }))} />
          </Field>
        </div>
        <Field label={t("common.description")}>
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}

export function SchedulesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const [modal, setModal] = useState<{ schedule?: Schedule } | null>(null);
  const { data, error, isLoading } = useQuery({ queryKey: ["schedules"], queryFn: () => api.get<Schedule[]>("/maintenance-schedules") });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["schedules"] });
    qc.invalidateQueries({ queryKey: ["work-orders"] });
  };
  const run = useMutation({ mutationFn: (id: string) => api.post<{ number: number; work_order_id: string }>(`/maintenance-schedules/${id}/run-now`), onSuccess: refresh });
  const toggle = useMutation({ mutationFn: (s: Schedule) => api.patch(`/maintenance-schedules/${s.id}`, { active: !s.active }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/maintenance-schedules/${id}`), onSuccess: refresh });
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/maintenance">{t("nav.maintenance")}</Link>}
        title={t("schedules.title")}
        subtitle={t("schedules.subtitle")}
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={() => setModal({})}>
              <Plus size={16} /> {t("schedules.add")}
            </button>
          )
        }
      />
      <ErrorBox error={error || run.error || toggle.error || remove.error} />
      {run.data && (
        <div className="success-box" style={{ marginBottom: 16 }}>
          {t("schedules.created")} <Link to={`/maintenance/${run.data.work_order_id}`}>#{run.data.number}</Link>
        </div>
      )}
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<CalendarClock size={40} />} title={t("schedules.empty_title")} action={canEdit && <button className="btn btn-primary" onClick={() => setModal({})}>{t("schedules.add")}</button>}>
            {t("schedules.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("schedules.task")}</th>
                  <th>{t("common.property")}</th>
                  <th>{t("schedules.every")}</th>
                  <th>{t("schedules.next_due")}</th>
                  <th>{t("schedules.vendor")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "voided"}>
                    <td>
                      <strong>{s.title}</strong>
                      <div className="small muted">
                        {label(s.category)}
                        {s.asset_name ? ` · ${s.asset_name}` : ""}
                        {!s.active ? ` · ${t("schedules.paused")}` : ""}
                      </div>
                    </td>
                    <td className="small">
                      {s.property_name}
                      {s.unit_name ? ` · ${s.unit_name}` : ""}
                    </td>
                    <td className="small">{t("schedules.months", { count: s.interval_months })}</td>
                    <td className="nowrap">
                      {date(s.next_due_on)}
                      <div className="small muted">{t("schedules.opens", { count: s.lead_days })}</div>
                    </td>
                    <td className="small">{s.vendor_name ?? "—"}</td>
                    <td className="right nowrap">
                      {canEdit && (
                        <>
                          <button className="btn btn-sm" onClick={() => run.mutate(s.id)} disabled={run.isPending} title={t("schedules.run_now_hint")}>
                            <Play size={13} /> {t("schedules.run_now")}
                          </button>{" "}
                          <button className="icon-btn" onClick={() => toggle.mutate(s)} aria-label={s.active ? t("schedules.pause") : t("schedules.resume")} title={s.active ? t("schedules.pause") : t("schedules.resume")}>
                            {s.active ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button className="icon-btn" onClick={() => setModal({ schedule: s })} aria-label={t("common.edit")}>
                            <Pencil size={14} />
                          </button>
                          <button className="icon-btn" onClick={() => window.confirm(t("schedules.delete_confirm", { title: s.title })) && remove.mutate(s.id)} aria-label={t("common.delete")}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {modal && <ScheduleModal schedule={modal.schedule} onClose={() => setModal(null)} />}
    </>
  );
}
