import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, CalendarX, DollarSign, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease, LedgerRow, Payment } from "../types";
import { DocumentsPanel } from "../components/Documents";
import { MovePanel, RenewalPanel, SignaturesPanel } from "../components/LeasingPanels";
import { PaymentBadges } from "../components/OnlinePayments";
import { Badge, BalanceText, Card, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Tabs, Textarea } from "../components/ui";
import { date, fromCents, label, money, ordinal, toCents, todayISO } from "../utils/format";

const METHODS = ["zelle", "check", "cash", "venmo", "bank_transfer", "card", "other"];

function PaymentModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    amount: lease.balance_cents > 0 ? fromCents(lease.balance_cents) : "",
    method: "zelle",
    received_on: todayISO(),
    tenant_id: lease.tenants.find((tn) => tn.is_primary)?.id ?? lease.tenants[0]?.id ?? "",
    reference: "",
    notes: "",
    send_receipt: true,
  });
  const save = useMutation({
    mutationFn: () =>
      api.post<Payment & { receipt_sent: boolean }>(`/leases/${lease.id}/payments`, {
        amount_cents: toCents(f.amount),
        method: f.method,
        received_on: f.received_on,
        tenant_id: f.tenant_id || null,
        reference: f.reference || null,
        notes: f.notes || null,
        send_receipt: f.send_receipt,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease", lease.id] });
      qc.invalidateQueries({ queryKey: ["ledger", lease.id] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });
  const payer = lease.tenants.find((tn) => tn.id === f.tenant_id);
  const amount = toCents(f.amount);
  return (
    <Modal
      title={t("payments.record")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!amount || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : amount ? t("payments.record_amount", { amount: money(amount) }) : t("payments.record")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("common.amount")} hint={t("payments.balance_hint", { amount: money(lease.balance_cents) })}>
            <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} autoFocus />
          </Field>
          <Field label={t("payments.date_received")}>
            <Input type="date" value={f.received_on} onChange={(e) => setF({ ...f, received_on: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.method")}>
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={METHODS} />
          </Field>
          <Field label={t("payments.reference")} hint={t("payments.reference_hint")}>
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </Field>
        </div>
        {lease.tenants.length > 1 && (
          <Field label={t("payments.paid_by")}>
            <Select value={f.tenant_id} onChange={(e) => setF({ ...f, tenant_id: e.target.value })} options={lease.tenants.map((tn) => ({ value: tn.id, label: tn.name }))} />
          </Field>
        )}
        <Field label={t("common.notes")} hint={t("common.optional_hint")}>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.send_receipt} disabled={!payer?.email} onChange={(e) => setF({ ...f, send_receipt: e.target.checked })} />
          {payer?.email ? t("payments.email_receipt_to", { email: payer.email }) : t("payments.email_receipt_no_email")}
        </label>
      </div>
    </Modal>
  );
}

function AdjustmentModal({ leaseId, onClose }: { leaseId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({ entry_type: "charge", description: "", amount: "", entry_date: todayISO() });
  const save = useMutation({
    mutationFn: () => api.post(`/leases/${leaseId}/ledger`, { ...f, amount_cents: toCents(f.amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease", leaseId] });
      qc.invalidateQueries({ queryKey: ["ledger", leaseId] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("ledger.adjust_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.description || !toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("common.type")}>
            <Select
              value={f.entry_type}
              onChange={(e) => setF({ ...f, entry_type: e.target.value })}
              options={[
                { value: "charge", label: t("ledger.charge_option") },
                { value: "credit", label: t("ledger.credit_option") },
              ]}
            />
          </Field>
          <Field label={t("common.date")}>
            <Input type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />
          </Field>
        </div>
        <Field label={t("common.description")}>
          <Input
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder={f.entry_type === "charge" ? t("ledger.charge_placeholder") : t("ledger.credit_placeholder")}
          />
        </Field>
        <Field label={t("common.amount")}>
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
      </div>
    </Modal>
  );
}

function EditTermsModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isPct = lease.late_fee_type === "percent";
  const [f, setF] = useState({
    end_date: lease.end_date ?? "",
    rent: fromCents(lease.rent_cents),
    due_day: String(lease.due_day),
    deposit: fromCents(lease.deposit_cents),
    late_fee_type: lease.late_fee_type === "none" ? "flat" : lease.late_fee_type,
    late_fee: lease.late_fee_type === "none" ? "" : isPct ? String(lease.late_fee_amount / 100) : fromCents(lease.late_fee_amount),
    grace_days: String(lease.grace_days),
    notes: lease.notes ?? "",
  });
  const save = useMutation({
    mutationFn: () => {
      const lateAmount = f.late_fee_type === "percent" ? Math.round(Number(f.late_fee || 0) * 100) : toCents(f.late_fee) ?? 0;
      return api.patch(`/leases/${lease.id}`, {
        end_date: f.end_date || null,
        rent_cents: toCents(f.rent),
        due_day: Number(f.due_day),
        deposit_cents: toCents(f.deposit) ?? 0,
        late_fee_type: lateAmount ? f.late_fee_type : "none",
        late_fee_amount: lateAmount,
        grace_days: Number(f.grace_days || 0),
        notes: f.notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease", lease.id] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("leases.edit_terms")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.rent) || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p className="small muted">{t("leases.edit_terms_note")}</p>
        <div className="form-row-3">
          <Field label={t("leases.monthly_rent")}>
            <MoneyInput value={f.rent} onChange={(v) => setF({ ...f, rent: v })} />
          </Field>
          <Field label={t("leases.due_day")}>
            <Select
              value={f.due_day}
              onChange={(e) => setF({ ...f, due_day: e.target.value })}
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))}
            />
          </Field>
          <Field label={t("leases.end_date")} hint={t("leases.end_date_blank")}>
            <Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("leases.late_fee")}>
            <Select
              value={f.late_fee_type}
              onChange={(e) => setF({ ...f, late_fee_type: e.target.value as "flat" | "percent" })}
              options={[
                { value: "flat", label: t("enums.flat") },
                { value: "percent", label: t("enums.percent") },
              ]}
            />
          </Field>
          <Field label={f.late_fee_type === "percent" ? t("leases.percent") : t("common.amount")} hint={t("leases.blank_none")}>
            {f.late_fee_type === "percent" ? (
              <Input type="number" min={0} max={100} step="0.5" value={f.late_fee} onChange={(e) => setF({ ...f, late_fee: e.target.value })} />
            ) : (
              <MoneyInput value={f.late_fee} onChange={(v) => setF({ ...f, late_fee: v })} />
            )}
          </Field>
          <Field label={t("leases.grace_days_short")}>
            <Input type="number" min={0} max={27} value={f.grace_days} onChange={(e) => setF({ ...f, grace_days: e.target.value })} />
          </Field>
        </div>
        <Field label={t("leases.deposit")}>
          <MoneyInput value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
        </Field>
        <Field label={t("common.notes")}>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ChargeModal({ leaseId, onClose }: { leaseId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({ charge_type: "parking", description: "", amount: "" });
  const save = useMutation({
    mutationFn: () => api.post(`/leases/${leaseId}/charges`, { charge_type: f.charge_type, description: f.description, amount_cents: toCents(f.amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease", leaseId] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("leases.add_recurring")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.description || !toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <Field label={t("common.type")}>
          <Select value={f.charge_type} onChange={(e) => setF({ ...f, charge_type: e.target.value })} options={["parking", "pet", "utility", "storage", "other"]} />
        </Field>
        <Field label={t("common.description")}>
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t("leases.charge_placeholder")} />
        </Field>
        <Field label={t("leases.monthly_amount")}>
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <p className="small muted">{t("leases.charge_note")}</p>
      </div>
    </Modal>
  );
}

function EndLeaseModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [endedOn, setEndedOn] = useState(lease.end_date && lease.end_date < todayISO() ? lease.end_date : todayISO());
  const save = useMutation({
    mutationFn: () => api.post(`/leases/${lease.id}/end`, { ended_on: endedOn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease", lease.id] });
      qc.invalidateQueries({ queryKey: ["leases"] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("leases.end")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("leases.end")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p>{t("leases.end_explainer")}</p>
        <Field label={t("leases.end_date_label")}>
          <Input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function LeaseDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { can, org } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"ledger" | "payments" | "documents" | "signing" | "renewal" | "move">("ledger");
  const [modal, setModal] = useState<"payment" | "adjust" | "terms" | "charge" | "end" | null>(null);
  const canEdit = can("owner", "manager");

  const { data: lease, error, isLoading } = useQuery({ queryKey: ["lease", id], queryFn: () => api.get<Lease>(`/leases/${id}`) });
  const { data: ledger } = useQuery({ queryKey: ["ledger", id, lease?.balance_cents], queryFn: () => api.get<LedgerRow[]>(`/leases/${id}/ledger`), enabled: !!lease });
  const { data: payments } = useQuery({ queryKey: ["payments", id], queryFn: () => api.get<Payment[]>(`/payments?lease_id=${id}`), enabled: tab === "payments" });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lease", id] });
    qc.invalidateQueries({ queryKey: ["ledger", id] });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };
  const removeEntry = useMutation({ mutationFn: (entryId: string) => api.del(`/leases/${id}/ledger/${entryId}`), onSuccess: refresh });
  const voidPayment = useMutation({ mutationFn: (pid: string) => api.post(`/payments/${pid}/void`), onSuccess: refresh });
  const removeCharge = useMutation({ mutationFn: (cid: string) => api.del(`/leases/${id}/charges/${cid}`), onSuccess: refresh });
  const resend = useMutation({ mutationFn: (pid: string) => api.post(`/payments/${pid}/send-receipt`) });
  const onlineConfigured =
    useQuery({
      queryKey: ["payment-settings"],
      queryFn: () => api.get<{ stripe_configured: boolean }>("/online-payments/settings"),
      enabled: canEdit,
    }).data?.stripe_configured ?? false;
  const toggleBlock = useMutation({ mutationFn: (block: boolean) => api.patch(`/leases/${id}`, { block_online_payments: block }), onSuccess: refresh });
  const deleteLease = useMutation({
    mutationFn: () => api.del(`/leases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leases"] });
      navigate("/leases");
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !lease) return <ErrorBox error={error} />;

  const lateFee =
    lease.late_fee_type === "none"
      ? t("common.none")
      : lease.late_fee_type === "flat"
        ? t("leases.late_fee_flat_desc", { amount: money(lease.late_fee_amount), days: lease.grace_days })
        : t("leases.late_fee_pct_desc", { pct: lease.late_fee_amount / 100, days: lease.grace_days });
  const balanceSub = lease.balance_cents > 0 ? t("leases.owed_by_tenant") : lease.balance_cents < 0 ? t("leases.tenant_credit") : t("leases.paid_in_full");

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/leases">{t("nav.leases")}</Link>}
        title={
          <>
            {lease.property?.name} · {lease.unit?.name} <Badge value={lease.status} />
          </>
        }
        subtitle={lease.tenants.map((tn) => tn.name).join(", ")}
        actions={
          canEdit && (
            <>
              <button className="btn btn-primary" onClick={() => setModal("payment")}>
                <DollarSign size={15} /> {t("payments.record")}
              </button>
              <button className="btn" onClick={() => setModal("adjust")}>
                <Plus size={15} /> {t("ledger.charge_credit")}
              </button>
              <button className="btn" onClick={() => setModal("terms")}>
                <Pencil size={15} /> {t("common.edit")}
              </button>
              {lease.status === "active" && (
                <button className="btn" onClick={() => setModal("end")}>
                  <CalendarX size={15} /> {t("leases.end")}
                </button>
              )}
            </>
          )
        }
      />
      <div className="stack">
        <ErrorBox error={removeEntry.error || voidPayment.error || removeCharge.error || deleteLease.error} />
        <div className="grid grid-4">
          <div className="card stat">
            <div className="stat-label">{t("common.balance")}</div>
            <div className="stat-value">
              <BalanceText cents={lease.balance_cents} currency={org?.currency} />
            </div>
            <div className="stat-sub">{balanceSub}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("leases.monthly")}</div>
            <div className="stat-value">{money(lease.monthly_total_cents)}</div>
            <div className="stat-sub">
              {t("leases.due_on", { day: ordinal(lease.due_day) })}
              {lease.recurring_charges?.length ? ` · ${t("leases.rent_amount", { amount: money(lease.rent_cents) })}` : ""}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("leases.term")}</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {date(lease.start_date)} – {lease.end_date ? date(lease.end_date) : t("common.mtm_short")}
            </div>
            {lease.ended_on && <div className="stat-sub">{t("leases.ended_on", { date: date(lease.ended_on) })}</div>}
          </div>
          <div className="card stat">
            <div className="stat-label">{t("leases.deposit_short")}</div>
            <div className="stat-value">{money(lease.deposit_cents)}</div>
            <div className="stat-sub">{t("leases.late_fee_line", { desc: lateFee })}</div>
          </div>
        </div>

        <div className="two-col">
          <div className="stack">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "ledger", label: t("ledger.title") },
                { id: "payments", label: t("nav.payments") },
                { id: "documents", label: t("documents.title") },
                { id: "signing", label: t("signing.tab") },
                { id: "renewal", label: t("renewal.tab") },
                { id: "move", label: t("inspections.tab") },
              ]}
            />
            {tab === "ledger" && (
              <Card pad={false}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("common.date")}</th>
                        <th>{t("common.description")}</th>
                        <th className="num">{t("ledger.charges")}</th>
                        <th className="num">{t("ledger.payments")}</th>
                        <th className="num">{t("common.balance")}</th>
                        {canEdit && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(ledger ?? [])].reverse().map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{date(r.entry_date)}</td>
                          <td>
                            {r.description} {r.entry_type === "late_fee" && <Badge tone="citrine">{label("late_fee")}</Badge>}
                          </td>
                          <td className="num">{r.amount_cents > 0 ? money(r.amount_cents) : ""}</td>
                          <td className="num success-text">{r.amount_cents < 0 ? money(-r.amount_cents) : ""}</td>
                          <td className="num">{money(r.balance_cents)}</td>
                          {canEdit && (
                            <td className="right">
                              {!r.payment_id && (
                                <button
                                  className="icon-btn"
                                  aria-label={t("ledger.remove_entry")}
                                  title={["rent", "recurring", "late_fee"].includes(r.entry_type) ? t("ledger.reverse_title") : t("ledger.delete_title")}
                                  onClick={() => window.confirm(t("ledger.remove_confirm", { description: r.description })) && removeEntry.mutate(r.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {ledger?.length === 0 && (
                        <tr>
                          <td colSpan={6} className="muted">
                            {t("ledger.empty")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {tab === "payments" && (
              <Card pad={false}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("common.date")}</th>
                        <th>{t("payments.receipt")}</th>
                        <th>{t("common.method")}</th>
                        <th className="num">{t("common.amount")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {payments?.map((p) => (
                        <tr key={p.id} className={p.voided_at ? "voided" : ""}>
                          <td>{date(p.received_on)}</td>
                          <td>
                            {p.receipt_number}
                            {p.reference && <div className="small muted">{p.reference}</div>}
                          </td>
                          <td>
                            {label(p.method)} <PaymentBadges p={p} />
                          </td>
                          <td className="num">{money(p.amount_cents)}</td>
                          <td className="right nowrap">
                            {!p.voided_at && p.status === "succeeded" && (
                              <>
                                <a
                                  className="icon-btn"
                                  href={fileUrl(`/payments/${p.id}/receipt.pdf`)}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={t("payments.receipt_pdf")}
                                  title={t("payments.receipt_pdf")}
                                >
                                  <FileDown size={15} />
                                </a>
                                {canEdit && p.source === "manual" && (
                                  <>
                                    <button className="btn btn-sm btn-ghost" onClick={() => resend.mutate(p.id)} disabled={resend.isPending}>
                                      {t("payments.email_action")}
                                    </button>
                                    <button
                                      className="icon-btn"
                                      aria-label={t("payments.void")}
                                      title={t("payments.void")}
                                      onClick={() => window.confirm(t("payments.void_confirm")) && voidPayment.mutate(p.id)}
                                    >
                                      <Ban size={15} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            {p.voided_at && <span className="badge">{t("payments.voided")}</span>}
                          </td>
                        </tr>
                      ))}
                      {payments?.length === 0 && (
                        <tr>
                          <td colSpan={5} className="muted">
                            {t("payments.none_recorded")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {resend.isSuccess && <div className="card-body success-box">{t("payments.receipt_sent")}</div>}
              </Card>
            )}
            {tab === "documents" && <DocumentsPanel ownerType="lease" ownerId={lease.id} allowTenantShare />}
            {tab === "signing" && <SignaturesPanel lease={lease} />}
            {tab === "renewal" && <RenewalPanel lease={lease} />}
            {tab === "move" && <MovePanel lease={lease} />}
          </div>

          <div className="stack">
            <Card title={t("common.tenants")}>
              <ul className="list-plain">
                {lease.tenants.map((tn) => (
                  <li key={tn.id}>
                    <div>
                      <Link to={`/tenants/${tn.id}`} className="row-link">
                        {tn.name}
                      </Link>{" "}
                      {tn.is_primary && <Badge tone="carnelian">{t("leases.primary")}</Badge>}
                      <div className="small muted">{tn.email ?? tn.phone ?? t("leases.no_contact")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card
              title={t("leases.recurring_charges")}
              actions={
                canEdit &&
                lease.status === "active" && (
                  <button className="btn btn-sm" onClick={() => setModal("charge")}>
                    <Plus size={14} /> {t("common.add")}
                  </button>
                )
              }
            >
              {lease.recurring_charges?.length ? (
                <ul className="list-plain">
                  {lease.recurring_charges.map((c) => (
                    <li key={c.id}>
                      <span>
                        {c.description} <span className="small muted">· {label(c.charge_type)}</span>
                      </span>
                      <span className="nowrap">
                        <span className="mono">{money(c.amount_cents)}</span>
                        {canEdit && (
                          <button
                            className="icon-btn"
                            aria-label={t("leases.remove_charge_label", { name: c.description })}
                            onClick={() => window.confirm(t("leases.stop_charge_confirm", { name: c.description })) && removeCharge.mutate(c.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t("common.none")}.</p>
              )}
            </Card>
            <Card title={t("leases.details")}>
              <dl className="dl small">
                <dt>{t("leases.address")}</dt>
                <dd>{lease.property?.address}</dd>
                <dt>{t("leases.auto_billing_from")}</dt>
                <dd>{date(lease.charges_start_on)}</dd>
              </dl>
              {canEdit && onlineConfigured && (
                <label className="check small" style={{ marginTop: 12 }} title={t("online.block_hint")}>
                  <input type="checkbox" checked={!!lease.block_online_payments} onChange={(e) => toggleBlock.mutate(e.target.checked)} disabled={toggleBlock.isPending} />
                  {t("online.block_label")}
                </label>
              )}
              <dl className="dl small">
                {lease.notes && (
                  <>
                    <dt>{t("common.notes")}</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{lease.notes}</dd>
                  </>
                )}
              </dl>
              {canEdit && (
                <button
                  className="btn btn-sm btn-danger"
                  style={{ marginTop: 14 }}
                  onClick={() => window.confirm(t("leases.delete_confirm")) && deleteLease.mutate()}
                >
                  <Trash2 size={14} /> {t("leases.delete")}
                </button>
              )}
            </Card>
          </div>
        </div>
      </div>
      {modal === "payment" && <PaymentModal lease={lease} onClose={() => setModal(null)} />}
      {modal === "adjust" && <AdjustmentModal leaseId={lease.id} onClose={() => setModal(null)} />}
      {modal === "terms" && <EditTermsModal lease={lease} onClose={() => setModal(null)} />}
      {modal === "charge" && <ChargeModal leaseId={lease.id} onClose={() => setModal(null)} />}
      {modal === "end" && <EndLeaseModal lease={lease} onClose={() => setModal(null)} />}
    </>
  );
}
