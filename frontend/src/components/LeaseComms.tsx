import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarCheck, FileDown, FileWarning, ShieldCheck } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease } from "../types";
import { MarkdownView } from "./MarkdownView";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, Select, Spinner } from "./ui";
import { date, dateTime, fromCents, money, toCents, todayISO } from "../utils/format";

type Kind = "rent_increase" | "entry" | "violation" | "pay_or_quit" | "general";
const KINDS: Kind[] = ["rent_increase", "entry", "violation", "pay_or_quit", "general"];

interface NoticeRow {
  id: string;
  kind: Kind;
  title: string;
  effective_date: string | null;
  document_id: string | null;
  emailed_to: string[];
  viewed_at: string | null;
  created_at: string;
}

function NoticeModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: tpl } = useQuery({ queryKey: ["notice-templates"], queryFn: () => api.get<{ templates: Record<Kind, { title: string; body: string }>; disclaimer: string }>("/notice-templates") });
  const [kind, setKind] = useState<Kind>("entry");
  const [f, setF] = useState({
    title: "",
    effective_date: "",
    new_rent: fromCents(lease.rent_cents),
    entry_date: todayISO(),
    entry_window: "9am–12pm",
    entry_reason: "",
    violation: "",
    cure_days: "10",
    amount_due: lease.balance_cents > 0 ? fromCents(lease.balance_cents) : "",
    pay_days: "3",
    send_email: true,
    send_sms: true,
  });
  const [text, setText] = useState<string | null>(null);
  const [step, setStep] = useState<"details" | "preview">("details");
  const fields = () => ({
    kind,
    body: text,
    effective_date: f.effective_date || null,
    new_rent_cents: kind === "rent_increase" ? toCents(f.new_rent) : null,
    entry_date: kind === "entry" ? f.entry_date : null,
    entry_window: kind === "entry" ? f.entry_window : null,
    entry_reason: kind === "entry" ? f.entry_reason || null : null,
    violation: kind === "violation" ? f.violation || null : null,
    cure_days: kind === "violation" ? Number(f.cure_days) : null,
    amount_due_cents: kind === "pay_or_quit" && f.amount_due ? toCents(f.amount_due) : null,
    pay_days: kind === "pay_or_quit" ? Number(f.pay_days) : null,
  });
  const preview = useMutation({ mutationFn: () => api.post<{ body: string }>(`/leases/${lease.id}/notices/preview`, fields()), onSuccess: () => setStep("preview") });
  const send = useMutation({
    mutationFn: () => api.post(`/leases/${lease.id}/notices`, { ...fields(), title: f.title || tpl?.templates[kind].title, send_email: f.send_email, send_sms: f.send_sms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices", lease.id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  return (
    <Modal
      title={t("notices.send_title")}
      onClose={onClose}
      wide
      footer={
        step === "details" ? (
          <>
            <button className="btn" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="btn btn-primary" onClick={() => preview.mutate()} disabled={preview.isPending}>
              {t("notices.preview")}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setStep("details")}>
              {t("common.back")}
            </button>
            <button className="btn btn-primary" onClick={() => send.mutate()} disabled={send.isPending}>
              {t("notices.send")}
            </button>
          </>
        )
      }
    >
      <div className="form">
        <ErrorBox error={preview.error || send.error} />
        {step === "details" ? (
          <>
            <div className="form-row">
              <Field label={t("notices.kind")}>
                <Select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as Kind);
                    setText(null);
                  }}
                  options={KINDS.map((k) => ({ value: k, label: t(`notices.kind_${k}`) }))}
                />
              </Field>
              <Field label={t("notices.title")}>
                <Input value={f.title} placeholder={tpl?.templates[kind].title} onChange={(e) => set({ title: e.target.value })} maxLength={160} />
              </Field>
            </div>
            {kind === "rent_increase" && (
              <div className="form-row">
                <Field label={t("notices.new_rent")} hint={t("notices.current", { amount: money(lease.rent_cents) })}>
                  <MoneyInput value={f.new_rent} onChange={(new_rent) => set({ new_rent })} />
                </Field>
                <Field label={t("notices.effective")}>
                  <Input type="date" value={f.effective_date} onChange={(e) => set({ effective_date: e.target.value })} />
                </Field>
              </div>
            )}
            {kind === "entry" && (
              <>
                <div className="form-row">
                  <Field label={t("notices.entry_date")}>
                    <Input type="date" value={f.entry_date} onChange={(e) => set({ entry_date: e.target.value })} />
                  </Field>
                  <Field label={t("notices.entry_window")}>
                    <Input value={f.entry_window} onChange={(e) => set({ entry_window: e.target.value })} maxLength={60} />
                  </Field>
                </div>
                <Field label={t("notices.entry_reason")}>
                  <Input value={f.entry_reason} onChange={(e) => set({ entry_reason: e.target.value })} placeholder={t("notices.entry_reason_placeholder")} maxLength={300} />
                </Field>
              </>
            )}
            {kind === "violation" && (
              <>
                <Field label={t("notices.violation")}>
                  <textarea className="input" rows={3} value={f.violation} onChange={(e) => set({ violation: e.target.value })} maxLength={1000} />
                </Field>
                <Field label={t("notices.cure_days")}>
                  <Input type="number" min={0} max={90} value={f.cure_days} onChange={(e) => set({ cure_days: e.target.value })} />
                </Field>
              </>
            )}
            {kind === "pay_or_quit" && (
              <div className="form-row">
                <Field label={t("notices.amount_due")} hint={t("notices.balance_is", { amount: money(Math.max(lease.balance_cents, 0)) })}>
                  <MoneyInput value={f.amount_due} onChange={(amount_due) => set({ amount_due })} />
                </Field>
                <Field label={t("notices.pay_days")} hint={t("notices.pay_days_hint")}>
                  <Input type="number" min={1} max={60} value={f.pay_days} onChange={(e) => set({ pay_days: e.target.value })} />
                </Field>
              </div>
            )}
            <details>
              <summary className="small">{t("notices.edit_wording")}</summary>
              <textarea className="input mono small" rows={12} value={text ?? tpl?.templates[kind].body ?? ""} onChange={(e) => setText(e.target.value)} aria-label={t("notices.edit_wording")} />
            </details>
            <div className="info-box small">{tpl?.disclaimer}</div>
          </>
        ) : (
          <>
            <div className="sign-doc sign-doc-preview">
              <MarkdownView source={preview.data?.body ?? ""} />
            </div>
            <label className="check">
              <input type="checkbox" checked={f.send_email} onChange={(e) => set({ send_email: e.target.checked })} /> {t("notices.by_email")}
            </label>
            <label className="check">
              <input type="checkbox" checked={f.send_sms} onChange={(e) => set({ send_sms: e.target.checked })} /> {t("notices.by_sms")}
            </label>
            <p className="small muted">{t("notices.delivery_note")}</p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function NoticesPanel({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, error, isLoading } = useQuery({ queryKey: ["notices", lease.id], queryFn: () => api.get<NoticeRow[]>(`/leases/${lease.id}/notices`) });
  if (isLoading) return <Spinner />;
  return (
    <div className="stack">
      <ErrorBox error={error} />
      {can("owner", "manager") && (
        <div>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <FileWarning size={15} /> {t("notices.send_title")}
          </button>
        </div>
      )}
      {!data?.length ? (
        <Card>
          <Empty icon={<FileWarning size={36} />} title={t("notices.empty_title")}>
            {t("notices.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("notices.title")}</th>
                  <th>{t("notices.sent")}</th>
                  <th>{t("notices.delivery")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.title}</strong>
                      <div className="small muted">
                        {t(`notices.kind_${n.kind}`)}
                        {n.effective_date ? ` · ${date(n.effective_date)}` : ""}
                      </div>
                    </td>
                    <td className="small nowrap">{dateTime(n.created_at)}</td>
                    <td className="small">
                      {n.emailed_to.length ? t("notices.emailed", { count: n.emailed_to.length }) : t("notices.not_emailed")}
                      {n.viewed_at && <div className="muted">{t("notices.viewed", { when: dateTime(n.viewed_at) })}</div>}
                    </td>
                    <td className="right">
                      {n.document_id && (
                        <a className="btn btn-sm" href={fileUrl(`/documents/${n.document_id}/file`)} target="_blank" rel="noreferrer">
                          <FileDown size={13} /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {open && <NoticeModal lease={lease} onClose={() => setOpen(false)} />}
    </div>
  );
}

interface MoveOut {
  id: string;
  tenant_name: string;
  move_out_date: string;
  forwarding_address: string | null;
  reason: string | null;
  status: "submitted" | "acknowledged" | "withdrawn";
  created_at: string;
}

/** Banner on the lease page when a tenant has given notice to move out. */
export function MoveOutBanner({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["move-out", lease.id], queryFn: () => api.get<MoveOut[]>(`/leases/${lease.id}/move-out-notices`) });
  const [confirm, setConfirm] = useState<MoveOut | null>(null);
  const [setEnd, setSetEnd] = useState(true);
  const ack = useMutation({
    mutationFn: (id: string) => api.post(`/move-out-notices/${id}/acknowledge`, { set_lease_end: setEnd }),
    onSuccess: () => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["move-out", lease.id] });
      qc.invalidateQueries({ queryKey: ["lease", lease.id] });
    },
  });
  const n = data?.find((x) => x.status !== "withdrawn");
  if (!n) return null;
  return (
    <div className={n.status === "submitted" ? "info-box" : "success-box"} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <CalendarCheck size={16} />
      <span style={{ flex: 1, minWidth: 220 }}>
        {t(n.status === "submitted" ? "moveout.banner" : "moveout.banner_ack", { name: n.tenant_name, date: date(n.move_out_date) })}
        {n.reason && <span className="small"> — “{n.reason}”</span>}
        {n.forwarding_address && <div className="small">{t("moveout.forwarding", { address: n.forwarding_address })}</div>}
      </span>
      {n.status === "submitted" && can("owner", "manager") && (
        <button className="btn btn-sm btn-primary" onClick={() => setConfirm(n)}>
          {t("moveout.acknowledge")}
        </button>
      )}
      {confirm && (
        <Modal
          title={t("moveout.ack_title")}
          onClose={() => setConfirm(null)}
          footer={
            <button className="btn btn-primary" onClick={() => ack.mutate(confirm.id)} disabled={ack.isPending}>
              {t("moveout.acknowledge")}
            </button>
          }
        >
          <div className="stack">
            <ErrorBox error={ack.error} />
            <p>{t("moveout.ack_body", { name: confirm.tenant_name, date: date(confirm.move_out_date) })}</p>
            <label className="check">
              <input type="checkbox" checked={setEnd} onChange={(e) => setSetEnd(e.target.checked)} /> {t("moveout.set_end", { date: date(confirm.move_out_date) })}
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Renter's insurance status per tenant on the lease. */
export function InsuranceStatus({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["insurance", lease.id], queryFn: () => api.get<{ tenant_id: string; tenant_name: string; status: string; expires_on: string | null; document_id: string | null }[]>(`/leases/${lease.id}/insurance`) });
  if (!data?.length) return null;
  const tone: Record<string, string> = { ok: "jade", expiring: "citrine", expired: "garnet", missing: "" };
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={15} /> {t("insurance.title")}
        </span>
      }
    >
      <ul className="list-plain">
        {data.map((r) => (
          <li key={r.tenant_id}>
            <span className="small">{r.tenant_name}</span>
            <span className="nowrap">
              {r.document_id ? (
                <a href={fileUrl(`/documents/${r.document_id}/file`)} target="_blank" rel="noreferrer">
                  <Badge tone={tone[r.status]}>{t(`insurance.${r.status}`, { date: date(r.expires_on) })}</Badge>
                </a>
              ) : (
                <Badge tone={tone[r.status]}>{t(`insurance.${r.status}`, { date: date(r.expires_on) })}</Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 10 }}>
        {t("insurance.staff_hint")}
      </p>
    </Card>
  );
}
