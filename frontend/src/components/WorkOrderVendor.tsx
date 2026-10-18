import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Mail, Plus, Trash2, X } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { WorkOrder } from "../types";
import { Stars, type Vendor } from "../pages/VendorPages";
import { Badge, Card, ErrorBox, Field, Input, Modal, MoneyInput, Select, Textarea } from "./ui";
import { date, label, money, toCents, todayISO } from "../utils/format";
import { EXPENSE_CATEGORIES } from "../pages/FinancePages";

export interface WoQuote {
  id: string;
  vendor_id: string;
  vendor_name: string;
  amount_cents: number;
  description: string | null;
  valid_until: string | null;
  status: "pending" | "approved" | "declined";
}
export interface WoInvoice {
  id: string;
  vendor_name: string;
  invoice_number: string | null;
  amount_cents: number;
  invoice_date: string;
  due_date: string | null;
  status: "unpaid" | "paid";
  paid_on: string | null;
}
export interface WoVendorExtras {
  vendor: { id: string; name: string; email: string | null; phone: string | null } | null;
  quotes: WoQuote[];
  invoices: WoInvoice[];
  vendor_rating?: number | null;
}

function useVendors() {
  return useQuery({ queryKey: ["vendors", "", false], queryFn: () => api.get<Vendor[]>("/vendors") });
}

function QuoteModal({ wo, onClose, onDone }: { wo: WorkOrder; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: vendors } = useVendors();
  const [f, setF] = useState({ vendor_id: "", amount: "", description: "", valid_until: "" });
  const save = useMutation({
    mutationFn: () =>
      api.post(`/work-orders/${wo.id}/quotes`, {
        vendor_id: f.vendor_id || vendors?.[0]?.id,
        amount_cents: toCents(f.amount),
        description: f.description || null,
        valid_until: f.valid_until || null,
      }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Modal
      title={t("workvendor.add_quote")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.amount) || !vendors?.length || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        {vendors && !vendors.length && (
          <div className="info-box">
            {t("workvendor.no_vendors")} <Link to="/vendors">{t("workvendor.add_vendor_link")}</Link>
          </div>
        )}
        <div className="form-row">
          <Field label={t("workvendor.vendor")}>
            <Select value={f.vendor_id || vendors?.[0]?.id || ""} onChange={(e) => setF({ ...f, vendor_id: e.target.value })} options={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} />
          </Field>
          <Field label={t("common.amount")}>
            <MoneyInput value={f.amount} onChange={(amount) => setF({ ...f, amount })} />
          </Field>
        </div>
        <Field label={t("workvendor.valid_until")}>
          <Input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} />
        </Field>
        <Field label={t("workvendor.scope")}>
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
        </Field>
        <p className="small muted">{t("workvendor.quote_doc_hint")}</p>
      </div>
    </Modal>
  );
}

function InvoiceModal({ wo, extras, onClose, onDone }: { wo: WorkOrder; extras: WoVendorExtras; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: vendors } = useVendors();
  const approved = extras.quotes.find((q) => q.status === "approved");
  const [f, setF] = useState({
    vendor_id: extras.vendor?.id ?? "",
    invoice_number: "",
    amount: approved ? (approved.amount_cents / 100).toFixed(2) : "",
    invoice_date: todayISO(),
    due_date: "",
    category: "repairs",
    paid: false,
    paid_on: todayISO(),
    complete: !["completed", "closed"].includes(wo.status),
  });
  const save = useMutation({
    mutationFn: () =>
      api.post(`/work-orders/${wo.id}/invoices`, {
        vendor_id: f.vendor_id || vendors?.[0]?.id,
        invoice_number: f.invoice_number || null,
        amount_cents: toCents(f.amount),
        invoice_date: f.invoice_date,
        due_date: f.due_date || null,
        category: f.category,
        paid_on: f.paid ? f.paid_on : null,
        complete_work_order: f.complete,
      }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Modal
      title={t("workvendor.record_invoice")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.amount) || !vendors?.length || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("workvendor.vendor")}>
            <Select value={f.vendor_id || vendors?.[0]?.id || ""} onChange={(e) => setF({ ...f, vendor_id: e.target.value })} options={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} />
          </Field>
          <Field label={t("workvendor.invoice_number")}>
            <Input value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} maxLength={60} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("common.amount")}>
            <MoneyInput value={f.amount} onChange={(amount) => setF({ ...f, amount })} />
          </Field>
          <Field label={t("workvendor.invoice_date")}>
            <Input type="date" value={f.invoice_date} onChange={(e) => setF({ ...f, invoice_date: e.target.value })} />
          </Field>
          <Field label={t("workvendor.due_date")}>
            <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </Field>
        </div>
        <Field label={t("workvendor.expense_category")} hint={t("workvendor.expense_hint")}>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: label(c) }))} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> {t("workvendor.already_paid")}
        </label>
        {f.paid && (
          <Field label={t("workvendor.paid_on")}>
            <Input type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} />
          </Field>
        )}
        {!["completed", "closed"].includes(wo.status) && (
          <label className="check">
            <input type="checkbox" checked={f.complete} onChange={(e) => setF({ ...f, complete: e.target.checked })} /> {t("workvendor.mark_completed")}
          </label>
        )}
      </div>
    </Modal>
  );
}

