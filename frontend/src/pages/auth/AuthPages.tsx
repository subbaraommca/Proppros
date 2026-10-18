import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { CheckCircle2, Home } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import type { Me } from "../../types";
import { ErrorBox, Field, Input, Spinner } from "../../components/ui";
import { label } from "../../utils/format";

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand">
          <span className="brand-mark">
            <Home size={16} />
          </span>
          Proppros
        </div>
        <div>
          <span className="eyebrow">{t("auth.hero_eyebrow")}</span>
          <h1>
            <Trans i18nKey="auth.hero_title" components={{ em: <em /> }} />
          </h1>
          <ul>
            {(["hero_point_rent", "hero_point_records", "hero_point_maintenance", "hero_point_reports"] as const).map((k) => t(`auth.${k}`)).map((x) => (
              <li key={x}>
                <CheckCircle2 size={18} /> {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="quote">{t("auth.hero_quote")}</p>
          <p className="quote-by">{t("app.tagline")}</p>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <span className="eyebrow">Proppros</span>
          <h2>{title}</h2>
          {subtitle && <p className="muted" style={{ marginBottom: 20 }}>{subtitle}</p>}
          {children}
          <p className="small muted" style={{ marginTop: 28 }}>
            <Link to="/privacy">{t("nav.privacy")}</Link> · <Link to="/terms">{t("nav.terms")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

type LoginResult = Me | { mfa_required: true; mfa_token: string };

function GoogleButton() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["auth-providers"], queryFn: () => api.get<{ google: boolean }>("/auth/providers"), staleTime: 300_000 });
  if (!data?.google) return null;
  return (
    <>
      <a className="btn btn-block" href="/api/auth/google/start">
        <GoogleMark /> {t("auth.continue_google")}
      </a>
      <div className="divider-label">
        <span>{t("auth.or")}</span>
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(params.get("mfa"));
  const [code, setCode] = useState("");
  const done = (me: Me) => {
    setMe(me);
    navigate("/", { replace: true });
  };
  const login = useMutation({
    mutationFn: () => api.post<LoginResult>("/auth/login", { email, password }),
    onSuccess: (r) => ("mfa_required" in r ? setMfaToken(r.mfa_token) : done(r)),
  });
  const verify = useMutation({ mutationFn: () => api.post<Me>("/auth/login/mfa", { mfa_token: mfaToken, code }), onSuccess: done });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };
  if (mfaToken) {
    return (
      <AuthShell title={t("auth.mfa_title")} subtitle={t("auth.mfa_subtitle")}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate();
          }}
        >
          <ErrorBox error={verify.error} />
          <Field label={t("settings.mfa_code")} hint={t("auth.mfa_hint")}>
            <Input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.trim())} autoFocus />
          </Field>
          <button className="btn btn-primary btn-block" disabled={code.length < 6 || verify.isPending}>
            {verify.isPending ? t("auth.signingIn") : t("auth.verify")}
          </button>
          <button type="button" className="link-btn small" onClick={() => setMfaToken(null)}>
            {t("common.back")}
          </button>
        </form>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.signIn")} subtitle={t("auth.welcome_back")}>
      <form className="form" onSubmit={submit}>
        {params.get("error") === "google" && <div className="error-box">{t("auth.google_failed")}</div>}
        <GoogleButton />
        <ErrorBox error={login.error} />
        <Field label={t("auth.email")}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t("auth.password")}>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={login.isPending}>
          {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between" }} className="small">
          <Link to="/forgot-password">{t("auth.forgot")}</Link>
          <span>
            {t("auth.noAccount")} <Link to="/register">{t("auth.createAccount")}</Link>
          </span>
        </div>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", organization_name: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const register = useMutation({
    mutationFn: () => api.post<Me>("/auth/register", { ...form, organization_name: form.organization_name || null }),
    onSuccess: (me) => {
      setMe(me);
      navigate("/welcome", { replace: true });
    },
  });
  return (
    <AuthShell title={t("auth.createAccount")} subtitle={t("auth.register_subtitle")}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate();
        }}
      >
        <GoogleButton />
        <ErrorBox error={register.error} />
        <Field label={t("auth.name")}>
          <Input required autoComplete="name" value={form.name} onChange={set("name")} />
        </Field>
        <Field label={t("auth.email")}>
          <Input type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
          <Input type="password" required minLength={10} autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <Field label={t("auth.orgName")} hint={t("auth.orgName_hint")}>
          <Input value={form.organization_name} onChange={set("organization_name")} placeholder={t("auth.orgName_placeholder")} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={register.isPending}>
          {register.isPending ? t("auth.creating") : t("auth.createAccount")}
        </button>
        <p className="small muted">
          <Trans i18nKey="auth.agree" components={{ terms: <Link to="/terms" />, privacy: <Link to="/privacy" /> }} />
        </p>
        <p className="small">
          {t("auth.haveAccount")} <Link to="/login">{t("auth.signIn")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => api.post("/auth/forgot-password", { email }) });
  return (
    <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.forgot_subtitle")}>
      {send.isSuccess ? (
        <div className="stack">
          <div className="success-box">{t("auth.resetSent")}</div>
          <Link to="/login">{t("auth.signIn")}</Link>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <ErrorBox error={send.error} />
          <Field label={t("auth.email")}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={send.isPending}>
            {t("auth.sendReset")}
          </button>
          <Link to="/login" className="small">
            {t("common.back")}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const reset = useMutation({ mutationFn: () => api.post("/auth/reset-password", { token: params.get("token"), password }) });
  return (
    <AuthShell title={t("auth.setPassword")}>
      {reset.isSuccess ? (
        <div className="stack">
          <div className="success-box">{t("auth.password_updated")}</div>
          <Link className="btn btn-primary" to="/login">
            {t("auth.signIn")}
          </Link>
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate();
          }}
        >
          <ErrorBox error={reset.error} />
          <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <Input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={reset.isPending}>
            {t("auth.setPassword")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const verify = useMutation({ mutationFn: () => api.post("/auth/verify-email", { token: params.get("token") }) });
  const { mutate } = verify;
  const ran = useRef(false); // StrictMode runs effects twice; the token is single-use
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    mutate();
  }, [mutate]);
  return (
    <AuthShell title={t("auth.verify_title")}>
      {verify.isPending && <Spinner />}
      <ErrorBox error={verify.error} />
      {verify.isSuccess && (
        <div className="stack">
          <div className="success-box">{t("auth.verified")}</div>
          <a className="btn btn-primary" href="/">
            {t("auth.continue")}
          </a>
        </div>
      )}
    </AuthShell>
  );
}

interface InvitePreview {
  email: string;
  role: string;
  organization: string;
  has_account: boolean;
}

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const preview = useQuery({ queryKey: ["invite", token], queryFn: () => api.get<InvitePreview>(`/auth/invitations/${token}`), retry: false });
  const accept = useMutation({
    mutationFn: () => api.post<Me | { mfa_required: true; mfa_token: string }>("/auth/invitations/accept", { token, name: name || null, password }),
    onSuccess: (r) => {
      if ("mfa_required" in r) {
        navigate(`/login?mfa=${encodeURIComponent(r.mfa_token)}`, { replace: true });
        return;
      }
      const me = r;
      const org = me.organizations.find((o) => o.name === preview.data?.organization) ?? me.organizations[0];
      try {
        localStorage.setItem("pp-org", org.id);
      } catch {
        /* ignore */
      }
      setMe(me);
      navigate(org.role === "tenant" ? "/portal" : "/", { replace: true });
    },
  });
  if (preview.isLoading) return <Spinner />;
  if (preview.error || !preview.data)
    return (
      <AuthShell title={t("auth.invitation")}>
        <ErrorBox error={preview.error ?? new Error(t("auth.invitation_not_found"))} />
        <p style={{ marginTop: 16 }}>
          <Link to="/login">{t("auth.go_to_sign_in")}</Link>
        </p>
      </AuthShell>
    );
  const inv = preview.data;
  const isTenant = inv.role === "tenant";
  return (
    <AuthShell
      title={isTenant ? t("auth.invite_tenant_title") : t("auth.invite_team_title", { org: inv.organization })}
      subtitle={
        isTenant ? (
          <Trans i18nKey="auth.invite_tenant_subtitle" values={{ org: inv.organization, email: inv.email }} components={{ strong: <strong /> }} />
        ) : (
          <Trans i18nKey="auth.invite_team_subtitle" values={{ role: label(inv.role), email: inv.email }} components={{ strong: <strong /> }} />
        )
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          accept.mutate();
        }}
      >
        <ErrorBox error={accept.error} />
        {!inv.has_account && (
          <Field label={t("auth.name")}>
            <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label={inv.has_account ? t("auth.existing_password") : t("auth.choose_password")} hint={inv.has_account ? undefined : t("auth.passwordHint")}>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={inv.has_account ? "current-password" : "new-password"} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={accept.isPending}>
          {accept.isPending ? t("auth.joining") : t("auth.accept_invitation")}
        </button>
      </form>
    </AuthShell>
  );
}
