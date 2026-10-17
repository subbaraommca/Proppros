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

export function LoginPage() {
  const { t } = useTranslation();
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api.post<Me>("/auth/login", { email, password }),
    onSuccess: (me) => {
      setMe(me);
      navigate("/", { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };
  return (
    <AuthShell title={t("auth.signIn")} subtitle={t("auth.welcome_back")}>
      <form className="form" onSubmit={submit}>
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
      navigate("/properties?welcome=1", { replace: true });
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
    mutationFn: () => api.post<Me>("/auth/invitations/accept", { token, name: name || null, password }),
    onSuccess: (me) => {
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
