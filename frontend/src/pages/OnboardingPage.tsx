import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, Check, FileText, Home } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease, Property, Tenant } from "../types";
import { ErrorBox, Field, Input, MoneyInput, Select } from "../components/ui";
import { ordinal, toCents, todayISO } from "../utils/format";
import { PROPERTY_TYPES } from "./PropertiesPage";

const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];
type Step = "portfolio" | "property" | "lease" | "done";

/** First-run wizard for a new landlord: portfolio → first property → first tenant & lease. */
export function OnboardingPage() {
  const { t } = useTranslation();
  const { org } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("portfolio");
  const [portfolio, setPortfolio] = useState({ name: org?.name ?? "", timezone: org?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/New_York" });
  const [prop, setProp] = useState({ name: "", property_type: "single_family", address_line1: "", city: "", state: "", postal_code: "", units: "A, B" });
  const [created, setCreated] = useState<Property | null>(null);
  const [lease, setLease] = useState({ first_name: "", last_name: "", email: "", rent: "", due_day: "1", start_date: todayISO(), existing: true, opening: "" });
  const [leaseDone, setLeaseDone] = useState(false);

  const savePortfolio = useMutation({
    mutationFn: () => api.patch("/org", portfolio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setStep("property");
    },
  });
  const saveProperty = useMutation({
    mutationFn: async () => {
      const p = await api.post<Property>("/properties", { ...prop, units: undefined });
      if (prop.property_type === "multi_family" || prop.property_type === "commercial") {
        for (const name of prop.units.split(",").map((u) => u.trim()).filter(Boolean)) {
          await api.post(`/properties/${p.id}/units`, { name });
        }
      }
      return api.get<Property>(`/properties/${p.id}`);
    },
    onSuccess: (p) => {
      setCreated(p);
      qc.invalidateQueries({ queryKey: ["properties"] });
      setStep("lease");
    },
  });
  const saveLease = useMutation({
    mutationFn: async () => {
      const tenant = await api.post<Tenant>("/tenants", { first_name: lease.first_name, last_name: lease.last_name, email: lease.email || null });
      return api.post<Lease>("/leases", {
        unit_id: created!.units![0].id,
        tenant_ids: [tenant.id],
        start_date: lease.start_date,
        rent_cents: toCents(lease.rent),
        due_day: Number(lease.due_day),
        charges_start_on: lease.existing ? todayISO() : lease.start_date,
        opening_balance_cents: lease.existing ? toCents(lease.opening) ?? 0 : 0,
      });
    },
    onSuccess: () => {
      setLeaseDone(true);
      setStep("done");
    },
  });

  const steps: { id: Step; icon: typeof Home; label: string }[] = [
    { id: "portfolio", icon: Home, label: t("onboarding.step_portfolio") },
    { id: "property", icon: Building2, label: t("onboarding.step_property") },
    { id: "lease", icon: FileText, label: t("onboarding.step_lease") },
  ];
  const order: Step[] = ["portfolio", "property", "lease", "done"];
  const multi = prop.property_type === "multi_family" || prop.property_type === "commercial";

  return (
    <div className="onboarding">
      <div className="onboarding-card card">
        <div className="card-body stack">
          <div>
            <span className="eyebrow">{t("onboarding.eyebrow")}</span>
            <h1 style={{ marginTop: 6 }}>{step === "done" ? t("onboarding.done_title") : t("onboarding.title")}</h1>
          </div>
          <ol className="steps" aria-label={t("onboarding.progress")}>
            {steps.map((s) => {
              const state = order.indexOf(step) > order.indexOf(s.id) ? "done" : step === s.id ? "current" : "todo";
              return (
                <li key={s.id} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
                  {state === "done" ? <Check size={14} /> : <s.icon size={14} />} {s.label}
                </li>
              );
            })}
          </ol>

          {step === "portfolio" && (
            <div className="form">
              <ErrorBox error={savePortfolio.error} />
              <p className="muted">{t("onboarding.portfolio_intro")}</p>
              <Field label={t("onboarding.portfolio_name")}>
                <Input value={portfolio.name} onChange={(e) => setPortfolio({ ...portfolio, name: e.target.value })} autoFocus />
              </Field>
              <Field label={t("settings.timezone")} hint={t("settings.timezone_hint")}>
                <Select
                  value={portfolio.timezone}
                  onChange={(e) => setPortfolio({ ...portfolio, timezone: e.target.value })}
                  options={Array.from(new Set([portfolio.timezone, ...TIMEZONES])).map((z) => ({ value: z, label: z }))}
                />
              </Field>
              <div className="actions">
                <button className="btn btn-primary" disabled={!portfolio.name || savePortfolio.isPending} onClick={() => savePortfolio.mutate()}>
                  {t("onboarding.continue")}
                </button>
              </div>
            </div>
          )}

          {step === "property" && (
            <div className="form">
              <ErrorBox error={saveProperty.error} />
              <div className="form-row">
                <Field label={t("common.name")} hint={t("properties.name_hint")}>
                  <Input value={prop.name} onChange={(e) => setProp({ ...prop, name: e.target.value })} autoFocus />
                </Field>
                <Field label={t("common.type")}>
                  <Select value={prop.property_type} onChange={(e) => setProp({ ...prop, property_type: e.target.value })} options={PROPERTY_TYPES} />
                </Field>
              </div>
              <Field label={t("properties.street")}>
                <Input value={prop.address_line1} onChange={(e) => setProp({ ...prop, address_line1: e.target.value })} autoComplete="address-line1" />
              </Field>
              <div className="form-row-3">
                <Field label={t("properties.city")}>
                  <Input value={prop.city} onChange={(e) => setProp({ ...prop, city: e.target.value })} />
                </Field>
                <Field label={t("properties.state")}>
                  <Input value={prop.state} onChange={(e) => setProp({ ...prop, state: e.target.value })} />
                </Field>
                <Field label={t("properties.zip")}>
                  <Input value={prop.postal_code} onChange={(e) => setProp({ ...prop, postal_code: e.target.value })} />
                </Field>
              </div>
              {multi && (
                <Field label={t("onboarding.unit_names")} hint={t("units.amenities_hint")}>
                  <Input value={prop.units} onChange={(e) => setProp({ ...prop, units: e.target.value })} />
                </Field>
              )}
              <div className="actions">
                <button
                  className="btn btn-primary"
                  disabled={!prop.name || !prop.address_line1 || !prop.city || !prop.state || !prop.postal_code || saveProperty.isPending}
                  onClick={() => saveProperty.mutate()}
                >
                  {t("onboarding.continue")}
                </button>
                <button className="btn btn-ghost" onClick={() => setStep("done")}>
                  {t("onboarding.skip")}
                </button>
              </div>
            </div>
          )}

          {step === "lease" && created && (
            <div className="form">
              <ErrorBox error={saveLease.error} />
              <p className="muted">{t("onboarding.lease_intro", { unit: `${created.name} · ${created.units?.[0]?.name ?? ""}` })}</p>
              <div className="form-row-3">
                <Field label={t("tenants.first_name")}>
                  <Input value={lease.first_name} onChange={(e) => setLease({ ...lease, first_name: e.target.value })} autoFocus />
                </Field>
                <Field label={t("tenants.last_name")}>
                  <Input value={lease.last_name} onChange={(e) => setLease({ ...lease, last_name: e.target.value })} />
                </Field>
                <Field label={t("common.email")} hint={t("common.optional_hint")}>
                  <Input type="email" value={lease.email} onChange={(e) => setLease({ ...lease, email: e.target.value })} />
                </Field>
              </div>
              <div className="form-row-3">
                <Field label={t("leases.monthly_rent")}>
                  <MoneyInput value={lease.rent} onChange={(v) => setLease({ ...lease, rent: v })} />
                </Field>
                <Field label={t("leases.due_day")}>
                  <Select
                    value={lease.due_day}
                    onChange={(e) => setLease({ ...lease, due_day: e.target.value })}
                    options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: t("leases.due_day_option", { day: ordinal(i + 1) }) }))}
                  />
                </Field>
                <Field label={t("leases.start_date")}>
                  <Input type="date" value={lease.start_date} onChange={(e) => setLease({ ...lease, start_date: e.target.value })} />
                </Field>
              </div>
              <label className="check">
                <input type="checkbox" checked={lease.existing} onChange={(e) => setLease({ ...lease, existing: e.target.checked })} /> {t("leases.in_progress")}
              </label>
              {lease.existing && (
                <Field label={t("leases.opening_balance")} hint={t("leases.opening_balance_hint")}>
                  <MoneyInput value={lease.opening} onChange={(v) => setLease({ ...lease, opening: v })} />
                </Field>
              )}
              <div className="actions">
                <button
                  className="btn btn-primary"
                  disabled={!lease.first_name || !lease.last_name || !toCents(lease.rent) || saveLease.isPending}
                  onClick={() => saveLease.mutate()}
                >
                  {t("leases.create")}
                </button>
                <button className="btn btn-ghost" onClick={() => setStep("done")}>
                  {t("onboarding.skip")}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="stack">
              <div className="success-box">{leaseDone ? t("onboarding.done_with_lease") : t("onboarding.done_body")}</div>
              <ul className="list-plain">
                <li>
                  <span>{t("onboarding.next_tenants")}</span>
                  <Link to="/tenants">{t("nav.tenants")} →</Link>
                </li>
                <li>
                  <span>{t("onboarding.next_documents")}</span>
                  <Link to="/documents">{t("nav.documents")} →</Link>
                </li>
                <li>
                  <span>{t("onboarding.next_help")}</span>
                  <Link to="/help/getting-started">{t("help.title")} →</Link>
                </li>
              </ul>
              <div className="actions">
                <button className="btn btn-primary" onClick={() => navigate("/", { replace: true })}>
                  {t("onboarding.go_dashboard")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
