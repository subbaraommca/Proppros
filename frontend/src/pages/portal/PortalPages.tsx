import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, FileDown, FolderOpen, Plus, Upload, Wrench } from "lucide-react";
import { api, fileUrl } from "../../services/api";
import type { DocumentRow, Lease, LedgerRow, Payment, WorkOrder } from "../../types";
import { DocIcon } from "../../components/Documents";
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
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const active = data.leases.filter((l) => l.status === "active");
  return (
    <>
      <PageHeader title={t("portal.welcome", { name: data.tenant_name })} subtitle={data.organization} />
      <div className="stack">
        {data.leases.length === 0 && (
          <Card>
            <Empty title="No lease on file yet">Your landlord hasn't linked a lease to your account.</Empty>
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
                    <CalendarDays size={13} /> {t("portal.nextDue")}: {money(l.monthly_total_cents)} on {date(l.next_due_date)}
                  </>
                ) : (
                  "No upcoming rent scheduled"
                )}
              </div>
            </div>
            <div className="actions">
              <Link className="btn" to={`/portal/leases/${l.id}`}>
                View statement
              </Link>
              <Link className="btn btn-primary" to="/portal/maintenance?new=1">
                <Wrench size={15} /> Request maintenance
              </Link>
            </div>
          </div>
        ))}
        <div className="grid grid-2">
          <Card title="Recent payments" actions={<Link to="/portal/payments" className="small">All →</Link>}>
            {data.recent_payments.length === 0 ? (
              <p className="muted">No payments yet.</p>
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
            <p className="small muted" style={{ marginTop: 12 }}>
              Pay your landlord as usual (Zelle, check, etc.). Payments appear here once recorded.
            </p>
          </Card>
          <Card title={t("portal.requests")} actions={<Link to="/portal/maintenance" className="small">All →</Link>}>
            <p>
              <strong>{data.open_requests}</strong> open request{data.open_requests === 1 ? "" : "s"}
            </p>
          </Card>
        </div>
        {data.leases
          .filter((l) => l.status !== "active")
          .map((l) => (
            <Card key={l.id} title={`Past lease · ${l.property?.name}`}>
              <p className="muted">
                {date(l.start_date)} – {date(l.ended_on ?? l.end_date)} · balance <BalanceText cents={l.balance_cents} /> ·{" "}
                <Link to={`/portal/leases/${l.id}`}>statement</Link>
              </p>
            </Card>
          ))}
      </div>
    </>
  );
}

