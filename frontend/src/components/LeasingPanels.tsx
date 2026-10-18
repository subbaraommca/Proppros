import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, FileDown, FileSignature, Plus, RefreshCw, Send, Trash2, XCircle } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease } from "../types";
import { SignatureForm, type SignPayload } from "./Signing";
import { MarkdownView } from "./MarkdownView";
import { Badge, Card, Empty, ErrorBox, Field, Input, InviteLink, Modal, MoneyInput, Select, Spinner, Textarea } from "./ui";
import { date, dateTime, fromCents, money, todayISO, toCents } from "../utils/format";

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addYears = (iso: string, years: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
};

// ── Signatures ───────────────────────────────────────────────────────────────

interface Signer {
  id: string;
  role: "tenant" | "landlord";
  name: string;
  email: string | null;
  user_id: string | null;
  viewed_at: string | null;
  signed_at: string | null;
}
interface SignatureRequest {
  id: string;
  title: string;
  status: "sent" | "completed" | "voided";
  created_at: string;
  completed_at: string | null;
  document_id: string | null;
  signers: Signer[];
}
interface SignLink {
  signer_id: string;
  name: string;
  email: string | null;
  url: string;
  email_sent: boolean;
}
interface Template {
  id: string;
  name: string;
}

function SendForSignatureModal({ lease, onClose, onSent }: { lease: Lease; onClose: () => void; onSent: (links: SignLink[]) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: templates } = useQuery({ queryKey: ["lease-templates"], queryFn: () => api.get<Template[]>("/lease-templates") });
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState(t("signing.default_title", { year: lease.start_date.slice(0, 4) }));
  const [body, setBody] = useState<string | null>(null);
  const [landlordSigns, setLandlordSigns] = useState(true);
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const render = useMutation({
    mutationFn: (id: string) => api.post<{ body: string }>(`/leases/${lease.id}/render`, { template_id: id }),
    onSuccess: (r) => setBody(r.body),
  });
  const send = useMutation({
    mutationFn: () => api.post<{ links: SignLink[] }>(`/leases/${lease.id}/signature-requests`, { title, body, landlord_signs: landlordSigns }),
    onSuccess: (r) => onSent(r.links),
  });
  const pick = (id: string) => {
    setTemplateId(id);
    if (id) render.mutate(id);
    else setBody(null);
  };
  const noTenantEmail = lease.tenants.some((tn) => !tn.email);
  return (
    <Modal
      title={t("signing.send_title")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!body || !title || send.isPending} onClick={() => send.mutate()}>
            <Send size={14} /> {t("signing.send")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={render.error || send.error} />
        {templates && templates.length === 0 ? (
          <div className="info-box">
            {t("signing.no_templates")}{" "}
            <button className="link-btn" onClick={() => navigate("/settings?tab=templates")}>
              {t("signing.create_template")}
            </button>
          </div>
        ) : (
          <div className="form-row">
            <Field label={t("signing.template")}>
              <Select value={templateId} onChange={(e) => pick(e.target.value)} options={[{ value: "", label: t("signing.choose_template") }, ...(templates ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
            </Field>
            <Field label={t("signing.doc_title")}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </Field>
          </div>
        )}
        {render.isPending && <Spinner />}
        {body !== null && (
          <>
            <div className="seg">
              <button type="button" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
                {t("signing.preview")}
              </button>
              <button type="button" className={tab === "edit" ? "active" : ""} onClick={() => setTab("edit")}>
                {t("signing.edit_text")}
              </button>
            </div>
            {tab === "preview" ? (
              <div className="sign-doc sign-doc-preview">
                <MarkdownView source={body} />
              </div>
            ) : (
              <textarea rows={16} className="input mono small" value={body} onChange={(e) => setBody(e.target.value)} aria-label={t("signing.edit_text")} />
            )}
            <label className="check">
              <input type="checkbox" checked={landlordSigns} onChange={(e) => setLandlordSigns(e.target.checked)} /> {t("signing.landlord_signs")}
            </label>
            {noTenantEmail && <div className="info-box">{t("signing.no_email_note")}</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

function LandlordSignModal({ req, onClose }: { req: SignatureRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["signature-request", req.id], queryFn: () => api.get<SignatureRequest & { body: string }>(`/signature-requests/${req.id}`) });
  const sign = useMutation({
    mutationFn: (p: SignPayload) => api.post(`/signature-requests/${req.id}/sign`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-requests"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
  });
  return (
    <Modal title={t("signing.sign_title", { title: req.title })} onClose={onClose} wide>
      <div className="stack">
        {data ? (
          <div className="sign-doc sign-doc-preview">
            <MarkdownView source={data.body} />
          </div>
        ) : (
          <Spinner />
        )}
        <SignatureForm defaultName={me?.name ?? ""} onSign={(p) => sign.mutate(p)} pending={sign.isPending} error={sign.error} />
      </div>
    </Modal>
  );
}

export function SignaturesPanel({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const [modal, setModal] = useState<"send" | null>(null);
  const [signing, setSigning] = useState<SignatureRequest | null>(null);
  const [links, setLinks] = useState<SignLink[] | null>(null);
  const { data, error, isLoading } = useQuery({ queryKey: ["signature-requests", lease.id], queryFn: () => api.get<SignatureRequest[]>(`/leases/${lease.id}/signature-requests`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["signature-requests", lease.id] });
  const remind = useMutation({ mutationFn: (id: string) => api.post<{ links: SignLink[] }>(`/signature-requests/${id}/remind`), onSuccess: (r) => setLinks(r.links) });
  const voidReq = useMutation({ mutationFn: (id: string) => api.post(`/signature-requests/${id}/void`), onSuccess: refresh });
  if (isLoading) return <Spinner />;
  return (
    <div className="stack">
      <ErrorBox error={error || remind.error || voidReq.error} />
      {canEdit && (
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setModal("send")}>
            <FileSignature size={15} /> {t("signing.send_for_signature")}
          </button>
          <Link to="/settings?tab=templates" className="btn btn-ghost">
            {t("signing.manage_templates")}
          </Link>
        </div>
      )}
      {links && (
        <Card title={t("signing.links_title")}>
          <div className="stack">
            <p className="small muted">{t("signing.links_body")}</p>
            {links.map((l) => (
              <div key={l.signer_id}>
                <strong className="small">{l.name}</strong>
                <InviteLink url={l.url} emailSent={l.email_sent} email={l.email} />
              </div>
            ))}
            <div>
              <button className="btn btn-sm" onClick={() => setLinks(null)}>
                {t("common.done")}
              </button>
            </div>
          </div>
        </Card>
      )}
      {data?.length === 0 ? (
        <Card>
          <Empty icon={<FileSignature size={36} />} title={t("signing.empty_title")}>
            {t("signing.empty_body")}
          </Empty>
        </Card>
      ) : (
        data?.map((r) => {
          const mine = r.signers.find((s) => s.role === "landlord" && s.user_id === me?.id && !s.signed_at);
          return (
            <Card
              key={r.id}
              title={
                <>
                  {r.title} <Badge value={r.status === "sent" ? "pending" : r.status === "completed" ? "active" : "ended"}>{t(`signing.status_${r.status}`)}</Badge>
                </>
              }
            >
              <div className="stack" style={{ gap: 10 }}>
                <ul className="list-plain">
                  {r.signers.map((s) => (
                    <li key={s.id}>
                      <span>
                        {s.name} <span className="small muted">· {t(`signing.role_${s.role}`)}</span>
                      </span>
                      <span className="small muted">
                        {s.signed_at ? t("signing.signed_on", { when: dateTime(s.signed_at) }) : s.viewed_at ? t("signing.viewed_on", { when: dateTime(s.viewed_at) }) : t("signing.not_opened")}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="actions">
                  {r.document_id && (
                    <a className="btn btn-sm" href={fileUrl(`/documents/${r.document_id}/file`)} target="_blank" rel="noreferrer">
                      <FileDown size={13} /> {t("signing.signed_pdf")}
                    </a>
                  )}
                  {r.status === "sent" && mine && (
                    <button className="btn btn-sm btn-primary" onClick={() => setSigning(r)}>
                      <FileSignature size={13} /> {t("signing.sign_now")}
                    </button>
                  )}
                  {r.status === "sent" && canEdit && r.signers.some((s) => s.role === "tenant" && !s.signed_at) && (
                    <button className="btn btn-sm" onClick={() => remind.mutate(r.id)} disabled={remind.isPending}>
                      <RefreshCw size={13} /> {t("signing.new_links")}
                    </button>
                  )}
                  {r.status === "sent" && canEdit && (
                    <button className="btn btn-sm btn-ghost" onClick={() => window.confirm(t("signing.void_confirm")) && voidReq.mutate(r.id)}>
                      <XCircle size={13} /> {t("signing.void")}
                    </button>
                  )}
                  <span className="small muted">{t("signing.sent_on", { when: dateTime(r.created_at) })}</span>
                </div>
              </div>
            </Card>
          );
        })
      )}
      {modal === "send" && (
        <SendForSignatureModal
          lease={lease}
          onClose={() => setModal(null)}
          onSent={(l) => {
            setModal(null);
            setLinks(l);
            refresh();
          }}
        />
      )}
      {signing && <LandlordSignModal req={signing} onClose={() => setSigning(null)} />}
    </div>
  );
}

// ── Renewal ──────────────────────────────────────────────────────────────────

interface RenewalOffer {
  id: string;
  status: "sent" | "accepted" | "declined" | "withdrawn" | "expired";
  rent_cents: number;
  start_date: string;
  end_date: string | null;
  respond_by: string;
  message: string | null;
  responded_at: string | null;
  response_note: string | null;
  new_lease_id: string | null;
  created_at: string;
}

function OfferModal({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const start = lease.end_date ? addDays(lease.end_date, 1) : addDays(todayISO(), 45);
  const [form, setForm] = useState({
    rent: fromCents(lease.rent_cents),
    start_date: start,
    end_date: addDays(addYears(start, 1), -1),
    term: "fixed" as "fixed" | "mtm",
    respond_by: [addDays(todayISO(), 14), addDays(start, -1)].sort()[0],
    message: "",
  });
  const change = (toCents(form.rent) ?? 0) - lease.rent_cents;
  const create = useMutation({
    mutationFn: () =>
      api.post(`/leases/${lease.id}/renewals`, {
        rent_cents: toCents(form.rent),
        start_date: form.start_date,
        end_date: form.term === "fixed" ? form.end_date : null,
        respond_by: form.respond_by,
        message: form.message || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["renewals", lease.id] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("renewal.offer_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(form.rent) || create.isPending} onClick={() => create.mutate()}>
            <Send size={14} /> {t("renewal.send_offer")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={create.error} />
        <div className="form-row">
          <Field label={t("renewal.new_rent")} hint={change ? t(change > 0 ? "renewal.increase" : "renewal.decrease", { amount: money(Math.abs(change)), pct: ((Math.abs(change) / lease.rent_cents) * 100).toFixed(1) }) : t("renewal.same_rent")}>
            <MoneyInput value={form.rent} onChange={(rent) => setForm({ ...form, rent })} />
          </Field>
          <Field label={t("renewal.respond_by")}>
            <Input type="date" value={form.respond_by} onChange={(e) => setForm({ ...form, respond_by: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("leases.start_date")}>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: addDays(addYears(e.target.value, 1), -1) })} />
          </Field>
          <Field label={t("renewal.term")}>
            <Select
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value as "fixed" | "mtm" })}
              options={[
                { value: "fixed", label: t("renewal.fixed_term") },
                { value: "mtm", label: t("common.month_to_month") },
              ]}
            />
          </Field>
        </div>
        {form.term === "fixed" && (
          <Field label={t("leases.end_date")}>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
        )}
        <Field label={t("renewal.message")} hint={t("renewal.message_hint")}>
          <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} />
        </Field>
        <p className="small muted">{t("renewal.offer_note")}</p>
      </div>
    </Modal>
  );
}

export function RenewalPanel({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const [offering, setOffering] = useState(false);
  const { data, error, isLoading } = useQuery({ queryKey: ["renewals", lease.id], queryFn: () => api.get<RenewalOffer[]>(`/leases/${lease.id}/renewals`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["renewals", lease.id] });
    qc.invalidateQueries({ queryKey: ["lease", lease.id] });
    qc.invalidateQueries({ queryKey: ["leases"] });
  };
  const respond = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api.post(`/renewals/${id}/respond`, { accept, note: t("renewal.recorded_by_staff") }), onSuccess: refresh });
  const withdraw = useMutation({ mutationFn: (id: string) => api.post(`/renewals/${id}/withdraw`), onSuccess: refresh });
  if (isLoading) return <Spinner />;
  const open = data?.find((o) => o.status === "sent");
  const accepted = data?.find((o) => o.status === "accepted");
  return (
    <div className="stack">
      <ErrorBox error={error || respond.error || withdraw.error} />
      {accepted?.new_lease_id && (
        <div className="success-box">
          {t("renewal.renewed")} <Link to={`/leases/${accepted.new_lease_id}`}>{t("renewal.open_new_lease")}</Link>
        </div>
      )}
      {canEdit && lease.status === "active" && !open && !accepted && (
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setOffering(true)}>
            <RefreshCw size={15} /> {t("renewal.offer")}
          </button>
        </div>
      )}
      {data?.length === 0 ? (
        <Card>
          <Empty icon={<RefreshCw size={36} />} title={t("renewal.empty_title")}>
            {lease.end_date ? t("renewal.empty_body", { date: date(lease.end_date) }) : t("renewal.empty_body_mtm")}
          </Empty>
        </Card>
      ) : (
        data?.map((o) => (
          <Card
            key={o.id}
            title={
              <>
                {t("renewal.offer_of", { date: date(o.created_at) })} <Badge value={o.status === "sent" ? "pending" : o.status === "accepted" ? "active" : "ended"}>{t(`renewal.status_${o.status}`)}</Badge>
              </>
            }
          >
            <dl className="dl small">
              <dt>{t("renewal.new_rent")}</dt>
              <dd>
                {money(o.rent_cents)}{" "}
                <span className="muted">
                  {o.rent_cents === lease.rent_cents ? `(${t("renewal.same_rent").toLowerCase()})` : `(${o.rent_cents > lease.rent_cents ? "+" : "−"}${money(Math.abs(o.rent_cents - lease.rent_cents))})`}
                </span>
              </dd>
              <dt>{t("renewal.term")}</dt>
              <dd>
                {date(o.start_date)} – {o.end_date ? date(o.end_date) : t("common.month_to_month")}
              </dd>
              <dt>{t("renewal.respond_by")}</dt>
              <dd>{date(o.respond_by)}</dd>
              {o.message && (
                <>
                  <dt>{t("renewal.message")}</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{o.message}</dd>
                </>
              )}
              {o.responded_at && (
                <>
                  <dt>{t("renewal.response")}</dt>
                  <dd>
                    {dateTime(o.responded_at)}
                    {o.response_note ? ` — ${o.response_note}` : ""}
                  </dd>
                </>
              )}
            </dl>
            {o.status === "sent" && canEdit && (
              <div className="actions" style={{ marginTop: 12 }}>
                <span className="small muted">{t("renewal.record_answer")}</span>
                <button className="btn btn-sm" onClick={() => window.confirm(t("renewal.accept_confirm")) && respond.mutate({ id: o.id, accept: true })}>
                  {t("renewal.mark_accepted")}
                </button>
                <button className="btn btn-sm" onClick={() => respond.mutate({ id: o.id, accept: false })}>
                  {t("renewal.mark_declined")}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => withdraw.mutate(o.id)}>
                  {t("renewal.withdraw")}
                </button>
              </div>
            )}
          </Card>
        ))
      )}
      {offering && <OfferModal lease={lease} onClose={() => setOffering(false)} />}
    </div>
  );
}

// ── Move-in / move-out ───────────────────────────────────────────────────────

interface InspectionSummary {
  id: string;
  kind: "move_in" | "move_out";
  status: "draft" | "completed";
  inspected_on: string;
  item_count: number;
  checked_count: number;
  flagged_count: number;
  document_id: string | null;
}

interface Deposit {
  id: string | null;
  saved: boolean;
  status: "draft" | "sent";
  deposit_cents: number;
  deductions: { description: string; amount_cents: number }[];
  balance_applied_cents: number;
  forwarding_address: string | null;
  notes: string | null;
  sent_at: string | null;
  document_id: string | null;
  refund_cents: number;
  lease_balance_cents: number;
}

function DepositCard({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const { data, error } = useQuery({ queryKey: ["deposit", lease.id], queryFn: () => api.get<Deposit>(`/leases/${lease.id}/deposit`) });
  const [draft, setDraft] = useState<{ rows: { description: string; amount: string }[]; applied: string; address: string; notes: string } | null>(null);
  const form =
    draft ??
    (data && {
      rows: data.deductions.map((x) => ({ description: x.description, amount: x.amount_cents ? fromCents(x.amount_cents) : "" })),
      applied: data.balance_applied_cents ? fromCents(data.balance_applied_cents) : "",
      address: data.forwarding_address ?? "",
      notes: data.notes ?? "",
    });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["deposit", lease.id] });
    qc.invalidateQueries({ queryKey: ["lease", lease.id] });
    qc.invalidateQueries({ queryKey: ["ledger", lease.id] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };
  const save = useMutation({
    mutationFn: () =>
      api.put<Deposit>(`/leases/${lease.id}/deposit`, {
        deductions: form!.rows.filter((r) => r.description.trim()).map((r) => ({ description: r.description, amount_cents: toCents(r.amount) ?? 0 })),
        balance_applied_cents: toCents(form!.applied) ?? 0,
        forwarding_address: form!.address,
        notes: form!.notes,
      }),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const send = useMutation({ mutationFn: () => api.post(`/leases/${lease.id}/deposit/send`), onSuccess: refresh });
  if (!data || !form) return <ErrorBox error={error} />;
  const set = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });
  const withheld = form.rows.reduce((s, r) => s + (toCents(r.amount) ?? 0), 0) + (toCents(form.applied) ?? 0);
  const refund = data.deposit_cents - withheld;
  const sent = data.status === "sent";
  return (
    <Card title={t("deposit.title")} actions={sent ? <Badge tone="jade">{t("deposit.sent_on", { when: date(data.sent_at) })}</Badge> : undefined}>
      <div className="stack" style={{ gap: 12 }}>
        <ErrorBox error={save.error || send.error} />
        {!data.saved && <p className="small muted">{t("deposit.intro")}</p>}
        <dl className="dl small">
          <dt>{t("deposit.held")}</dt>
          <dd className="mono">{money(data.deposit_cents)}</dd>
          <dt>{t("deposit.lease_balance")}</dt>
          <dd className="mono">{money(data.lease_balance_cents)}</dd>
        </dl>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("deposit.deduction")}</th>
                <th className="num">{t("common.amount")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <Input value={r.description} disabled={sent || !canEdit} onChange={(e) => set({ rows: form.rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} aria-label={t("deposit.deduction")} />
                  </td>
                  <td className="num" style={{ width: 150 }}>
                    <MoneyInput value={r.amount} disabled={sent || !canEdit} onChange={(amount) => set({ rows: form.rows.map((x, j) => (j === i ? { ...x, amount } : x)) })} aria-label={t("common.amount")} />
                  </td>
                  <td className="right" style={{ width: 40 }}>
                    {!sent && canEdit && (
                      <button className="icon-btn" onClick={() => set({ rows: form.rows.filter((_, j) => j !== i) })} aria-label={t("common.remove")}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  {t("deposit.unpaid_balance")}
                  <div className="small muted">{t("deposit.unpaid_balance_hint")}</div>
                </td>
                <td className="num">
                  <MoneyInput value={form.applied} disabled={sent || !canEdit} onChange={(applied) => set({ applied })} aria-label={t("deposit.unpaid_balance")} />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {!sent && canEdit && (
          <div>
            <button className="btn btn-sm" onClick={() => set({ rows: [...form.rows, { description: "", amount: "" }] })}>
              <Plus size={13} /> {t("deposit.add_deduction")}
            </button>
          </div>
        )}
        <div className={refund >= 0 ? "success-box" : "info-box"}>
          {refund >= 0 ? t("deposit.refund", { amount: money(refund) }) : t("deposit.owed", { amount: money(-refund) })}
        </div>
        <div className="form-row">
          <Field label={t("deposit.forwarding_address")}>
            <Textarea rows={3} value={form.address} disabled={sent || !canEdit} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label={t("deposit.notes")}>
            <Textarea rows={3} value={form.notes} disabled={sent || !canEdit} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <div className="actions">
          {!sent && canEdit && (
            <button className="btn" onClick={() => save.mutate()} disabled={save.isPending}>
              {t("deposit.save")}
            </button>
          )}
          {data.saved && !sent && (
            <a className="btn" href={fileUrl(`/leases/${lease.id}/deposit/preview.pdf`)} target="_blank" rel="noreferrer">
              <FileDown size={14} /> {t("deposit.preview")}
            </a>
          )}
          {data.saved && !sent && canEdit && (
            <button
              className="btn btn-primary"
              disabled={!!draft || send.isPending}
              title={draft ? t("deposit.save_first") : undefined}
              onClick={() => window.confirm(t("deposit.send_confirm")) && send.mutate()}
            >
              <Send size={14} /> {t("deposit.send")}
            </button>
          )}
          {sent && data.document_id && (
            <a className="btn" href={fileUrl(`/documents/${data.document_id}/file`)} target="_blank" rel="noreferrer">
              <FileDown size={14} /> {t("deposit.statement_pdf")}
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MovePanel({ lease }: { lease: Lease }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const canEdit = can("owner", "manager");
  const { data, error, isLoading } = useQuery({ queryKey: ["inspections", lease.id], queryFn: () => api.get<InspectionSummary[]>(`/leases/${lease.id}/inspections`) });
  const start = useMutation({
    mutationFn: (kind: "move_in" | "move_out") =>
      api.post<{ id: string }>(`/leases/${lease.id}/inspections`, { kind, inspected_on: kind === "move_in" && lease.start_date > todayISO() ? lease.start_date : todayISO() }),
    onSuccess: (r) => navigate(`/leases/${lease.id}/inspections/${r.id}`),
  });
  if (isLoading) return <Spinner />;
  const hasMoveIn = data?.some((i) => i.kind === "move_in");
  return (
    <div className="stack">
      <ErrorBox error={error || start.error} />
      <Card
        title={t("inspections.title")}
        actions={
          canEdit && (
            <div className="actions">
              <button className={`btn btn-sm${hasMoveIn ? "" : " btn-primary"}`} onClick={() => start.mutate("move_in")} disabled={start.isPending}>
                <ClipboardCheck size={13} /> {t("inspections.start_move_in")}
              </button>
              <button className="btn btn-sm" onClick={() => start.mutate("move_out")} disabled={start.isPending}>
                <ClipboardCheck size={13} /> {t("inspections.start_move_out")}
              </button>
            </div>
          )
        }
        pad={!data?.length}
      >
        {data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.type")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("inspections.progress")}</th>
                  <th>{t("common.status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link to={`/leases/${lease.id}/inspections/${i.id}`} className="row-link">
                        {t(`inspections.kind_${i.kind}`)}
                      </Link>
                    </td>
                    <td className="nowrap">{date(i.inspected_on)}</td>
                    <td className="small">
                      {t("inspections.checked_of", { checked: i.checked_count, total: i.item_count })}
                      {i.flagged_count > 0 && <span className="danger-text"> · {t("inspections.flagged", { count: i.flagged_count })}</span>}
                    </td>
                    <td>
                      <Badge value={i.status === "completed" ? "completed" : "draft"}>{t(`inspections.status_${i.status}`)}</Badge>
                    </td>
                    <td className="right">
                      {i.document_id && (
                        <a className="btn btn-sm" href={fileUrl(`/documents/${i.document_id}/file`)} target="_blank" rel="noreferrer">
                          <FileDown size={13} /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">{t("inspections.empty")}</p>
        )}
      </Card>
      {lease.deposit_cents > 0 && <DepositCard lease={lease} />}
    </div>
  );
}
