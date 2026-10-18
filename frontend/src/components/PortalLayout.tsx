import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Brand, useTheme } from "./Layout";
import { ImpersonationBanner } from "./ImpersonationBanner";

export function PortalLayout() {
  const { t } = useTranslation();
  const { me, org, switchOrg, logout } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <>
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <header className="portal-top">
        <div className="portal-top-inner">
          <Brand />
          <nav className="portal-nav" aria-label={t("nav.portal_nav")}>
            <NavLink to="/portal" end>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/portal/payments">{t("nav.payments")}</NavLink>
            <NavLink to="/portal/maintenance">{t("nav.maintenance")}</NavLink>
            <NavLink to="/portal/documents">{t("nav.documents")}</NavLink>
            <NavLink to="/portal/help">{t("nav.help")}</NavLink>
          </nav>
          {me && me.organizations.length > 1 && (
            <select className="org-select" value={org?.id} onChange={(e) => switchOrg(e.target.value)} aria-label={t("nav.switch_account")}>
              {me.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="icon-btn" onClick={toggle} aria-label={t("nav.theme")}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn" onClick={() => void logout()} aria-label={t("nav.signOut")} title={t("nav.signOut")}>
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <ImpersonationBanner />
      <main id="main" className="portal-content" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
