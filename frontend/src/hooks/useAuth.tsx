import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, getOrgId, setOrgId } from "../services/api";
import type { Me, OrgSummary } from "../types";

interface AuthState {
  me: Me | null;
  loading: boolean;
  org: OrgSummary | null;
  switchOrg: (id: string) => void;
  setMe: (me: Me) => void;
  logout: () => Promise<void>;
  can: (...roles: OrgSummary["role"][]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<Me>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const me = data ?? null;

  const org = useMemo(() => {
    if (!me || me.organizations.length === 0) return null;
    const stored = getOrgId();
    const found = me.organizations.find((o) => o.id === stored) ?? me.organizations[0];
    if (found.id !== stored) setOrgId(found.id);
    return found;
  }, [me]);

  const switchOrg = useCallback(
    (id: string) => {
      setOrgId(id);
      qc.clear();
      window.location.assign("/");
    },
    [qc],
  );

  const setMe = useCallback(
    (next: Me) => {
      if (next.organizations[0] && !next.organizations.some((o) => o.id === getOrgId())) {
        setOrgId(next.organizations[0].id);
      }
      qc.setQueryData(["me"], next);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setOrgId(null);
      qc.clear();
      qc.setQueryData(["me"], null);
      // Land on the public home page, not the sign-in redirect for the page the user was on.
      window.location.assign("/");
    }
  }, [qc]);

  const can = useCallback((...roles: OrgSummary["role"][]) => !!org && roles.includes(org.role), [org]);

  return (
    <AuthContext.Provider value={{ me, loading: isLoading, org, switchOrg, setMe, logout, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
