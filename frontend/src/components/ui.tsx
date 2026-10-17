import { useEffect, useId, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, Copy, X } from "lucide-react";
import { label as fmtLabel } from "../utils/format";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-header">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="center-pad" role="status" aria-label="Loading">
      <div className="spinner" />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );
    // Focus the first form field (or the first control) unless something inside already has focus (autoFocus).
    if (!ref.current?.contains(document.activeElement)) {
      const items = focusables();
      (items.find((el) => el.matches("input, select, textarea")) ?? items[0])?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="modal-header">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

type FieldProps = { label: string; hint?: ReactNode; children: ReactNode };
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span>
        {label} {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Select({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[] }) {
  return (
    <select className="input" {...props}>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {fmtLabel(o)}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

export function MoneyInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="input-prefix">
      <b>$</b>
      <input className="input mono" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" {...rest} />
    </div>
  );
}

// Strata status → mineral mapping (docs/DESIGN_GUIDELINES.md §2.3)
const STATUS_TONES: Record<string, string> = {
  active: "jade",
  occupied: "jade",
  completed: "jade",
  paid: "jade",
  vacant: "citrine",
  in_progress: "citrine",
  high: "citrine",
  emergency: "garnet",
  overdue: "garnet",
  new: "lapis",
  scheduled: "lapis",
  invited: "lapis",
  medium: "lapis",
  assigned: "amethyst",
  maintenance: "amethyst",
  manager: "amethyst",
  owner: "carnelian",
};

export function Badge({ value, children, tone }: { value?: string; children?: ReactNode; tone?: string }) {
  const t = tone ?? (value ? STATUS_TONES[value] : "") ?? "";
  return <span className={`badge${t ? ` badge-${t}` : ""}`}>{children ?? fmtLabel(value)}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? "active" : ""} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function BalanceText({ cents, currency }: { cents: number; currency?: string }) {
  const cls = cents > 0 ? "danger-text" : cents < 0 ? "success-text" : "";
  const text = new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(Math.abs(cents) / 100);
  return (
    <span className={`mono ${cls}`}>
      {cents < 0 ? `${text} credit` : text}
    </span>
  );
}

/** Invitation link with copy button — shareable by text/WhatsApp when email isn't set up. */
export function InviteLink({ url, emailSent, email }: { url: string; emailSent: boolean; email?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable */
    }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className={emailSent ? "success-box" : "info-box"}>
        {emailSent ? `Invitation emailed to ${email}. You can also share this link:` : "The invitation email wasn't sent (email isn't set up yet). Share this link yourself — by text, WhatsApp, or open it in a private window:"}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="input mono" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
        <button className="btn" onClick={copy} type="button">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="small muted">Works once, for 7 days. Anyone with this link can claim the invitation — share it only with the invitee.</p>
    </div>
  );
}
