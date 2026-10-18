import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock, CheckCircle2, DoorOpen, HardHat, Lock, Plus, Wrench } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property, Unit, WorkOrder } from "../types";
import { PhotoGrid, DocumentsPanel } from "../components/Documents";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { date, dateTime, label, money, toCents, todayISO } from "../utils/format";
import { EXPENSE_CATEGORIES } from "./FinancePages";
import { WorkOrderVendorCards } from "../components/WorkOrderVendor";

export const WO_STATUSES = ["new", "assigned", "scheduled", "in_progress", "completed", "closed"] as const;
export const WO_CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "pest", "roof", "landscaping", "general", "other"];
export const WO_PRIORITIES = ["low", "medium", "high", "emergency"];

interface Assignee {
  user_id: string;
  name: string;
  role: string;
}

function NewWorkOrderModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get<Unit[]>("/units") });
  const { data: assignees } = useQuery({ queryKey: ["assignees"], queryFn: () => api.get<Assignee[]>("/org/assignees") });
  const [f, setF] = useState({ property_id: "", unit_id: "", title: "", description: "", category: "general", priority: "medium", assigned_to_user_id: "" });
  const save = useMutation({
    mutationFn: () =>
      api.post<WorkOrder>("/work-orders", { ...f, unit_id: f.unit_id || null, assigned_to_user_id: f.assigned_to_user_id || null, description: f.description || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      onClose();
    },
  });
  const propUnits = (units ?? []).filter((u) => u.property_id === f.property_id);
  return (
    <Modal
      title={t("maintenance.new")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.property_id || !f.title || save.isPending} onClick={() => save.mutate()}>
            {t("maintenance.create")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("common.property")}>
            <Select
              value={f.property_id}
              onChange={(e) => setF({ ...f, property_id: e.target.value, unit_id: "" })}
              options={[{ value: "", label: t("common.select") }, ...(properties ?? []).map((p) => ({ value: p.id, label: p.name }))]}
            />
          </Field>
          <Field label={t("common.unit")}>
            <Select
              value={f.unit_id}
              onChange={(e) => setF({ ...f, unit_id: e.target.value })}
              options={[{ value: "", label: t("maintenance.whole_property") }, ...propUnits.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </Field>
        </div>
        <Field label={t("maintenance.title_label")}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("maintenance.title_placeholder")} />
        </Field>
        <Field label={t("maintenance.details")}>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="form-row-3">
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={WO_CATEGORIES} />
          </Field>
          <Field label={t("maintenance.priority")}>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={WO_PRIORITIES} />
          </Field>
          <Field label={t("maintenance.assign_to")}>
            <Select
              value={f.assigned_to_user_id}
              onChange={(e) => setF({ ...f, assigned_to_user_id: e.target.value })}
              options={[{ value: "", label: t("maintenance.unassigned") }, ...(assignees ?? []).map((a) => ({ value: a.user_id, label: a.name }))]}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function WorkOrdersPage() {
  const { t } = useTranslation();
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
        title={t("nav.maintenance")}
        actions={
          <>
            <Link to="/maintenance/schedules" className="btn btn-ghost">
              <CalendarClock size={15} /> {t("schedules.title")}
            </Link>
            <label className="check small">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t("maintenance.assigned_to_me")}
            </label>
            <label className="check small">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> {t("maintenance.show_closed")}
            </label>
            {canCreate && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus size={16} /> {t("maintenance.new")}
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
          <Empty icon={<Wrench size={40} />} title={t("maintenance.empty_title")}>
            {t("maintenance.empty_body")}
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
                    {w.vendor_name && (
                      <div className="small muted">
                        <HardHat size={11} /> {w.vendor_name}
                      </div>
                    )}
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
  const { t } = useTranslation();
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
      title={t("maintenance.complete_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            {t("maintenance.complete")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p className="small muted">{t("maintenance.complete_note")}</p>
        <div className="form-row">
          <Field label={t("maintenance.cost")}>
            <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} autoFocus />
          </Field>
          <Field label={t("common.date")}>
            <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.vendor")}>
            <Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
          </Field>
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function WorkOrderDetailPage() {
  const { t } = useTranslation();
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
        breadcrumb={<Link to="/maintenance">{t("nav.maintenance")}</Link>}
        title={
          <>
            #{wo.number} {wo.title}
          </>
        }
        subtitle={`${wo.property_name}${wo.unit_name ? ` · ${wo.unit_name}` : ""} · ${t("maintenance.opened", { date: dateTime(wo.created_at) })}`}
        actions={
          canEdit && (
            <>
              {next[wo.status].map((s) => (
                <button key={s} className={`btn${s === "completed" ? " btn-primary" : ""}`} onClick={() => update.mutate({ status: s })} disabled={update.isPending}>
                  {s === "in_progress" && wo.status === "closed" ? t("maintenance.reopen") : t("maintenance.mark_as", { status: label(s) })}
                </button>
              ))}
              {can("owner", "manager") && !["completed", "closed"].includes(wo.status) && (
                <button className="btn" onClick={() => setCompleting(true)}>
                  <CheckCircle2 size={15} /> {t("maintenance.complete_with_cost")}
                </button>
              )}
            </>
          )
        }
      />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={update.error || addComment.error} />
          <Card title={t("common.description")}>
            <p style={{ whiteSpace: "pre-wrap" }}>{wo.description || <span className="muted">{t("maintenance.no_details")}</span>}</p>
          </Card>
          <Card title={t("maintenance.activity")}>
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
                            <Lock size={11} /> {t("maintenance.internal")}
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
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("maintenance.comment_placeholder")} aria-label={t("maintenance.comment")} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <label className="check small">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> {t("maintenance.internal_note")}
                  </label>
                  <button className="btn btn-primary btn-sm" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                    {t("maintenance.post_comment")}
                  </button>
                </div>
              </div>
            )}
          </Card>
          <Card title={t("properties.photos")}>
            <PhotoGrid ownerType="work_order" ownerId={wo.id} canUpload={canComment} />
          </Card>
          <DocumentsPanel ownerType="work_order" ownerId={wo.id} allowTenantShare />
        </div>
        <div className="stack">
          <Card title={t("leases.details")}>
            <dl className="dl">
              <dt>{t("common.status")}</dt>
              <dd>
                <Badge value={wo.status} />
              </dd>
              <dt>{t("maintenance.priority")}</dt>
              <dd>
                {canEdit ? (
                  <Select value={wo.priority} onChange={(e) => update.mutate({ priority: e.target.value })} options={WO_PRIORITIES} aria-label={t("maintenance.priority")} />
                ) : (
                  <Badge value={wo.priority} />
                )}
              </dd>
              <dt>{t("common.category")}</dt>
              <dd>{label(wo.category)}</dd>
              {wo.asset && (
                <>
                  <dt>{t("assets.asset")}</dt>
                  <dd>{wo.asset.name}</dd>
                </>
              )}
              {wo.schedule_id && (
                <>
                  <dt>{t("schedules.source")}</dt>
                  <dd>
                    <Link to="/maintenance/schedules">{t("schedules.preventive")}</Link>
                  </dd>
                </>
              )}
              <dt>{t("maintenance.requested_by")}</dt>
              <dd>{wo.tenant_name ?? t("maintenance.staff")}</dd>
              <dt>{t("maintenance.entry")}</dt>
              <dd>
                {wo.permission_to_enter ? (
                  <span>
                    <DoorOpen size={14} /> {t("maintenance.permission_to_enter")}
                  </span>
                ) : (
                  <span className="muted">{t("maintenance.contact_first")}</span>
                )}
              </dd>
              <dt>{t("maintenance.assigned")}</dt>
              <dd>
                {can("owner", "manager") ? (
                  <Select
                    value={wo.assigned_to_user_id ?? ""}
                    onChange={(e) => update.mutate(e.target.value ? { assigned_to_user_id: e.target.value } : { unassign: true })}
                    options={[{ value: "", label: t("maintenance.unassigned") }, ...(assignees ?? []).map((a) => ({ value: a.user_id, label: a.name }))]}
                    aria-label={t("maintenance.assignee")}
                  />
                ) : (
                  wo.assignee_name ?? "—"
                )}
              </dd>
              <dt>{t("enums.scheduled")}</dt>
              <dd>
                {canEdit ? (
                  <Input
                    type="datetime-local"
                    defaultValue={wo.scheduled_for ? toLocalInput(wo.scheduled_for) : ""}
                    onBlur={(e) => e.target.value && update.mutate({ scheduled_for: new Date(e.target.value).toISOString() })}
                    aria-label={t("maintenance.scheduled_for")}
                  />
                ) : (
                  dateTime(wo.scheduled_for)
                )}
              </dd>
            </dl>
          </Card>
          {can("owner", "manager", "accountant") && <WorkOrderVendorCards wo={wo} extras={{ vendor: wo.vendor ?? null, quotes: wo.quotes ?? [], invoices: wo.invoices ?? [] }} />}
          {wo.expenses && wo.expenses.length > 0 && (
            <Card title={t("maintenance.costs")}>
              <ul className="list-plain">
                {wo.expenses.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.vendor ?? label(e.category)} <span className="small muted">· {date(e.expense_date)}</span>
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
