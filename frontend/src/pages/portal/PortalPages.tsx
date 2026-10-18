import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, FileDown, FolderOpen, Plus, Upload, Wrench } from "lucide-react";
import { api, fileUrl } from "../../services/api";
import type { DocumentRow, Lease, LedgerRow, Payment, WorkOrder } from "../../types";
import { DocIcon } from "../../components/Documents";
import { PendingSignatures, PortalRenewalCard } from "../../components/PortalLeasing";
import { InsuranceCard, MoveOutCard, PortalUpdates } from "./PortalComms";
import { PortalPayActions, PaymentBadges, usePortalPayOptions } from "../../components/OnlinePayments";
import { Badge, BalanceText, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { date, dateTime, fileSize, label, money, ordinal } from "../../utils/format";
import { WO_CATEGORIES } from "../MaintenancePages";

interface PortalLease extends Lease {
  next_due_date: string | null;
  documents?: DocumentRow[];
}
interface Home {
  tenant_name: string;
  organization: string;
  leases: PortalLease[];
  recent_payments: Payment[];
  open_requests: number;
}

export function PortalHomePage() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-home"], queryFn: () => api.get<Home>("/portal/home") });
  const payEnabled = usePortalPayOptions().data?.enabled ?? false;
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const active = data.leases.filter((l) => l.status === "active");
  const params = new URLSearchParams(window.location.search);
  const flash = params.get("payment") === "success" ? "payment_success" : params.get("payment") === "cancelled" ? "payment_cancelled" : params.get("autopay") === "on" ? "autopay_enabled" : null;
  return (
    <>
      <PageHeader title={t("portal.welcome", { name: data.tenant_name })} subtitle={data.organization} />
      <div className="stack">
        {flash && <div className={flash === "payment_cancelled" ? "info-box" : "success-box"}>{t(`online.${flash}`)}</div>}
        <PendingSignatures />
        <PortalUpdates />
        {data.leases.length === 0 && (
          <Card>
            <Empty title={t("portal.no_lease_title")}>{t("portal.no_lease_body")}</Empty>
          </Card>
        )}
        {active.map((l) => (
          <div key={l.id} className="card card-glow balance-hero">
            <div>
              <div className="stat-label">
                {t("portal.balance")} · {l.property?.name} {l.unit?.name !== "Main" ? `· ${l.unit?.name}` : ""}
              </div>
              <div className="amount">
                <BalanceText cents={l.balance_cents} />
              </div>
              <div className="muted">
                {l.next_due_date ? (
                  <>
                    <CalendarDays size={13} /> {t("portal.next_due_line", { amount: money(l.monthly_total_cents), date: date(l.next_due_date) })}
                  </>
                ) : (
                  t("portal.no_upcoming")
                )}
              </div>
            </div>
            <div className="stack" style={{ gap: 10, alignItems: "end" }}>
              <PortalPayActions leaseId={l.id} />
              <div className="actions">
                <Link className="btn" to={`/portal/leases/${l.id}`}>
                  {t("portal.view_statement")}
                </Link>
                <Link className="btn" to="/portal/maintenance?new=1">
                  <Wrench size={15} /> {t("portal.request_maintenance")}
                </Link>
              </div>
            </div>
          </div>
        ))}
        <div className="grid grid-2">
          <Card
            title={t("portal.recent_payments")}
            actions={
              <Link to="/portal/payments" className="small">
                {t("common.all_link")}
              </Link>
            }
          >
            {data.recent_payments.length === 0 ? (
              <p className="muted">{t("payments.empty_title")}.</p>
            ) : (
              <ul className="list-plain">
                {data.recent_payments.map((p) => (
                  <li key={p.id}>
                    <span>
                      {date(p.received_on)} <span className="muted small">· {label(p.method)}</span>
                    </span>
                    <span className="mono">{money(p.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!payEnabled && (
              <p className="small muted" style={{ marginTop: 12 }}>
                {t("portal.pay_as_usual")}
              </p>
            )}
          </Card>
          <Card
            title={t("portal.requests")}
            actions={
              <Link to="/portal/maintenance" className="small">
                {t("common.all_link")}
              </Link>
            }
          >
            <p>{t("portal.open_requests", { count: data.open_requests })}</p>
          </Card>
        </div>
        {data.leases
          .filter((l) => l.status !== "active")
          .map((l) => (
            <Card key={l.id} title={t("portal.past_lease", { property: l.property?.name })}>
              <p className="muted">
                {date(l.start_date)} – {date(l.ended_on ?? l.end_date)} · {t("common.balance")} <BalanceText cents={l.balance_cents} /> ·{" "}
                <Link to={`/portal/leases/${l.id}`}>{t("portal.statement")}</Link>
              </p>
            </Card>
          ))}
      </div>
    </>
  );
}

export function PortalLeasePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const lease = useQuery({ queryKey: ["portal-lease", id], queryFn: () => api.get<PortalLease>(`/portal/leases/${id}`) });
  const ledger = useQuery({ queryKey: ["portal-ledger", id], queryFn: () => api.get<LedgerRow[]>(`/portal/leases/${id}/ledger`) });
  if (lease.isLoading) return <Spinner />;
  if (lease.error || !lease.data) return <ErrorBox error={lease.error} />;
  const l = lease.data;
  return (
    <>
      <PageHeader breadcrumb={<Link to="/portal">{t("nav.home")}</Link>} title={`${l.property?.name} · ${l.unit?.name}`} subtitle={l.property?.address} />
      <div className="stack">
        <div className="grid grid-3">
          <div className="card stat">
            <div className="stat-label">{t("common.balance")}</div>
            <div className="stat-value">
              <BalanceText cents={l.balance_cents} />
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("leases.monthly")}</div>
            <div className="stat-value">{money(l.monthly_total_cents)}</div>
            <div className="stat-sub">{t("portal.due_on_the", { day: ordinal(l.due_day) })}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("portal.lease_term")}</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {date(l.start_date)} – {l.end_date ? date(l.end_date) : t("common.month_to_month")}
            </div>
          </div>
        </div>
        {l.status === "active" && <PortalRenewalCard leaseId={l.id} currentRent={l.rent_cents} />}
        {l.status === "active" && (
          <div className="grid grid-2">
            <InsuranceCard />
            <MoveOutCard leaseId={l.id} endDate={l.end_date} />
          </div>
        )}
        <Card title={t("portal.statement_title")} pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("common.description")}</th>
                  <th className="num">{t("ledger.charges")}</th>
                  <th className="num">{t("ledger.payments")}</th>
                  <th className="num">{t("common.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {[...(ledger.data ?? [])].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{date(r.entry_date)}</td>
                    <td>{r.description}</td>
                    <td className="num">{r.amount_cents > 0 ? money(r.amount_cents) : ""}</td>
                    <td className="num success-text">{r.amount_cents < 0 ? money(-r.amount_cents) : ""}</td>
                    <td className="num">{money(r.balance_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {l.documents && l.documents.length > 0 && (
          <Card title={t("portal.lease_documents")}>
            <PortalDocList docs={l.documents} />
          </Card>
        )}
      </div>
    </>
  );
}

function PortalDocList({ docs }: { docs: DocumentRow[] }) {
  return (
    <div className="doc-list">
      {docs.map((d) => (
        <div className="doc-row" key={d.id}>
          <DocIcon doc={d} />
          <a className="name" href={fileUrl(`/documents/${d.id}/file`)} target="_blank" rel="noreferrer">
            {d.name}
          </a>
          <Badge>{label(d.kind)}</Badge>
          <span className="small muted">{fileSize(d.size_bytes)}</span>
        </div>
      ))}
    </div>
  );
}

export function PortalPaymentsPage() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-payments"], queryFn: () => api.get<Payment[]>("/portal/payments") });
  return (
    <>
      <PageHeader title={t("nav.payments")} subtitle={t("portal.payments_subtitle")} />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty title={t("payments.empty_title")}>{t("portal.payments_empty_body")}</Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("common.method")}</th>
                  <th>{t("portal.receipt_number")}</th>
                  <th className="num">{t("common.amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.received_on)}</td>
                    <td>
                      {label(p.method)} <PaymentBadges p={p} />
                    </td>
                    <td>{p.receipt_number}</td>
                    <td className="num">{money(p.amount_cents)}</td>
                    <td className="right">
                      <a className="btn btn-sm" href={fileUrl(`/portal/payments/${p.id}/receipt.pdf`)} target="_blank" rel="noreferrer">
                        <FileDown size={14} /> {t("payments.receipt")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", description: "", category: "general", priority: "medium", permission_to_enter: false });
  const [files, setFiles] = useState<File[]>([]);
  const save = useMutation({
    mutationFn: async () => {
      const wo = await api.post<WorkOrder>("/portal/work-orders", { ...f, description: f.description || null });
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await api.upload(`/portal/work-orders/${wo.id}/attachments`, form);
      }
      return wo;
    },
    onSuccess: (wo) => {
      qc.invalidateQueries({ queryKey: ["portal-requests"] });
      qc.invalidateQueries({ queryKey: ["portal-home"] });
      navigate(`/portal/maintenance/${wo.id}`);
    },
  });
  return (
    <Modal
      title={t("portal.new_request_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.title || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("portal.submitting") : t("portal.submit_request")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <Field label={t("portal.problem")}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("portal.problem_placeholder")} autoFocus />
        </Field>
        <Field label={t("maintenance.details")} hint={t("portal.details_hint")}>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={WO_CATEGORIES} />
          </Field>
          <Field label={t("portal.urgency")}>
            <Select
              value={f.priority}
              onChange={(e) => setF({ ...f, priority: e.target.value })}
              options={[
                { value: "low", label: t("portal.urgency_low") },
                { value: "medium", label: t("portal.urgency_medium") },
                { value: "high", label: t("portal.urgency_high") },
                { value: "emergency", label: t("portal.urgency_emergency") },
              ]}
            />
          </Field>
        </div>
        {f.priority === "emergency" && <div className="error-box">{t("portal.emergency_warning")}</div>}
        <Field label={t("portal.photos_video")} hint={t("portal.photos_hint")}>
          <input className="input" type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.permission_to_enter} onChange={(e) => setF({ ...f, permission_to_enter: e.target.checked })} />
          {t("portal.permission_to_enter")}
        </label>
      </div>
    </Modal>
  );
}

export function PortalMaintenancePage() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get("new") === "1");
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-requests"], queryFn: () => api.get<WorkOrder[]>("/portal/work-orders") });
  return (
    <>
      <PageHeader
        title={t("nav.maintenance")}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> {t("portal.newRequest")}
          </button>
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty
            icon={<Wrench size={40} />}
            title={t("portal.requests_empty_title")}
            action={
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                {t("portal.submit_a_request")}
              </button>
            }
          >
            {t("portal.requests_empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("portal.request")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("portal.updated")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((w) => (
                  <tr key={w.id}>
                    <td>{w.number}</td>
                    <td>
                      <Link to={`/portal/maintenance/${w.id}`} className="row-link">
                        {w.title}
                      </Link>
                    </td>
                    <td>
                      <Badge value={w.status} />
                    </td>
                    <td className="small muted">{dateTime(w.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {creating && <NewRequestModal onClose={() => setCreating(false)} />}
    </>
  );
}

export function PortalWorkOrderPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");
  const { data: wo, error, isLoading } = useQuery({ queryKey: ["portal-request", id], queryFn: () => api.get<WorkOrder>(`/portal/work-orders/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-request", id] });
  const post = useMutation({
    mutationFn: () => api.post(`/portal/work-orders/${id}/comments`, { body: comment }),
    onSuccess: () => {
      setComment("");
      refresh();
    },
  });
  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        await api.upload(`/portal/work-orders/${id}/attachments`, form);
      }
    },
    onSuccess: refresh,
  });
  if (isLoading) return <Spinner />;
  if (error || !wo) return <ErrorBox error={error} />;
  const photos = (wo.attachments ?? []).filter((a) => a.content_type.startsWith("image/"));
  const others = (wo.attachments ?? []).filter((a) => !a.content_type.startsWith("image/"));
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/portal/maintenance">{t("nav.maintenance")}</Link>}
        title={
          <>
            #{wo.number} {wo.title}
          </>
        }
        subtitle={t("portal.submitted_on", { date: dateTime(wo.created_at) })}
        actions={<Badge value={wo.status} />}
      />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={post.error || upload.error} />
          {wo.description && (
            <Card title={t("maintenance.details")}>
              <p style={{ whiteSpace: "pre-wrap" }}>{wo.description}</p>
            </Card>
          )}
          <Card title={t("portal.updates")}>
            <div className="timeline">
              {wo.comments?.map((c) => (
                <div key={c.id} className={`comment${c.is_system ? " system" : ""}`}>
                  {c.is_system ? (
                    <>
                      {c.body} · {dateTime(c.created_at)}
                    </>
                  ) : (
                    <>
                      <div className="comment-meta">
                        <strong>{c.author_name}</strong>
                        <span>{dateTime(c.created_at)}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {wo.status !== "closed" && (
              <div className="form" style={{ marginTop: 16 }}>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("portal.message_placeholder")} aria-label={t("portal.message")} />
                <div>
                  <button className="btn btn-primary btn-sm" disabled={!comment.trim() || post.isPending} onClick={() => post.mutate()}>
                    {t("portal.send")}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="stack">
          <Card title={t("portal.request")}>
            <dl className="dl">
              <dt>{t("common.status")}</dt>
              <dd>
                <Badge value={wo.status} />
              </dd>
              <dt>{t("common.category")}</dt>
              <dd>{label(wo.category)}</dd>
              <dt>{t("portal.urgency")}</dt>
              <dd>
                <Badge value={wo.priority} />
              </dd>
              {wo.scheduled_for && (
                <>
                  <dt>{t("enums.scheduled")}</dt>
                  <dd>{dateTime(wo.scheduled_for)}</dd>
                </>
              )}
            </dl>
          </Card>
          <Card title={t("properties.photos")}>
            {photos.length > 0 ? (
              <div className="photo-grid">
                {photos.map((p) => (
                  <a key={p.id} href={fileUrl(`/documents/${p.id}/file`)} target="_blank" rel="noreferrer">
                    <img src={fileUrl(`/documents/${p.id}/file`)} alt={p.name} />
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted small">{t("portal.no_photos")}</p>
            )}
            {others.length > 0 && <PortalDocList docs={others} />}
            {wo.status !== "closed" && (
              <div style={{ marginTop: 12 }}>
                <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  <Upload size={14} /> {upload.isPending ? t("common.uploading") : t("documents.add_photos")}
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export function PortalDocumentsPage() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-docs"], queryFn: () => api.get<DocumentRow[]>("/portal/documents") });
  return (
    <>
      <PageHeader title={t("documents.title")} subtitle={t("portal.documents_subtitle")} />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<FolderOpen size={40} />} title={t("portal.no_shared_documents")} />
        </Card>
      ) : (
        <Card>
          <PortalDocList docs={data ?? []} />
        </Card>
      )}
    </>
  );
}
