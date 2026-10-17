import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, Download, FileDown, Paperclip, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { DocumentRow, Expense, Payment, Property, Unit } from "../types";
import { BalanceText, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Tabs, Textarea } from "../components/ui";
import { date, fromCents, label, money, toCents, todayISO } from "../utils/format";

export const EXPENSE_CATEGORIES = [
  "repairs",
  "cleaning_maintenance",
  "utilities",
  "insurance",
  "taxes",
  "mortgage_interest",
  "hoa",
  "management_fees",
  "legal_professional",
  "supplies",
  "advertising",
  "auto_travel",
  "commissions",
  "other_interest",
  "capital_improvement",
  "other",
];

// ── Payments ─────────────────────────────────────────────────────────────────

export function PaymentsPage() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useQuery({ queryKey: ["payments", "all"], queryFn: () => api.get<Payment[]>("/payments") });
  const total = (data ?? []).filter((p) => !p.voided_at).reduce((s, p) => s + p.amount_cents, 0);
  return (
    <>
      <PageHeader title={t("nav.payments")} subtitle={t("payments.page_subtitle")} />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<CreditCard size={40} />} title={t("payments.empty_title")}>
            {t("payments.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false} title={<span className="muted small">{t("payments.summary", { count: data?.length ?? 0, total: money(total) })}</span>}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("enums.tenant")}</th>
                  <th>{t("leases.property_unit")}</th>
                  <th>{t("common.method")}</th>
                  <th>{t("payments.receipt")}</th>
                  <th className="num">{t("common.amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((p) => (
                  <tr key={p.id} className={p.voided_at ? "voided" : ""}>
                    <td className="nowrap">{date(p.received_on)}</td>
                    <td>{p.tenant_name ?? "—"}</td>
                    <td>
                      <Link to={`/leases/${p.lease_id}`}>
                        {p.property_name} · {p.unit_name}
                      </Link>
                    </td>
                    <td>
                      {label(p.method)}
                      {p.reference && <div className="small muted">{p.reference}</div>}
                    </td>
                    <td className="small">{p.receipt_number}</td>
                    <td className="num">{money(p.amount_cents)}</td>
                    <td className="right">
                      {!p.voided_at && (
                        <a className="icon-btn" href={fileUrl(`/payments/${p.id}/receipt.pdf`)} target="_blank" rel="noreferrer" aria-label={t("payments.receipt_pdf")}>
                          <FileDown size={15} />
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
    </>
  );
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export function ExpenseModal({ expense, onClose, defaults }: { expense?: Expense; onClose: () => void; defaults?: Partial<Expense> }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get<Unit[]>("/units") });
  const [f, setF] = useState({
    property_id: expense?.property_id ?? defaults?.property_id ?? "",
    unit_id: expense?.unit_id ?? defaults?.unit_id ?? "",
    category: expense?.category ?? "repairs",
    amount: fromCents(expense?.amount_cents),
    expense_date: expense?.expense_date ?? todayISO(),
    vendor: expense?.vendor ?? "",
    description: expense?.description ?? "",
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      let receipt_document_id = expense?.receipt_document_id ?? null;
      if (receipt) {
        const form = new FormData();
        form.append("file", receipt);
        form.append("owner_type", "property");
        form.append("owner_id", f.property_id);
        form.append("kind", "receipt");
        receipt_document_id = (await api.upload<DocumentRow>("/documents", form)).id;
      }
      const body = {
        ...f,
        unit_id: f.unit_id || null,
        amount_cents: toCents(f.amount),
        vendor: f.vendor || null,
        description: f.description || null,
        receipt_document_id,
      };
      return expense ? api.patch(`/expenses/${expense.id}`, body) : api.post("/expenses", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });
  const propUnits = (units ?? []).filter((u) => u.property_id === f.property_id);
  return (
    <Modal
      title={expense ? t("expenses.edit_title") : t("expenses.add")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.property_id || !toCents(f.amount) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("expenses.save")}
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
          <Field label={t("common.unit")} hint={t("common.optional_hint")}>
            <Select
              value={f.unit_id}
              onChange={(e) => setF({ ...f, unit_id: e.target.value })}
              options={[{ value: "", label: t("common.whole_property") }, ...propUnits.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("common.amount")}>
            <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
          </Field>
          <Field label={t("common.date")}>
            <Input type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
          </Field>
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES} />
          </Field>
        </div>
        <Field label={t("expenses.vendor_payee")}>
          <Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder={t("expenses.vendor_placeholder")} />
        </Field>
        <Field label={t("common.description")}>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label={t("enums.receipt")} hint={expense?.receipt_document_id ? t("expenses.receipt_replace") : t("expenses.receipt_hint")}>
          <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
    </Modal>
  );
}

export function ExpensesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [filters, setFilters] = useState({ property_id: "", category: "", start: `${year}-01-01`, end: `${year}-12-31` });
  const [modal, setModal] = useState<{ expense?: Expense } | null>(null);
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data, error, isLoading } = useQuery({ queryKey: ["expenses", qs], queryFn: () => api.get<Expense[]>(`/expenses?${qs}`) });
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/expenses/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }) });
  const canEdit = can("owner", "manager");
  const total = (data ?? []).reduce((s, e) => s + e.amount_cents, 0);

  return (
    <>
      <PageHeader
        title={t("nav.expenses")}
        actions={
          <>
            <a className="btn" href={fileUrl(`/reports/expenses.csv?start=${filters.start}&end=${filters.end}`)}>
              <Download size={15} /> {t("common.export_csv")}
            </a>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setModal({})}>
                <Plus size={16} /> {t("expenses.add")}
              </button>
            )}
          </>
        }
      />
      <div className="toolbar">
        <Select
          value={filters.property_id}
          onChange={(e) => setFilters({ ...filters, property_id: e.target.value })}
          aria-label={t("common.property")}
          options={[{ value: "", label: t("common.all_properties") }, ...(properties ?? []).map((p) => ({ value: p.id, label: p.name }))]}
        />
        <Select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          aria-label={t("common.category")}
          options={[{ value: "", label: t("common.all_categories") }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: label(c) }))]}
        />
        <input className="input" type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} aria-label={t("common.from")} />
        <input className="input" type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} aria-label={t("common.to")} />
      </div>
      <ErrorBox error={error || remove.error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty
            icon={<Receipt size={40} />}
            title={t("expenses.empty_title")}
            action={
              canEdit && (
                <button className="btn btn-primary" onClick={() => setModal({})}>
                  {t("expenses.add")}
                </button>
              )
            }
          >
            {t("expenses.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false} title={<span className="muted small">{t("expenses.summary", { count: data?.length ?? 0, total: money(total) })}</span>}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("common.property")}</th>
                  <th>{t("common.category")}</th>
                  <th>{t("expenses.vendor_description")}</th>
                  <th className="num">{t("common.amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{date(e.expense_date)}</td>
                    <td>
                      {e.property_name}
                      {e.unit_name && <span className="muted"> · {e.unit_name}</span>}
                    </td>
                    <td>{label(e.category)}</td>
                    <td>
                      {e.vendor && <strong>{e.vendor}</strong>}
                      {e.description && <div className="small muted">{e.description}</div>}
                    </td>
                    <td className="num">{money(e.amount_cents)}</td>
                    <td className="right nowrap">
                      {e.receipt_document_id && (
                        <a className="icon-btn" href={fileUrl(`/documents/${e.receipt_document_id}/file`)} target="_blank" rel="noreferrer" aria-label={t("expenses.view_receipt")}>
                          <Paperclip size={15} />
                        </a>
                      )}
                      {canEdit && (
                        <>
                          <button className="icon-btn" aria-label={t("expenses.edit_title")} onClick={() => setModal({ expense: e })}>
                            <Pencil size={15} />
                          </button>
                          <button className="icon-btn" aria-label={t("expenses.delete")} onClick={() => window.confirm(t("expenses.delete_confirm")) && remove.mutate(e.id)}>
                            <Trash2 size={15} />
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
      {modal && <ExpenseModal expense={modal.expense} onClose={() => setModal(null)} />}
    </>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

interface Pnl {
  rows: { key: string; income_cents: number; expense_cents: number; net_cents: number }[];
  totals: { income_cents: number; expense_cents: number; net_cents: number };
  expenses_by_category: Record<string, number>;
}
interface RentRollRow {
  property_name: string;
  unit_name: string;
  unit_id: string;
  status: string;
  lease_id: string | null;
  tenants: string;
  rent_cents: number;
  market_rent_cents: number | null;
  lease_end: string | null;
  balance_cents: number;
}
interface OutstandingRow {
  lease_id: string;
  lease_status: string;
  property_name: string;
  unit_name: string;
  tenants: string;
  balance_cents: number;
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "pnl" | "rentroll" | "outstanding") ?? "pnl";
  const year = new Date().getFullYear();
  const [range, setRange] = useState({ start: `${year}-01-01`, end: `${year}-12-31`, group_by: "property" });
  const pnlQs = new URLSearchParams(range).toString();
  const pnl = useQuery({ queryKey: ["pnl", pnlQs], queryFn: () => api.get<Pnl>(`/reports/pnl?${pnlQs}`), enabled: tab === "pnl" });
  const roll = useQuery({ queryKey: ["rentroll"], queryFn: () => api.get<RentRollRow[]>("/reports/rent-roll"), enabled: tab === "rentroll" });
  const owed = useQuery({ queryKey: ["outstanding"], queryFn: () => api.get<OutstandingRow[]>("/reports/outstanding"), enabled: tab === "outstanding" });

  return (
    <>
      <PageHeader title={t("nav.reports")} subtitle={t("reports.subtitle")} />
      <Tabs
        value={tab}
        onChange={(next) => setParams({ tab: next })}
        tabs={[
          { id: "pnl", label: t("reports.pnl") },
          { id: "rentroll", label: t("reports.rent_roll") },
          { id: "outstanding", label: t("reports.outstanding") },
        ]}
      />
      {tab === "pnl" && (
        <div className="stack">
          <div className="toolbar">
            <input className="input" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} aria-label={t("common.from")} />
            <input className="input" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} aria-label={t("common.to")} />
            <Select
              value={range.group_by}
              onChange={(e) => setRange({ ...range, group_by: e.target.value })}
              aria-label={t("reports.group_by")}
              options={[
                { value: "property", label: t("reports.by_property") },
                { value: "unit", label: t("reports.by_unit") },
                { value: "month", label: t("reports.by_month") },
              ]}
            />
            <a className="btn" href={fileUrl(`/reports/pnl?${pnlQs}&format=csv`)}>
              <Download size={15} /> {t("common.export_csv")}
            </a>
          </div>
          <ErrorBox error={pnl.error} />
          {pnl.data && (
            <div className="two-col">
              <Card pad={false}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{label(range.group_by)}</th>
                        <th className="num">{t("chart.income")}</th>
                        <th className="num">{t("chart.expenses")}</th>
                        <th className="num">{t("reports.net")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pnl.data.rows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.key}</td>
                          <td className="num">{money(r.income_cents)}</td>
                          <td className="num">{money(r.expense_cents)}</td>
                          <td className={`num ${r.net_cents < 0 ? "danger-text" : ""}`}>{money(r.net_cents)}</td>
                        </tr>
                      ))}
                      {pnl.data.rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted">
                            {t("reports.pnl_empty")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>{t("reports.total")}</td>
                        <td className="num">{money(pnl.data.totals.income_cents)}</td>
                        <td className="num">{money(pnl.data.totals.expense_cents)}</td>
                        <td className="num">{money(pnl.data.totals.net_cents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
              <Card title={t("reports.by_category")}>
                {Object.keys(pnl.data.expenses_by_category).length === 0 ? (
                  <p className="muted">{t("reports.no_expenses")}</p>
                ) : (
                  <ul className="list-plain">
                    {Object.entries(pnl.data.expenses_by_category).map(([cat, cents]) => (
                      <li key={cat}>
                        <span>{label(cat)}</span>
                        <span className="mono">{money(cents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
      {tab === "rentroll" && (
        <Card
          pad={false}
          actions={
            <a className="btn btn-sm" href={fileUrl("/reports/rent-roll?format=csv")}>
              <Download size={14} /> {t("common.export_csv")}
            </a>
          }
          title={t("reports.rent_roll")}
        >
          <ErrorBox error={roll.error} />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("leases.property_unit")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.tenants")}</th>
                  <th>{t("reports.lease_ends")}</th>
                  <th className="num">{t("common.rent")}</th>
                  <th className="num">{t("reports.market")}</th>
                  <th className="num">{t("common.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {roll.data?.map((r) => (
                  <tr key={r.unit_id}>
                    <td>
                      {r.lease_id ? (
                        <Link to={`/leases/${r.lease_id}`}>
                          {r.property_name} · {r.unit_name}
                        </Link>
                      ) : (
                        `${r.property_name} · ${r.unit_name}`
                      )}
                    </td>
                    <td>{label(r.status)}</td>
                    <td>{r.tenants || "—"}</td>
                    <td>{r.lease_id ? (r.lease_end ? date(r.lease_end) : t("common.mtm_short")) : "—"}</td>
                    <td className="num">{r.lease_id ? money(r.rent_cents) : "—"}</td>
                    <td className="num muted">{money(r.market_rent_cents)}</td>
                    <td className="num">{r.lease_id ? <BalanceText cents={r.balance_cents} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "outstanding" && (
        <Card
          pad={false}
          title={t("reports.outstanding")}
          actions={
            <a className="btn btn-sm" href={fileUrl("/reports/outstanding?format=csv")}>
              <Download size={14} /> {t("common.export_csv")}
            </a>
          }
        >
          <ErrorBox error={owed.error} />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.tenants")}</th>
                  <th>{t("leases.property_unit")}</th>
                  <th>{t("enums.lease")}</th>
                  <th className="num">{t("common.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {owed.data?.map((r) => (
                  <tr key={r.lease_id}>
                    <td>
                      <Link to={`/leases/${r.lease_id}`} className="row-link">
                        {r.tenants || "—"}
                      </Link>
                    </td>
                    <td>
                      {r.property_name} · {r.unit_name}
                    </td>
                    <td>{label(r.lease_status)}</td>
                    <td className="num">
                      <BalanceText cents={r.balance_cents} />
                    </td>
                  </tr>
                ))}
                {owed.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      {t("reports.nothing_outstanding")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