/** Vendor, quotes, invoices and rating for a work order. */
export function WorkOrderVendorCards({ wo, extras }: { wo: WorkOrder; extras: WoVendorExtras }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const { data: vendors } = useVendors();
  const [modal, setModal] = useState<"quote" | "invoice" | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [emailIt, setEmailIt] = useState(true);
  const [message, setMessage] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["work-order", wo.id] });
    qc.invalidateQueries({ queryKey: ["work-orders"] });
    qc.invalidateQueries({ queryKey: ["vendors"] });
  };
  const setVendor = useMutation({
    mutationFn: (vendor_id: string | null) => api.put<{ email_sent: boolean }>(`/work-orders/${wo.id}/vendor`, { vendor_id, email_vendor: !!vendor_id && emailIt, message: message || null }),
    onSuccess: () => {
      setPick(null);
      setMessage("");
      refresh();
    },
  });
  const decide = useMutation({ mutationFn: ({ id, action }: { id: string; action: "approve" | "decline" }) => api.post(`/quotes/${id}/${action}`), onSuccess: refresh });
  const delQuote = useMutation({ mutationFn: (id: string) => api.del(`/quotes/${id}`), onSuccess: refresh });
  const paid = useMutation({ mutationFn: (id: string) => api.post(`/invoices/${id}/paid`, { paid_on: todayISO() }), onSuccess: refresh });
  const delInvoice = useMutation({ mutationFn: (id: string) => api.del(`/invoices/${id}`), onSuccess: refresh });
  const rate = useMutation({ mutationFn: (rating: number) => api.post(`/work-orders/${wo.id}/rating`, { rating }), onSuccess: refresh });
  const picked = vendors?.find((v) => v.id === pick);
  const done = ["completed", "closed"].includes(wo.status);

  return (
    <>
      <Card title={t("workvendor.vendor")}>
        <div className="stack" style={{ gap: 10 }}>
          <ErrorBox error={setVendor.error || rate.error} />
          {extras.vendor ? (
            <div>
              <Link to={`/vendors/${extras.vendor.id}`} className="row-link">
                {extras.vendor.name}
              </Link>
              <div className="small muted">{[extras.vendor.phone, extras.vendor.email].filter(Boolean).join(" · ")}</div>
            </div>
          ) : (
            <p className="small muted">{t("workvendor.none")}</p>
          )}
          {setVendor.data?.email_sent && <div className="success-box">{t("workvendor.emailed")}</div>}
          {canEdit && (
            <>
              <Select
                value={pick ?? ""}
                onChange={(e) => setPick(e.target.value || null)}
                options={[{ value: "", label: extras.vendor ? t("workvendor.change") : t("workvendor.choose") }, ...(vendors ?? []).filter((v) => v.id !== extras.vendor?.id).map((v) => ({ value: v.id, label: v.name + (v.trades.includes(wo.category) ? " ★" : "") }))]}
                aria-label={t("workvendor.choose")}
              />
              {picked && (
                <div className="form">
                  {picked.email ? (
                    <label className="check small">
                      <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} /> <Mail size={12} /> {t("workvendor.email_details", { email: picked.email })}
                    </label>
                  ) : (
                    <p className="small muted">{t("workvendor.no_email")}</p>
                  )}
                  {picked.email && emailIt && <Textarea rows={2} placeholder={t("workvendor.message_placeholder")} value={message} onChange={(e) => setMessage(e.target.value)} aria-label={t("workvendor.message_placeholder")} />}
                  <div className="actions">
                    <button className="btn btn-sm btn-primary" onClick={() => setVendor.mutate(picked.id)} disabled={setVendor.isPending}>
                      {t("workvendor.assign")}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setPick(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              )}
              {extras.vendor && !picked && (
                <button className="btn btn-sm btn-ghost" style={{ justifySelf: "start" }} onClick={() => setVendor.mutate(null)}>
                  {t("workvendor.remove")}
                </button>
              )}
            </>
          )}
          {extras.vendor && done && (
            <div>
              <div className="small muted">{t("workvendor.rate")}</div>
              {canEdit ? <Stars value={wo.vendor_rating ?? null} onChange={(r) => rate.mutate(r)} size={18} /> : <Stars value={wo.vendor_rating ?? null} />}
            </div>
          )}
        </div>
      </Card>

      <Card
        title={t("workvendor.quotes")}
        actions={
          canEdit && (
            <button className="btn btn-sm" onClick={() => setModal("quote")}>
              <Plus size={13} /> {t("common.add")}
            </button>
          )
        }
      >
        <ErrorBox error={decide.error || delQuote.error} />
        {extras.quotes.length ? (
          <ul className="list-plain">
            {extras.quotes.map((q) => (
              <li key={q.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <strong className="small">{q.vendor_name}</strong> <Badge value={q.status === "approved" ? "active" : q.status === "pending" ? "pending" : undefined}>{t(`workvendor.quote_${q.status}`)}</Badge>
                  {q.description && <div className="small muted">{q.description}</div>}
                  {q.valid_until && <div className="small muted">{t("workvendor.valid_until_on", { date: date(q.valid_until) })}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono">{money(q.amount_cents)}</div>
                  {canEdit && q.status === "pending" && (
                    <span className="nowrap">
                      <button className="icon-btn" title={t("workvendor.approve")} aria-label={t("workvendor.approve")} onClick={() => decide.mutate({ id: q.id, action: "approve" })}>
                        <Check size={14} />
                      </button>
                      <button className="icon-btn" title={t("workvendor.decline")} aria-label={t("workvendor.decline")} onClick={() => decide.mutate({ id: q.id, action: "decline" })}>
                        <X size={14} />
                      </button>
                      <button className="icon-btn" aria-label={t("common.delete")} onClick={() => delQuote.mutate(q.id)}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t("workvendor.no_quotes")}</p>
        )}
      </Card>

      <Card
        title={t("workvendor.invoices")}
        actions={
          canEdit && (
            <button className="btn btn-sm" onClick={() => setModal("invoice")}>
              <Plus size={13} /> {t("workvendor.record")}
            </button>
          )
        }
      >
        <ErrorBox error={paid.error || delInvoice.error} />
        {extras.invoices.length ? (
          <ul className="list-plain">
            {extras.invoices.map((i) => (
              <li key={i.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <strong className="small">
                    {i.vendor_name}
                    {i.invoice_number ? ` #${i.invoice_number}` : ""}
                  </strong>
                  <div className="small muted">
                    {date(i.invoice_date)}
                    {i.status === "paid" ? ` · ${t("workvendor.paid_on_date", { date: date(i.paid_on) })}` : i.due_date ? ` · ${t("workvendor.due_on", { date: date(i.due_date) })}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono">{money(i.amount_cents)}</div>
                  <Badge value={i.status === "paid" ? "paid" : "pending"}>{t(`vendors.invoice_${i.status}`)}</Badge>
                  {canEdit && (
                    <div className="nowrap">
                      {i.status === "unpaid" && (
                        <button className="link-btn small" onClick={() => paid.mutate(i.id)}>
                          {t("workvendor.mark_paid")}
                        </button>
                      )}{" "}
                      <button className="icon-btn" aria-label={t("common.delete")} onClick={() => window.confirm(t("workvendor.delete_invoice_confirm")) && delInvoice.mutate(i.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t("workvendor.no_invoices")}</p>
        )}
      </Card>
      {modal === "quote" && <QuoteModal wo={wo} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "invoice" && <InvoiceModal wo={wo} extras={extras} onClose={() => setModal(null)} onDone={refresh} />}
    </>
  );
}