export function PortalLeasePage() {
  const { id = "" } = useParams();
  const lease = useQuery({ queryKey: ["portal-lease", id], queryFn: () => api.get<PortalLease>(`/portal/leases/${id}`) });
  const ledger = useQuery({ queryKey: ["portal-ledger", id], queryFn: () => api.get<LedgerRow[]>(`/portal/leases/${id}/ledger`) });
  if (lease.isLoading) return <Spinner />;
  if (lease.error || !lease.data) return <ErrorBox error={lease.error} />;
  const l = lease.data;
  return (
    <>
      <PageHeader breadcrumb={<Link to="/portal">Home</Link>} title={`${l.property?.name} · ${l.unit?.name}`} subtitle={l.property?.address} />
      <div className="stack">
        <div className="grid grid-3">
          <div className="card stat">
            <div className="stat-label">Balance</div>
            <div className="stat-value">
              <BalanceText cents={l.balance_cents} />
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">Monthly</div>
            <div className="stat-value">{money(l.monthly_total_cents)}</div>
            <div className="stat-sub">due on the {ordinal(l.due_day)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Lease term</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {date(l.start_date)} – {l.end_date ? date(l.end_date) : "Month-to-month"}
            </div>
          </div>
        </div>
        <Card title="Statement" pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="num">Charges</th>
                  <th className="num">Payments</th>
                  <th className="num">Balance</th>
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
          <Card title="Lease documents">
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
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-payments"], queryFn: () => api.get<Payment[]>("/portal/payments") });
  return (
    <>
      <PageHeader title="Payments" subtitle="Download a receipt for any payment." />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty title="No payments yet">Payments appear here once your landlord records them.</Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Receipt #</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.received_on)}</td>
                    <td>{label(p.method)}</td>
                    <td>{p.receipt_number}</td>
                    <td className="num">{money(p.amount_cents)}</td>
                    <td className="right">
                      <a className="btn btn-sm" href={fileUrl(`/portal/payments/${p.id}/receipt.pdf`)} target="_blank" rel="noreferrer">
                        <FileDown size={14} /> Receipt
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
      title="New maintenance request"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!f.title || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Submitting…" : "Submit request"}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <Field label="What's the problem?">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Dishwasher not draining" autoFocus />
        </Field>
        <Field label="Details" hint="where, when it started, anything you've tried">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={WO_CATEGORIES} />
          </Field>
          <Field label="Urgency">
            <Select
              value={f.priority}
              onChange={(e) => setF({ ...f, priority: e.target.value })}
              options={[
                { value: "low", label: "Low — whenever convenient" },
                { value: "medium", label: "Medium — this week" },
                { value: "high", label: "High — as soon as possible" },
                { value: "emergency", label: "Emergency — flooding, no heat, gas" },
              ]}
            />
          </Field>
        </div>
        {f.priority === "emergency" && <div className="error-box">For fire, gas leaks or anything dangerous, call 911 first.</div>}
        <Field label="Photos or video" hint="(optional, up to 4 MB each)">
          <input className="input" type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.permission_to_enter} onChange={(e) => setF({ ...f, permission_to_enter: e.target.checked })} />
          Maintenance may enter if I'm not home
        </label>
      </div>
    </Modal>
  );
}

export function PortalMaintenancePage() {
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get("new") === "1");
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-requests"], queryFn: () => api.get<WorkOrder[]>("/portal/work-orders") });
  return (
    <>
      <PageHeader
        title="Maintenance"
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New request
          </button>
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<Wrench size={40} />} title="No requests yet" action={<button className="btn btn-primary" onClick={() => setCreating(true)}>Submit a request</button>}>
            Something broken? Let your landlord know and track the repair here.
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Updated</th>
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
        breadcrumb={<Link to="/portal/maintenance">Maintenance</Link>}
        title={
          <>
            #{wo.number} {wo.title}
          </>
        }
        subtitle={<>Submitted {dateTime(wo.created_at)}</>}
        actions={<Badge value={wo.status} />}
      />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={post.error || upload.error} />
          {wo.description && (
            <Card title="Details">
              <p style={{ whiteSpace: "pre-wrap" }}>{wo.description}</p>
            </Card>
          )}
          <Card title="Updates">
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
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a message for your landlord…" aria-label="Message" />
                <div>
                  <button className="btn btn-primary btn-sm" disabled={!comment.trim() || post.isPending} onClick={() => post.mutate()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="stack">
          <Card title="Request">
            <dl className="dl">
              <dt>Status</dt>
              <dd>
                <Badge value={wo.status} />
              </dd>
              <dt>Category</dt>
              <dd>{label(wo.category)}</dd>
              <dt>Urgency</dt>
              <dd>
                <Badge value={wo.priority} />
              </dd>
              {wo.scheduled_for && (
                <>
                  <dt>Scheduled</dt>
                  <dd>{dateTime(wo.scheduled_for)}</dd>
                </>
              )}
            </dl>
          </Card>
          <Card title="Photos">
            {photos.length > 0 ? (
              <div className="photo-grid">
                {photos.map((p) => (
                  <a key={p.id} href={fileUrl(`/documents/${p.id}/file`)} target="_blank" rel="noreferrer">
                    <img src={fileUrl(`/documents/${p.id}/file`)} alt={p.name} />
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted small">No photos.</p>
            )}
            {others.length > 0 && <PortalDocList docs={others} />}
            {wo.status !== "closed" && (
              <div style={{ marginTop: 12 }}>
                <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  <Upload size={14} /> {upload.isPending ? "Uploading…" : "Add photos"}
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
  const { data, error, isLoading } = useQuery({ queryKey: ["portal-docs"], queryFn: () => api.get<DocumentRow[]>("/portal/documents") });
  return (
    <>
      <PageHeader title="Documents" subtitle="Documents your landlord has shared with you." />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<FolderOpen size={40} />} title="No shared documents" />
        </Card>
      ) : (
        <Card>
          <PortalDocList docs={data ?? []} />
        </Card>
      )}
    </>
  );
}
