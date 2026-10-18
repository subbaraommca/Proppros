import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadSession, setOrgId, setToken, setUnauthorizedHandler } from "../api/client";
import type { LoginResult, Me, Org } from "../api/types";
import { unregisterPush } from "../push/usePush";
import { queryClient } from "../queryClient";

interface AuthValue {
  loading: boolean;
  me: Me | null;
  org: Org | null;
  signIn: (email: string, password: string) => Promise<{ mfaToken: string } | null>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchOrg: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [orgId, setOrg] = useState<string | null>(null);

  const accept = useCallback(async (token: string, user: Me) => {
    await setToken(token);
    const first = user.organizations[0]?.id ?? null;
    await setOrgId(first);
    setOrg(first);
    setMe(user);
  }, []);

  const signOut = useCallback(async () => {
    // Sign out of this phone only: drop its push registration and token. (Web sessions stay signed in.)
    await unregisterPush();
    await setToken(null);
    await setOrgId(null);
    queryClient.clear();
    setMe(null);
    setOrg(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const session = await loadSession();
      if (session.token) {
        try {
          const user = await api.get<Me>("/auth/me");
          setMe(user);
          const saved = user.organizations.find((o) => o.id === session.orgId)?.id ?? user.organizations[0]?.id ?? null;
          await setOrgId(saved);
          setOrg(saved);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      me,
      org: me?.organizations.find((o) => o.id === orgId) ?? null,
      signIn: async (email, password) => {
        const r = await api.post<LoginResult>("/auth/token", { email, password });
        if ("mfa_required" in r) return { mfaToken: r.mfa_token };
        await accept(r.access_token, r.me);
        return null;
      },
      verifyMfa: async (mfaToken, code) => {
        const r = await api.post<LoginResult>("/auth/token/mfa", { mfa_token: mfaToken, code });
        if ("access_token" in r) await accept(r.access_token, r.me);
      },
      signOut,
      switchOrg: async (id) => {
        await setOrgId(id);
        queryClient.clear();
        setOrg(id);
      },
    }),
    [loading, me, orgId, accept, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export const isStaff = (org: Org | null) => !!org && org.role !== "tenant" && org.role !== "vendor";
