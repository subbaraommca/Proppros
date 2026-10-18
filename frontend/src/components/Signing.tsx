import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eraser, FileDown, PenLine } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { Brand } from "./Layout";
import { MarkdownView } from "./MarkdownView";
import { Badge, Card, ErrorBox, Field, Input, PageHeader, Spinner } from "./ui";

/** Draw-your-signature canvas. Calls onChange with a PNG data URL, or null when cleared. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14110f";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!;
    const [x, y] = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const [x, y] = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };
  return (
    <div className="sig-pad-wrap">
      <canvas
        ref={canvas}
        className="sig-pad"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={t("signing.draw_label")}
        role="img"
      />
      <div className="sig-pad-foot">
        <span className="small muted">{empty ? t("signing.draw_hint") : t("signing.drawn")}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={clear} disabled={empty}>
          <Eraser size={13} /> {t("signing.clear")}
        </button>
      </div>
    </div>
  );
}

export interface SignPayload {
  signature_name: string;
  signature_image: string | null;
  consent: boolean;
}

/** Typed name + optional drawing + consent. Used by tenants (link/portal) and landlords. */
export function SignatureForm({ defaultName, onSign, pending, error }: { defaultName: string; onSign: (p: SignPayload) => void; pending: boolean; error: unknown }) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSign({ signature_name: name, signature_image: image, consent });
      }}
    >
      <ErrorBox error={error} />
      <Field label={t("signing.full_name")} hint={t("signing.full_name_hint")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
      </Field>
      {name.trim().length > 1 && <div className="sig-typed">{name}</div>}
      <div className="field">
        <span>
          {t("signing.draw")} <span className="small muted">{t("common.optional")}</span>
        </span>
        <SignaturePad onChange={setImage} />
      </div>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t("signing.consent")}
      </label>
      <button className="btn btn-primary" disabled={!consent || name.trim().length < 2 || pending}>
        <PenLine size={15} /> {pending ? t("signing.signing") : t("signing.sign")}
      </button>
    </form>
  );
}

interface SigningView {
  signer: { id: string; name: string; signed_at: string | null; role: string };
  request: { id: string; title: string; body: string; status: string; content_hash: string; document_id: string | null };
  organization: string;
  signers: { name: string; role: string; signed: boolean }[];
}

function SigningBody({ view, onSign, pending, error, portal }: { view: SigningView; onSign: (p: SignPayload) => void; pending: boolean; error: unknown; portal: boolean }) {
  const { t } = useTranslation();
  const done = !!view.signer.signed_at;
  return (
    <div className="sign-layout">
      <Card>
        <div className="sign-doc">
          <MarkdownView source={view.request.body} />
        </div>
      </Card>
      <div className="stack sign-side">
        <Card title={t("signing.signers")}>
          <ul className="list-plain">
            {view.signers.map((s, i) => (
              <li key={i}>
                <span>
                  {s.name} <span className="small muted">· {t(`signing.role_${s.role}`)}</span>
                </span>
                <Badge tone={s.signed ? "jade" : ""}>{s.signed ? t("signing.signed") : t("signing.waiting")}</Badge>
              </li>
            ))}
          </ul>
          <p className="small muted mono" style={{ marginTop: 10, wordBreak: "break-all" }}>
            {t("signing.fingerprint")}: {view.request.content_hash.slice(0, 16)}…
          </p>
        </Card>
        {view.request.status === "voided" ? (
          <div className="info-box">{t("signing.voided")}</div>
        ) : done ? (
          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="success-box">
                <CheckCircle2 size={15} /> {view.request.status === "completed" ? t("signing.all_done") : t("signing.you_signed")}
              </div>
              {portal && view.request.document_id && (
                <a className="btn" href={fileUrl(`/documents/${view.request.document_id}/file`)} target="_blank" rel="noreferrer">
                  <FileDown size={15} /> {t("signing.download")}
                </a>
              )}
              {portal ? <Link to="/portal">{t("signing.back_portal")}</Link> : <p className="small muted">{t("signing.copy_emailed")}</p>}
            </div>
          </Card>
        ) : (
          <Card title={t("signing.your_signature")}>
            <SignatureForm defaultName={view.signer.name} onSign={onSign} pending={pending} error={error} />
          </Card>
        )}
      </div>
    </div>
  );
}

/** Public page reached from the emailed link — no account needed. */
export function SignPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const view = useQuery({ queryKey: ["sign", token], queryFn: () => api.get<SigningView>(`/sign/${token}`), retry: false, refetchOnWindowFocus: false });
  const [signed, setSigned] = useState<SigningView | null>(null);
  const sign = useMutation({ mutationFn: (p: SignPayload) => api.post<SigningView>(`/sign/${token}`, p), onSuccess: setSigned });
  const data = signed ?? view.data;
  return (
    <div className="sign-page">
      <header className="portal-top">
        <div className="portal-top-inner">
          <Brand />
          {data && <span className="small" style={{ color: "#a7a5ad" }}>{t("signing.sent_by", { org: data.organization })}</span>}
        </div>
      </header>
      <main id="main" className="content">
        {view.isLoading ? (
          <Spinner />
        ) : !data ? (
          <Card>
            <ErrorBox error={view.error} />
          </Card>
        ) : (
          <>
            <h1 className="sign-title">{data.request.title}</h1>
            <SigningBody view={data} onSign={(p) => sign.mutate(p)} pending={sign.isPending} error={sign.error} portal={false} />
          </>
        )}
      </main>
    </div>
  );
}

/** Same flow inside the tenant portal. */
export function PortalSignPage() {
  const { t } = useTranslation();
  const { signerId = "" } = useParams();
  const view = useQuery({ queryKey: ["portal-sign", signerId], queryFn: () => api.get<SigningView>(`/portal/signatures/${signerId}`) });
  const [signed, setSigned] = useState<SigningView | null>(null);
  const sign = useMutation({ mutationFn: (p: SignPayload) => api.post<SigningView>(`/portal/signatures/${signerId}/sign`, p), onSuccess: setSigned });
  const data = signed ?? view.data;
  if (view.isLoading) return <Spinner />;
  if (!data) return <ErrorBox error={view.error} />;
  return (
    <>
      <PageHeader breadcrumb={<Link to="/portal">{t("nav.home")}</Link>} title={data.request.title} />
      <SigningBody view={data} onSign={(p) => sign.mutate(p)} pending={sign.isPending} error={sign.error} portal />
    </>
  );
}
