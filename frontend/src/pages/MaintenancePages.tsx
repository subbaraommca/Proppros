import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, DoorOpen, Lock, Plus, Wrench } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property, Unit, WorkOrder } from "../types";
import { PhotoGrid, DocumentsPanel } from "../components/Documents";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { dateTime, label, money, toCents, todayISO } from "../utils/format";
import { EXPENSE_CATEGORIES } from "./FinancePages";

export const WO_STATUSES = ["new", "assigned", "scheduled", "in_progress", "completed", "closed"] as const;
export const WO_CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "pest", "roof", "landscaping", "general", "other"];
export const WO_PRIORITIES = ["low", "medium", "high", "emergency"];

interface Assignee {
  user_id: string;
  name: string;
  role: string;
}

function NewWorkOrderModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get<Unit[]>("/units") });
  const { data: assignees } = useQuery({ queryKey: ["assignees"], queryFn: () => api.get<Assignee[]>("/org/assignees") });
  const [f, setF] = useState({ property_id: "", unit_id: "", title: "", description: "", category: "general", priority: "medium", assigned_to_user_id: "" });
  const save = useMutation({
    mutationFn: () => api.post<WorkOrder>("/work-orders", { ...f, unit_id: f.unit_id || null, assigned_to_user_id: f.assigned_to_user_id || null, description: f.description || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      onClose();
    },
  });
  const propUnits = (units ?? []).filter((u) => u.property_id === f.property_id);
  return (
    <Modal
      title="New work order"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!f.property_id || !f.title || save.isPending} onClick={() => save.mutate()}>
            Create
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label="Property">
            <Select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value, unit_id: "" })} options={[{ value: "", label: "Select…" }, ...(properties ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
          </Field>
          <Field label="Unit">
            <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} options={[{ value: "", label: "Whole property / common area" }, ...propUnits.map((u) => ({ value: u.id, label: u.name }))]} />
          </Field>
        </div>
        <Field label="Title">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Kitchen sink leaking" />
        </Field>
        <Field label="Details">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="form-row-3">
          <Field label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={WO_CATEGORIES} />
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={WO_PRIORITIES} />
          </Field>
          <Field label="Assign to">
            <Select value={f.assigned_to_user_id} onChange={(e) => setF({ ...f, assigned_to_user_id: e.target.value })} options={[{ value: "", label: "Unassigned" }, ...(assignees ?? []).map((a) => ({ value: a.user_id, label: a.name }))]} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function WorkOrdersPage() {
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [mine, setMine] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["work-orders", mine],
    queryFn: () => api.get<WorkOrder[]>(`/work-orders${mine ? "?mine=true" : ""}`),
  });
  const columns = WO_STATUSES.filter((s) => showClosed || s !== "closed");
  const canCreate = can("owner", "manager", "maintenance");

  return (
    <>
      <PageHeader
        title="Maintenance"
        actions={
          <>
            <label className="check small">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me
            </label>
            <label className="check small">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed
            </label>
            {canCreate && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={16} /> New work order
              </button>
            )}
          </>
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<Wrench size={40} />} title="No work orders">
            Tenant requests from the portal show up here, or create one yourself.
          </Empty>
        </Card>
      ) : (
        <div className="board">
          {columns.map((status) => {
            const items = (data ?? []).filter((w) => w.status === status);
            return (
              <div className="column" key={status}>
                <div className="column-title">
                  <span>{label(status)}</span>
                  <span className="muted">{items.length}</span>
                </div>
                {items.map((w) => (
                  <Link key={w.id} to={`/maintenance/${w.id}`} className="card wo-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span className="small muted">#{w.number}</span>
                      <Badge value={w.priority} />
                    </div>
                    <div className="title">{w.title}</div>
                    <div className="small muted">
                      {w.property_name}
                      {w.unit_name ? ` · ${w.unit_name}` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {creating && <NewWorkOrderModal onClose={() => setCreating(false)} />}
    </>
  );
}

function CompleteModal({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ amount: "", category: "repairs", vendor: "", expense_date: todayISO() });
  const save = useMutation({
    mutationFn: () => api.post(`/work-orders/${wo.id}/complete-with-expense`, { ...f, amount_cents: toCents(f.amount), vendor: f.vendor || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-order", wo.id] });
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
  });
  return (
    <Modal
      title="Complete & record cost"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            Complete
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p className="small muted">Marks the work order completed and adds the cost to Expenses for this property.</p>
        <div className="form-row">
          <Field label="Cost">
            <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} autoFocus />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Vendor">
            <Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function WorkOrderDetailPage() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { data: wo, error, isLoading } = useQuery({ queryKey: ["work-order", id], queryFn: () => api.get<WorkOrder>(`/work-orders/${id}`) });
  const { data: assignees } = useQuery({ queryKey: ["assignees"], queryFn: () => api.get<Assignee[]>("/org/assignees"), enabled: can("owner", "manager") });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["work-order", id] });
    qc.invalidateQueries({ queryKey: ["work-orders"] });
  };
  const update = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch(`/work-orders/${id}`, body), onSuccess: refresh });
  const addComment = useMutation({
    mutationFn: () => api.post(`/work-orders/${id}/comments`, { body: comment, is_internal: internal }),
    onSuccess: () => {
      setComment("");
      refresh();
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !wo) return <ErrorBox error={error} />;
  const canEdit = !!wo.can_edit;
  const canComment = can("owner", "manager", "maintenance");
  const next: Record<string, string[]> = {
    new: ["assigned", "scheduled", "in_progress"],
    assigned: ["scheduled", "in_progress"],
    scheduled: ["in_progress"],
    in_progress: ["completed"],
    completed: ["closed", "in_progress"],
    closed: ["in_progress"],
  };

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/maintenance">Maintenance</Link>}
        title={
          <>
            #{wo.number} {wo.title}
          </>
        }
        subtitle={`${wo.property_name}${wo.unit_name ? ` · ${wo.unit_name}` : ""} · opened ${dateTime(wo.created_at)}`}
        actions={
          canEdit && (
            <>
              {next[wo.status].map((s) => (
                <button key={s} className={`btn${s === "completed" ? " btn-primary" : ""}`} onClick={() => update.mutate({ status: s })} disabled={update.isPending}>
                  {s === "in_progress" && wo.status === "closed" ? "Reopen" : `Mark ${label(s).toLowerCase()}`}
                </button>
              ))}
              {can("owner", "manager") && !["completed", "closed"].includes(wo.status) && (
                <button className="btn" onClick={() => setCompleting(true)}>
                  <CheckCircle2 size={15} /> Complete with cost
                </button>
              )}
            </>
          )
        }
      />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={update.error || addComment.error} />
          <Card title="Description">
            <p style={{ whiteSpace: "pre-wrap" }}>{wo.description || <span className="muted">No details provided.</span>}</p>
          </Card>
          <Card title="Activity">
            <div className="timeline">
              {wo.comments?.map((c) => (
                <div key={c.id} className={`comment${c.is_system ? " system" : c.is_internal ? " internal" : ""}`}>
                  {c.is_system ? (
                    <>
                      {c.body} · {c.author_name} · {dateTime(c.created_at)}
                    </>
                  ) : (
                    <>
                      <div className="comment-meta">
                        <strong>{c.author_name}</strong>
                        <span>{dateTime(c.created_at)}</span>
                        {c.is_internal && (
                          <span>
                            <Lock size={11} /> Internal
                          </span>
                        )}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {canComment && (
              <div className="form" style={{ marginTop: 16 }}>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" aria-label="Comment" />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <label className="check small">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (hidden from tenant)
                  </label>
                  <button className="btn btn-primary btn-sm" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                    Post comment
                  </button>
                </div>
              </div>
            )}
          </Card>
          <Card title="Photos">
            <PhotoGrid ownerType="work_order" ownerId={wo.id} canUpload={canComment} />
          </Card>
          <DocumentsPanel ownerType="work_order" ownerId={wo.id} allowTenantShare />
        </div>
        <div className="stack">
          <Card title="Details">
            <dl className="dl">
              <dt>Status</dt>
              <dd>
                <Badge value={wo.status} />
              </dd>
              <dt>Priority</dt>
              <dd>
                {canEdit ? (
                  <Select value={wo.priority} onChange={(e) => update.mutate({ priority: e.target.value })} options={WO_PRIORITIES} aria-label="Priority" />
                ) : (
                  <Badge value={wo.priority} />
                )}
              </dd>
              <dt>Category</dt>
              <dd>{label(wo.category)}</dd>
              <dt>Requested by</dt>
              <dd>{wo.tenant_name ?? "Staff"}</dd>
              <dt>Entry</dt>
              <dd>
                {wo.permission_to_enter ? (
                  <span>
                    <DoorOpen size={14} /> Permission to enter
                  </span>
                ) : (
                  <span className="muted">Contact tenant first</span>
                )}
              </dd>
              <dt>Assigned</dt>
              <dd>
                {can("owner", "manager") ? (
                  <Select
                    value={wo.assigned_to_user_id ?? ""}
                    onChange={(e) => update.mutate(e.target.value ? { assigned_to_user_id: e.target.value } : { unassign: true })}
                    options={[{ value: "", label: "Unassigned" }, ...(assignees ?? []).map((a) => ({ value: a.user_id, label: a.name }))]}
                    aria-label="Assignee"
                  />
                ) : (
                  wo.assignee_name ?? "—"
                )}
              </dd>
              <dt>Scheduled</dt>
              <dd>
                {canEdit ? (
                  <Input
                    type="datetime-local"
                    defaultValue={wo.scheduled_for ? toLocalInput(wo.scheduled_for) : ""}
                    onBlur={(e) => e.target.value && update.mutate({ scheduled_for: new Date(e.target.value).toISOString() })}
                    aria-label="Scheduled for"
                  />
                ) : (
                  dateTime(wo.scheduled_for)
                )}
              </dd>
            </dl>
          </Card>
          {wo.expenses && wo.expenses.length > 0 && (
            <Card title="Costs">
              <ul className="list-plain">
                {wo.expenses.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.vendor ?? label(e.category)} <span className="small muted">· {e.expense_date}</span>
                    </span>
                    <span className="mono">{money(e.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {completing && <CompleteModal wo={wo} onClose={() => setCompleting(false)} />}
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
