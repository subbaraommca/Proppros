import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property } from "../types";
import { Badge, Card, ErrorBox, Field, Input, Modal, Spinner } from "./ui";
import { date, money } from "../utils/format";

// ── Billing ──────────────────────────────────────────────────────────────────

interface Billing {
  plan: "free" | "pro" | "business";
  billing_active: boolean;
  subscription_status: string;
  current_period_end: string | null;
  comped: boolean;
  units: number;
  unit_limit: number | null;
  seats: number;
  seat_limit: number | null;
  plans: { id: "free" | "pro" | "business"; unit_limit: number | null; seat_limit: number | null; price_cents_per_unit: number }[];
}

export function BillingTab() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { data: b, error, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => api.get<Billing>("/billing") });
  const checkout = useMutation({ mutationFn: (plan: string) => api.post<{ url: string }>("/billing/checkout", { plan }), onSuccess: (r) => window.location.assign(r.url) });
  const portal = useMutation({ mutationFn: () => api.post<{ url: string }>("/billing/portal"), onSuccess: (r) => window.location.assign(r.url) });
  if (isLoading) return <Spinner />;
  if (error || !b) return <ErrorBox error={error} />;
  const owner = can("owner");
  const flash = new URLSearchParams(window.location.search).get("checkout") === "success";
  const meter = (used: number, limit: number | null) => (limit ? t("billing.used_of", { used, limit }) : t("billing.used_unlimited", { used }));
  return (
    <div className="stack">
      {flash && <div className="success-box">{t("billing.checkout_success")}</div>}
      <ErrorBox error={checkout.error || portal.error} />
      <Card title={t("billing.current_plan")}>
        <div className="stack" style={{ gap: 12 }}>
          <div className="actions">
            <Badge tone="carnelian">{t(`plans.${b.plan}`)}</Badge>
            {b.comped && <Badge tone="jade">{t("billing.comped")}</Badge>}
            {b.subscription_status !== "none" && <Badge value={b.subscription_status === "active" ? "active" : b.subscription_status === "past_due" ? "overdue" : undefined}>{t(`billing.status_${b.subscription_status}`, { defaultValue: b.subscription_status })}</Badge>}
            {b.current_period_end && <span className="small muted">{t("billing.renews", { date: date(b.current_period_end) })}</span>}
          </div>
          <div className="grid grid-2">
            <div>
              <div className="eyebrow">{t("properties.units")}</div>
              <strong>{meter(b.units, b.unit_limit)}</strong>
            </div>
            <div>
              <div className="eyebrow">{t("settings.team")}</div>
              <strong>{meter(b.seats, b.seat_limit)}</strong>
            </div>
          </div>
          {!b.billing_active && <div className="info-box">{t("billing.not_active")}</div>}
          {b.billing_active && owner && b.subscription_status !== "none" && (
            <div>
              <button className="btn" onClick={() => portal.mutate()} disabled={portal.isPending}>
                {t("billing.manage")}
              </button>
            </div>
          )}
        </div>
      </Card>
      {b.billing_active && owner && !["active", "trialing"].includes(b.subscription_status) && !b.comped && (
        <div className="grid grid-2">
          {b.plans
            .filter((p) => p.price_cents_per_unit > 0)
            .map((p) => (
              <Card key={p.id} title={t(`plans.${p.id}`)}>
                <div className="stack" style={{ gap: 10 }}>
                  <div className="plan-price">
                    {money(p.price_cents_per_unit)} <span className="small muted">{t("marketing.per_unit_month")}</span>
                  </div>
                  <p className="small muted">
                    {t("billing.estimate", { amount: money(p.price_cents_per_unit * Math.max(b.units, 1)), units: Math.max(b.units, 1) })}
                  </p>
                  <button className="btn btn-primary" onClick={() => checkout.mutate(p.id)} disabled={checkout.isPending}>
                    {t("billing.upgrade_to", { plan: t(`plans.${p.id}`) })}
                  </button>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Two-factor authentication ────────────────────────────────────────────────

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      title={t("settings.recovery_title")}
      onClose={onDone}
      footer={
        <button className="btn btn-primary" onClick={onDone}>
          {t("settings.recovery_saved")}
        </button>
      }
    >
      <div className="stack">
        <p>{t("settings.recovery_body")}</p>
        <div className="recovery-grid mono">
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div>
          <button
            className="btn btn-sm"
            onClick={() => navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true)).catch(() => undefined)}
          >
            <Copy size={13} /> {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SecurityCard() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; qr_svg_data_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disable, setDisable] = useState({ password: "", code: "" });
  const refreshMe = () => qc.invalidateQueries({ queryKey: ["me"] });
  const start = useMutation({ mutationFn: () => api.post<{ secret: string; qr_svg_data_uri: string }>("/auth/mfa/setup"), onSuccess: setSetup });
  const enable = useMutation({
    mutationFn: () => api.post<{ recovery_codes: string[] }>("/auth/mfa/enable", { code }),
    onSuccess: (r) => {
      setCodes(r.recovery_codes);
      setSetup(null);
      setCode("");
      refreshMe();
    },
  });
  const regen = useMutation({ mutationFn: (c: string) => api.post<{ recovery_codes: string[] }>("/auth/mfa/recovery-codes", { code: c }), onSuccess: (r) => setCodes(r.recovery_codes) });
  const off = useMutation({
    mutationFn: () => api.post("/auth/mfa/disable", disable),
    onSuccess: () => {
      setDisabling(false);
      setDisable({ password: "", code: "" });
      refreshMe();
    },
  });
  return (
    <Card title={t("settings.mfa_title")}>
      <div className="stack" style={{ gap: 12 }}>
        <ErrorBox error={start.error || enable.error || regen.error || off.error} />
        {me?.mfa_enabled ? (
          <>
            <p>
              <Badge tone="jade">
                <ShieldCheck size={12} /> {t("settings.mfa_on")}
              </Badge>{" "}
              <span className="muted">{t("settings.mfa_on_body")}</span>
            </p>
            {disabling ? (
              <div className="form">
                <Field label={t("auth.password")}>
                  <Input type="password" autoComplete="current-password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} />
                </Field>
                <Field label={t("settings.mfa_code")} hint={t("settings.mfa_code_or_recovery")}>
                  <Input inputMode="numeric" autoComplete="one-time-code" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} />
                </Field>
                <div className="actions">
                  <button className="btn btn-danger" disabled={!disable.password || !disable.code || off.isPending} onClick={() => off.mutate()}>
                    <ShieldOff size={14} /> {t("settings.mfa_turn_off")}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setDisabling(false)}>
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="actions">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const c = window.prompt(t("settings.mfa_prompt_code"));
                    if (c) regen.mutate(c);
                  }}
                >
                  {t("settings.mfa_new_codes")}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => setDisabling(true)}>
                  {t("settings.mfa_turn_off")}
                </button>
              </div>
            )}
          </>
        ) : setup ? (
          <div className="form">
            <p className="small muted">{t("settings.mfa_scan")}</p>
            <img src={setup.qr_svg_data_uri} alt={t("settings.mfa_qr_alt")} width={180} height={180} className="qr" />
            <p className="small">
              {t("settings.mfa_manual")} <code className="mono">{setup.secret}</code>
            </p>
            <Field label={t("settings.mfa_code")}>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            </Field>
            <div className="actions">
              <button className="btn btn-primary" disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>
                {t("settings.mfa_turn_on")}
              </button>
              <button className="btn btn-ghost" onClick={() => setSetup(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="muted">{t("settings.mfa_off_body")}</p>
            <div>
              <button className="btn" onClick={() => start.mutate()} disabled={start.isPending}>
                <ShieldCheck size={14} /> {t("settings.mfa_set_up")}
              </button>
            </div>
          </>
        )}
        {me?.google_linked && <p className="small muted">{t("settings.google_linked")}</p>}
      </div>
      {codes && <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />}
    </Card>
  );
}

