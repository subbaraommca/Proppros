import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Brand, useTheme } from "./Layout";

export function PortalLayout() {
  const { me, org, switchOrg, logout } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <>
      <header className="portal-top">
        <div className="portal-top-inner">
          <Brand />
          <nav className="portal-nav" aria-label="Portal navigation">
            <NavLink to="/portal" end>
              Home
            </NavLink>
            <NavLink to="/portal/payments">Payments</NavLink>
            <NavLink to="/portal/maintenance">Maintenance</NavLink>
            <NavLink to="/portal/documents">Documents</NavLink>
          </nav>
          {me && me.organizations.length > 1 && (
            <select className="org-select" value={org?.id} onChange={(e) => switchOrg(e.target.value)} aria-label="Switch account">
              {me.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn" onClick={() => void logout()} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="portal-content">
        <Outlet />
      </main>
    </>
  );
}
