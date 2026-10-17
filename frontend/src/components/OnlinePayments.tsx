import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, ExternalLink, Landmark, RefreshCw, Repeat } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Payment } from "../types";
import { Badge, Card, ErrorBox, Field, Modal, MoneyInput, Spinner } from "./ui";
import { fromCents, money, toCents } from "../utils/format";

/** Status + source badges for a payment row (manual payments that succeeded show nothing extra). */
export function PaymentBadges({ p }: { p: Payment }) {
  const { t } = useTranslation();
  return (
    <>
      {p.source !== "manual" && <Badge value={p.source} />}
      {p.status !== "succeeded" && (
        <span title={p.failure_reason ?? undefined}>
          <Badge value={p.status} />
        </span>
      )}
      {p.fee_cents > 0 && <span className="small muted"> {t("online.fee_included", { amount: money(p.fee_cents) })}</span>}
    </>
  );
}

// ── Owner settings ───────────────────────────────────────────────────────────

interface PaymentSettings {
  stripe_configured: boolean;
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  online_payments_enabled: boolean;
  allow_partial_payments: boolean;
  pass_card_fee: boolean;
  returned_payment_fee_cents: number;
  card_fee_bps: number;
  card_fee_fixed_cents: number;
  accepting: boolean;
}

export function PaymentsSettingsTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const owner = can("owner");
  const qc = useQueryClient();
  const { data: s, error, isLoading } = useQuery({ queryKey: ["payment-settings"], queryFn: () => api.get<PaymentSettings>("/online-payments/settings") });
  const [fee, setFee] = useState<string | null>(null);
  const setData = (next: PaymentSettings) => qc.setQueryData(["payment-settings"], next);
  const update = useMutation({ mutationFn: (body: Partial<PaymentSettings>) => api.patch<PaymentSettings>("/online-payments/settings", body), onSuccess: setData });
  const connect = useMutation({ mutationFn: () => api.post<{ url: string }>("/online-payments/connect"), onSuccess: (r) => window.location.assign(r.url) });
  const refresh = useMutation({ mutationFn: () => api.post<PaymentSettings>("/online-payments/connect/refresh"), onSuccess: setData });
  const dashboard = useMutation({ mutationFn: () => api.post<{ url: string }>("/online-payments/connect/dashboard"), onSuccess: (r) => window.open(r.url, "_blank", "noopener") });

  if (isLoading) return <Spinner />;
  if (error || !s) return <ErrorBox error={error} />;
  if (!s.stripe_configured) {
    return (
      <Card title={t("online.title")}>
        <div className="info-box">{t("online.not_configured")}</div>
      </Card>
    );
  }
  const feeExample = t("online.card_fee_example", { pct: s.card_fee_bps / 100, fixed: money(s.card_fee_fixed_cents) });
  const status = !s.connected ? "not_connected" : s.charges_enabled ? "ready" : "incomplete";

  return (
    <div className="stack">
      <ErrorBox error={update.error || connect.error || refresh.error || dashboard.error} />
      <Card title={t("online.stripe_account")}>
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted">{t("online.stripe_intro")}</p>
          <div className="actions">
            <Badge tone={status === "ready" ? "jade" : status === "incomplete" ? "citrine" : ""}>{t(`online.status_${status}`)}</Badge>
            {s.connected && s.payouts_enabled && <Badge tone="jade">{t("online.payouts_on")}</Badge>}
          </div>
          {owner && (
            <div className="actions">
              {status !== "ready" && (
                <button className="btn btn-primary" onClick={() => connect.mutate()} disabled={connect.isPending}>
                  <Landmark size={15} /> {s.connected ? t("online.finish_setup") : t("online.connect")}
                </button>
              )}
              {s.connected && (
                <button className="btn" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                  <RefreshCw size={14} /> {t("online.refresh")}
                </button>
              )}
              {s.details_submitted && (
                <button className="btn" onClick={() => dashboard.mutate()} disabled={dashboard.isPending}>
                  <ExternalLink size={14} /> {t("online.open_dashboard")}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title={t("online.rules")}>
        <div className="form" style={{ maxWidth: 560 }}>
          <label className="check">
            <input
              type="checkbox"
              checked={s.online_payments_enabled}
              disabled={!owner || !s.charges_enabled || update.isPending}
              onChange={(e) => update.mutate({ online_payments_enabled: e.target.checked })}
            />
            {t("online.accept")}
          </label>
          {!s.charges_enabled && <p className="small muted">{t("online.accept_hint")}</p>}
          <label className="check">
            <input type="checkbox" checked={s.allow_partial_payments} disabled={!owner || update.isPending} onChange={(e) => update.mutate({ allow_partial_payments: e.target.checked })} />
            {t("online.allow_partial")}
          </label>
          <label className="check">
            <input type="checkbox" checked={s.pass_card_fee} disabled={!owner || update.isPending} onChange={(e) => update.mutate({ pass_card_fee: e.target.checked })} />
            {t("online.pass_card_fee", { example: feeExample })}
          </label>
          <p className="small muted">{t("online.pass_card_fee_note")}</p>
          <Field label={t("online.returned_fee")} hint={t("online.returned_fee_hint")}>
            <div style={{ display: "flex", gap: 8, maxWidth: 260 }}>
              <MoneyInput value={fee ?? fromCents(s.returned_payment_fee_cents)} onChange={setFee} disabled={!owner} />
              {owner && fee !== null && (
                <button className="btn" onClick={() => update.mutate({ returned_payment_fee_cents: toCents(fee) ?? 0 }, { onSuccess: () => setFee(null) })}>
                  {t("common.save")}
                </button>
              )}
            </div>
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ── Tenant portal ────────────────────────────────────────────────────────────

export interface PortalLeasePayOptions {
  lease_id: string;
  available: boolean;
  blocked: boolean;
  balance_cents: number;
  pending_cents: number;
  payable_cents: number;
  allow_partial: boolean;
  card_fee: { bps: number; fixed_cents: number } | null;
  autopay: { method_label: string; method_type: string } | null;
}

export function usePortalPayOptions() {
  return useQuery({
    queryKey: ["portal-pay-options"],
    queryFn: () => api.get<{ enabled: boolean; leases: PortalLeasePayOptions[] }>("/portal/online-payments"),
    staleTime: 30_000,
  });
}

function PayModal({ o, onClose }: { o: PortalLeasePayOptions; onClose: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(fromCents(o.payable_cents));
  const [method, setMethod] = useState<"us_bank_account" | "card">("us_bank_account");
  const cents = toCents(amount) ?? 0;
  const fee = method === "card" && o.card_fee ? Math.round((cents * o.card_fee.bps) / 10_000) + o.card_fee.fixed_cents : 0;
  const pay = useMutation({
    mutationFn: () => api.post<{ url: string }>(`/portal/leases/${o.lease_id}/pay`, { amount_cents: cents, method }),
    onSuccess: (r) => window.location.assign(r.url),
  });
  return (
    <Modal
      title={t("online.pay_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={cents <= 0 || pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? t("online.redirecting") : t("online.continue_to_pay", { amount: money(cents + fee) })}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={pay.error} />
        <Field label={t("common.amount")} hint={o.allow_partial ? t("online.up_to", { amount: money(o.payable_cents) }) : t("online.full_balance_only")}>
          <MoneyInput value={amount} onChange={setAmount} disabled={!o.allow_partial} autoFocus />
        </Field>
        <div className="field">
          <span>{t("common.method")}</span>
          <label className="check">
            <input type="radio" name="method" checked={method === "us_bank_account"} onChange={() => setMethod("us_bank_account")} />
            <Landmark size={15} /> {t("online.bank")} <span className="small muted">— {t("online.bank_note")}</span>
          </label>
          <label className="check">
            <input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} />
            <CreditCard size={15} /> {t("online.card")}
            {o.card_fee && <span className="small muted">— {t("online.card_fee_added", { amount: money(fee) })}</span>}
          </label>
        </div>
        {o.pending_cents > 0 && <div className="info-box">{t("online.pending_note", { amount: money(o.pending_cents) })}</div>}
        <p className="small muted">{t("online.secure_note")}</p>
      </div>
    </Modal>
  );
}

/** Pay + autopay controls shown on the portal home for one lease. Renders nothing if online payments are off. */
export function PortalPayActions({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = usePortalPayOptions();
  const [paying, setPaying] = useState(false);
  const o = data?.leases.find((l) => l.lease_id === leaseId);
  const enroll = useMutation({ mutationFn: () => api.post<{ url: string }>(`/portal/leases/${leaseId}/autopay`), onSuccess: (r) => window.location.assign(r.url) });
  const cancel = useMutation({ mutationFn: () => api.del(`/portal/leases/${leaseId}/autopay`), onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-pay-options"] }) });
  if (!o || !o.available) return o?.blocked ? <p className="small muted">{t("online.blocked_note")}</p> : null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <ErrorBox error={enroll.error || cancel.error} />
      <div className="actions">
        {o.payable_cents > 0 && (
          <button className="btn btn-primary" onClick={() => setPaying(true)}>
            <CreditCard size={15} /> {t("online.pay_rent")}
          </button>
        )}
        {o.autopay ? (
          <button className="btn" onClick={() => window.confirm(t("online.autopay_off_confirm")) && cancel.mutate()} disabled={cancel.isPending}>
            <Repeat size={14} /> {t("online.autopay_off")}
          </button>
        ) : (
          <button className="btn" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            <Repeat size={14} /> {t("online.autopay_on")}
          </button>
        )}
      </div>
      {o.autopay && <p className="small muted">{t("online.autopay_status", { method: o.autopay.method_label })}</p>}
      {o.pending_cents > 0 && <p className="small muted">{t("online.processing_note", { amount: money(o.pending_cents) })}</p>}
      {paying && <PayModal o={o} onClose={() => setPaying(false)} />}
    </div>
  );
}