// ── Property access picker (team) ────────────────────────────────────────────

export function PropertyAccessPicker({ value, onChange }: { value: string[] | null; onChange: (v: string[] | null) => void }) {
  const { t } = useTranslation();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const all = value === null;
  return (
    <div className="field">
      <span>{t("team.access")}</span>
      <label className="check">
        <input type="radio" checked={all} onChange={() => onChange(null)} /> {t("team.all_properties")}
      </label>
      <label className="check">
        <input type="radio" checked={!all} onChange={() => onChange(value ?? [])} /> {t("team.some_properties")}
      </label>
      {!all && (
        <div className="chip-list" style={{ paddingLeft: 24 }}>
          {(properties ?? []).map((p) => (
            <label key={p.id} className="check small">
              <input
                type="checkbox"
                checked={value!.includes(p.id)}
                onChange={(e) => onChange(e.target.checked ? [...value!, p.id] : value!.filter((x) => x !== p.id))}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccessSummary({ ids }: { ids: string[] | null }) {
  const { t } = useTranslation();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  if (ids === null) return <span className="small muted">{t("team.all_properties")}</span>;
  const names = (properties ?? []).filter((p) => ids.includes(p.id)).map((p) => p.name);
  return <span className="small">{names.join(", ") || t("team.no_properties")}</span>;
}
