import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarX, DollarSign, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease, LedgerRow, Payment } from "../types";
import { DocumentsPanel } from "../components/Documents";
import { Badge, BalanceText, Card, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Tabs, Textarea } from "../components/ui";
import { date, fromCents, label, money, ordinal, toCents, todayISO } from "../utils/format";

const METHODS = ["zelle", "check", "cash", "venmo", "bank_transfer", "card", "other"];

function PaymentModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    amount: lease.balance_cents > 0 ? fromCents(lease.balance_cents) : "",
    method: "zelle",
    received_on: todayISO(),
    tenant_id: lease.tenants.find((t) => t.is_primary)?.id ?? lease.tenants[0]?.id ?? "",
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
  const payer = lease.tenants.find((t) => t.id === f.tenant_id);
  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : `Record ${toCents(f.amount) ? money(toCents(f.amount)) : "payment"}`}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label="Amount" hint={`balance ${money(lease.balance_cents)}`}>
            <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} autoFocus />
          </Field>
          <Field label="Date received">
            <Input type="date" value={f.received_on} onChange={(e) => setF({ ...f, received_on: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Method">
            <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={METHODS} />
          </Field>
          <Field label="Reference" hint="check # / confirmation">
            <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </Field>
        </div>
        {lease.tenants.length > 1 && (
          <Field label="Paid by">
            <Select value={f.tenant_id} onChange={(e) => setF({ ...f, tenant_id: e.target.value })} options={lease.tenants.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
        )}
        <Field label="Notes" hint="(optional)">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.send_receipt} disabled={!payer?.email} onChange={(e) => setF({ ...f, send_receipt: e.target.checked })} />
          Email a PDF receipt {payer?.email ? `to ${payer.email}` : "(tenant has no email)"}
        </label>
      </div>
    </Modal>
  );
}

function AdjustmentModal({ leaseId, onClose }: { leaseId: string; onClose: () => void }) {
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
      title="Add charge or credit"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!f.description || !toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label="Type">
            <Select
              value={f.entry_type}
              onChange={(e) => setF({ ...f, entry_type: e.target.value })}
              options={[
                { value: "charge", label: "Charge (tenant owes more)" },
                { value: "credit", label: "Credit (tenant owes less)" },
              ]}
            />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={f.entry_type === "charge" ? "Prorated rent, damage repair…" : "Repair reimbursement, concession…"} />
        </Field>
        <Field label="Amount">
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
      </div>
    </Modal>
  );
}

function EditTermsModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
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
      title="Edit lease terms"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.rent) || save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p className="small muted">Changes apply to future rent postings. Already-posted charges are not changed.</p>
        <div className="form-row-3">
          <Field label="Monthly rent">
            <MoneyInput value={f.rent} onChange={(v) => setF({ ...f, rent: v })} />
          </Field>
          <Field label="Due day">
            <Select value={f.due_day} onChange={(e) => setF({ ...f, due_day: e.target.value })} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))} />
          </Field>
          <Field label="End date" hint="blank = month-to-month">
            <Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label="Late fee">
            <Select
              value={f.late_fee_type}
              onChange={(e) => setF({ ...f, late_fee_type: e.target.value as "flat" | "percent" })}
              options={[
                { value: "flat", label: "Flat amount" },
                { value: "percent", label: "% of rent" },
              ]}
            />
          </Field>
          <Field label={f.late_fee_type === "percent" ? "Percent" : "Amount"} hint="blank = none">
            {f.late_fee_type === "percent" ? (
              <Input type="number" min={0} max={100} step="0.5" value={f.late_fee} onChange={(e) => setF({ ...f, late_fee: e.target.value })} />
            ) : (
              <MoneyInput value={f.late_fee} onChange={(v) => setF({ ...f, late_fee: v })} />
            )}
          </Field>
          <Field label="Grace days">
            <Input type="number" min={0} max={27} value={f.grace_days} onChange={(e) => setF({ ...f, grace_days: e.target.value })} />
          </Field>
        </div>
        <Field label="Security deposit">
          <MoneyInput value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
        </Field>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ChargeModal({ leaseId, onClose }: { leaseId: string; onClose: () => void }) {
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
      title="Add recurring charge"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!f.description || !toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <Field label="Type">
          <Select value={f.charge_type} onChange={(e) => setF({ ...f, charge_type: e.target.value })} options={["parking", "pet", "utility", "storage", "other"]} />
        </Field>
        <Field label="Description">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Parking space #4" />
        </Field>
        <Field label="Monthly amount">
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <p className="small muted">Posted with rent starting from the next due date.</p>
      </div>
    </Modal>
  );
}

function EndLeaseModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
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
      title="End lease"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            End lease
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <p>No more rent will be posted after this date and the unit will be marked vacant. The ledger stays available so you can settle the final balance and deposit.</p>
        <Field label="Move-out / end date">
          <Input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function LeaseDetailPage() {
  const { id = "" } = useParams();
  const { can, org } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"ledger" | "payments" | "documents">("ledger");
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
    lease.late_fee_type === "none" ? "None" : lease.late_fee_type === "flat" ? `${money(lease.late_fee_amount)} after ${lease.grace_days} days` : `${lease.late_fee_amount / 100}% of rent after ${lease.grace_days} days`;

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/leases">Leases</Link>}
        title={
          <>
            {lease.property?.name} · {lease.unit?.name} <Badge value={lease.status} />
          </>
        }
        subtitle={lease.tenants.map((t) => t.name).join(", ")}
        actions={
          canEdit && (
            <>
              <button className="btn btn-primary" onClick={() => setModal("payment")}>
                <DollarSign size={15} /> Record payment
              </button>
              <button className="btn" onClick={() => setModal("adjust")}>
                <Plus size={15} /> Charge / credit
              </button>
              <button className="btn" onClick={() => setModal("terms")}>
                <Pencil size={15} /> Edit
              </button>
              {lease.status === "active" && (
                <button className="btn" onClick={() => setModal("end")}>
                  <CalendarX size={15} /> End lease
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
            <div className="stat-label">Balance</div>
            <div className="stat-value">
              <BalanceText cents={lease.balance_cents} currency={org?.currency} />
            </div>
            <div className="stat-sub">{lease.balance_cents > 0 ? "owed by tenant" : lease.balance_cents < 0 ? "tenant has a credit" : "paid in full"}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Monthly</div>
            <div className="stat-value">{money(lease.monthly_total_cents)}</div>
            <div className="stat-sub">
              Due on the {ordinal(lease.due_day)}
              {lease.recurring_charges?.length ? ` · rent ${money(lease.rent_cents)}` : ""}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">Term</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {date(lease.start_date)} – {lease.end_date ? date(lease.end_date) : "M-to-M"}
            </div>
            {lease.ended_on && <div className="stat-sub">Ended {date(lease.ended_on)}</div>}
          </div>
          <div className="card stat">
            <div className="stat-label">Deposit</div>
            <div className="stat-value">{money(lease.deposit_cents)}</div>
            <div className="stat-sub">Late fee: {lateFee}</div>
          </div>
        </div>

        <div className="two-col">
          <div className="stack">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "ledger", label: "Ledger" },
                { id: "payments", label: "Payments" },
                { id: "documents", label: "Documents" },
              ]}
            />
            {tab === "ledger" && (
              <Card pad={false}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th className="num">Charges</th>
                        <th className="num">Payments</th>
                        <th className="num">Balance</th>
                        {canEdit && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {[...(ledger ?? [])].reverse().map((r) => (
                        <tr key={r.id}>
                          <td className="nowrap">{date(r.entry_date)}</td>
                          <td>
                            {r.description} {r.entry_type === "late_fee" && <Badge tone="citrine">Late fee</Badge>}
                          </td>
                          <td className="num">{r.amount_cents > 0 ? money(r.amount_cents) : ""}</td>
                          <td className="num success-text">{r.amount_cents < 0 ? money(-r.amount_cents) : ""}</td>
                          <td className="num">{money(r.balance_cents)}</td>
                          {canEdit && (
                            <td className="right">
                              {!r.payment_id && (
                                <button
                                  className="icon-btn"
                                  aria-label="Remove entry"
                                  title={["rent", "recurring", "late_fee"].includes(r.entry_type) ? "Reverse this charge" : "Delete entry"}
                                  onClick={() => window.confirm(`Remove “${r.description}”?`) && removeEntry.mutate(r.id)}
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
                            No entries yet. Rent posts automatically on the due date.
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
                        <th>Date</th>
                        <th>Receipt</th>
                        <th>Method</th>
                        <th className="num">Amount</th>
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
                          <td>{label(p.method)}</td>
                          <td className="num">{money(p.amount_cents)}</td>
                          <td className="right nowrap">
                            {!p.voided_at && (
                              <>
                                <a className="icon-btn" href={fileUrl(`/payments/${p.id}/receipt.pdf`)} target="_blank" rel="noreferrer" aria-label="Receipt PDF" title="Receipt PDF">
                                  <FileDown size={15} />
                                </a>
                                {canEdit && (
                                  <>
                                    <button className="btn btn-sm btn-ghost" onClick={() => resend.mutate(p.id)} disabled={resend.isPending}>
                                      Email
                                    </button>
                                    <button className="icon-btn" aria-label="Void payment" title="Void payment" onClick={() => window.confirm("Void this payment? It will be removed from the ledger.") && voidPayment.mutate(p.id)}>
                                      <Ban size={15} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                            {p.voided_at && <span className="badge">Voided</span>}
                          </td>
                        </tr>
                      ))}
                      {payments?.length === 0 && (
                        <tr>
                          <td colSpan={5} className="muted">
                            No payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {resend.isSuccess && <div className="card-body success-box">Receipt sent.</div>}
              </Card>
            )}
            {tab === "documents" && <DocumentsPanel ownerType="lease" ownerId={lease.id} allowTenantShare />}
          </div>

          <div className="stack">
            <Card title="Tenants">
              <ul className="list-plain">
                {lease.tenants.map((t) => (
                  <li key={t.id}>
                    <div>
                      <Link to={`/tenants/${t.id}`} className="row-link">
                        {t.name}
                      </Link>{" "}
                      {t.is_primary && <Badge tone="carnelian">Primary</Badge>}
                      <div className="small muted">{t.email ?? t.phone ?? "No contact info"}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card
              title="Recurring charges"
              actions={
                canEdit &&
                lease.status === "active" && (
                  <button className="btn btn-sm" onClick={() => setModal("charge")}>
                    <Plus size={14} /> Add
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
                          <button className="icon-btn" aria-label={`Remove ${c.description}`} onClick={() => window.confirm(`Stop charging ${c.description}?`) && removeCharge.mutate(c.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">None.</p>
              )}
            </Card>
            <Card title="Details">
              <dl className="dl small">
                <dt>Address</dt>
                <dd>{lease.property?.address}</dd>
                <dt>Auto-billing from</dt>
                <dd>{date(lease.charges_start_on)}</dd>
                {lease.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{lease.notes}</dd>
                  </>
                )}
              </dl>
              {canEdit && (
                <button className="btn btn-sm btn-danger" style={{ marginTop: 14 }} onClick={() => window.confirm("Delete this lease? Only possible when no payments were recorded.") && deleteLease.mutate()}>
                  <Trash2 size={14} /> Delete lease
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
