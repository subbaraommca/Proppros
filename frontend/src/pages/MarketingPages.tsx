import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { BarChart3, Check, CreditCard, FileText, KeyRound, Users, Wrench } from "lucide-react";
import { api } from "../services/api";
import { Brand } from "../components/Layout";
import { money } from "../utils/format";
import { HelpPage } from "./HelpPages";

interface Plan {
  id: "free" | "pro" | "business";
  unit_limit: number | null;
  seat_limit: number | null;
  price_cents_per_unit: number;
}

function MarketingShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="marketing">
      <header className="portal-top">
        <div className="portal-top-inner">
          <Link to="/" style={{ textDecoration: "none" }}>
            <Brand />
          </Link>
          <nav className="portal-nav" aria-label={t("marketing.nav")}>
            <Link to="/pricing">{t("marketing.pricing")}</Link>
            <Link to="/help">{t("help.title")}</Link>
          </nav>
          <Link to="/login" className="btn btn-sm btn-ghost" style={{ color: "#fff" }}>
            {t("auth.signIn")}
          </Link>
          <Link to="/register" className="btn btn-sm btn-primary">
            {t("marketing.start_free")}
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="marketing-footer">
        <span>© {new Date().getFullYear()} Proppros</span>
        <Link to="/privacy">{t("nav.privacy")}</Link>
        <Link to="/terms">{t("nav.terms")}</Link>
      </footer>
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const features = [
    { icon: FileText, key: "leases" },
    { icon: CreditCard, key: "rent" },
    { icon: Wrench, key: "maintenance" },
    { icon: BarChart3, key: "reports" },
    { icon: Users, key: "portal" },
    { icon: KeyRound, key: "team" },
  ] as const;
  return (
    <MarketingShell>
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow">{t("auth.hero_eyebrow")}</span>
          <h1>
            <Trans i18nKey="auth.hero_title" components={{ em: <em /> }} />
          </h1>
          <p className="lead">{t("marketing.lead")}</p>
          <div className="actions">
            <Link to="/register" className="btn btn-primary">
              {t("marketing.start_free")}
            </Link>
            <Link to="/pricing" className="btn">
              {t("marketing.see_pricing")}
            </Link>
          </div>
          <p className="small muted">{t("marketing.free_note")}</p>
        </div>
      </section>
      <section className="features">
        {features.map(({ icon: Icon, key }) => (
          <div key={key} className="card card-body feature">
            <Icon size={20} />
            <h3>{t(`marketing.feature_${key}_title`)}</h3>
            <p className="muted">{t(`marketing.feature_${key}_body`)}</p>
          </div>
        ))}
      </section>
      <section className="closing">
        <p className="quote">{t("auth.hero_quote")}</p>
        <Link to="/register" className="btn btn-primary">
          {t("marketing.start_free")}
        </Link>
      </section>
    </MarketingShell>
  );
}

export function PricingPage() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["public-plans"], queryFn: () => api.get<{ plans: Plan[]; billing_active: boolean }>("/public/plans") });
  return (
    <MarketingShell>
      <section className="hero hero-compact">
        <div className="hero-inner">
          <span className="eyebrow">{t("marketing.pricing")}</span>
          <h1>{t("marketing.pricing_title")}</h1>
          <p className="lead">{t("marketing.pricing_lead")}</p>
        </div>
      </section>
      <section className="pricing">
        {(data?.plans ?? []).map((p) => (
          <div key={p.id} className={`card card-body plan${p.id === "pro" ? " card-glow" : ""}`}>
            <span className="eyebrow">{t(`plans.${p.id}`)}</span>
            <div className="plan-price">
              {p.price_cents_per_unit ? (
                <>
                  {money(p.price_cents_per_unit)}
                  <span className="small muted"> {t("marketing.per_unit_month")}</span>
                </>
              ) : (
                t("marketing.free")
              )}
            </div>
            <ul className="plan-features">
              <li>
                <Check size={14} /> {p.unit_limit ? t("marketing.units_up_to", { count: p.unit_limit }) : t("marketing.units_unlimited")}
              </li>
              <li>
                <Check size={14} /> {p.seat_limit ? t("marketing.seats_up_to", { count: p.seat_limit }) : t("marketing.seats_unlimited")}
              </li>
              {(["f1", "f2", "f3"] as const).map((f) => (
                <li key={f}>
                  <Check size={14} /> {t(`marketing.${p.id}_${f}`)}
                </li>
              ))}
            </ul>
            <Link to="/register" className={`btn btn-block${p.id === "pro" ? " btn-primary" : ""}`}>
              {p.id === "free" ? t("marketing.start_free") : t("marketing.start_with", { plan: t(`plans.${p.id}`) })}
            </Link>
          </div>
        ))}
      </section>
      <p className="small muted" style={{ textAlign: "center", padding: "0 16px 48px" }}>
        {t("marketing.pricing_note")}
      </p>
    </MarketingShell>
  );
}

export function PublicHelpPage() {
  return (
    <MarketingShell>
      <div className="content marketing-help">
        <HelpPage />
      </div>
    </MarketingShell>
  );
}
