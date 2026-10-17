import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  Sun,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import type { Role } from "../types";

type NavItem = { to: string; key: string; icon: typeof Home; roles?: Role[]; group: keyof typeof GROUP_LABELS };
const GROUP_LABELS = { portfolio: "Portfolio", money: "Money", operations: "Operations", account: "Account" } as const;

const FINANCE: Role[] = ["owner", "manager", "accountant"];
const NAV: NavItem[] = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, roles: FINANCE, group: "portfolio" },
  { to: "/properties", key: "properties", icon: Building2, group: "portfolio" },
  { to: "/tenants", key: "tenants", icon: Users, roles: FINANCE, group: "portfolio" },
  { to: "/leases", key: "leases", icon: FileText, roles: FINANCE, group: "portfolio" },
  { to: "/payments", key: "payments", icon: CreditCard, roles: FINANCE, group: "money" },
  { to: "/expenses", key: "expenses", icon: Receipt, roles: FINANCE, group: "money" },
  { to: "/reports", key: "reports", icon: BarChart3, roles: FINANCE, group: "money" },
  { to: "/maintenance", key: "maintenance", icon: Wrench, group: "operations" },
  { to: "/documents", key: "documents", icon: FolderOpen, roles: FINANCE, group: "operations" },
  { to: "/settings", key: "settings", icon: Settings, group: "account" },
];

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    // Dark-first: Basalt is the default; Limestone only when chosen.
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pp-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return { theme, toggle };
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Home size={17} />
      </span>
      Proppros
    </div>
  );
}

function VerifyBanner() {
  const { me } = useAuth();
  const [sent, setSent] = useState(false);
  if (!me || me.email_verified) return null;
  return (
    <div className="banner">
      Please verify your email address ({me.email}).
      {sent ? <span>Sent — check your inbox.</span> : <button onClick={() => api.post("/auth/resend-verification").then(() => setSent(true))}>Resend email</button>}
    </div>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { me, org, switchOrg, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const items = NAV.filter((n) => !n.roles || (org && n.roles.includes(org.role)));

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
        <Brand />
        {(me?.organizations.length ?? 0) > 1 && (
          <select className="org-select" value={org?.id} onChange={(e) => switchOrg(e.target.value)} aria-label="Switch portfolio">
            {me!.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.role === "tenant" ? " (tenant)" : ""}
              </option>
            ))}
          </select>
        )}
        <nav className="nav">
          {(Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]).map((group) => {
            const groupItems = items.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                <div className="nav-label eyebrow">{GROUP_LABELS[group]}</div>
                {groupItems.map(({ to, key, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === "/"}>
                    <Icon size={17} /> {t(`nav.${key}`)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user" title={me?.email}>
            <strong>{me?.name}</strong>
            <span>
              {org?.role} · {org?.name}
            </span>
          </div>
          <button className="sidebar-btn" onClick={toggle}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className="sidebar-btn" onClick={() => void logout()}>
            <LogOut size={16} /> {t("nav.signOut")}
          </button>
        </div>
      </aside>
      <div className={`scrim${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <Brand />
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label={t("nav.menu")}>
            <Menu size={20} />
          </button>
        </header>
        <VerifyBanner />
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
