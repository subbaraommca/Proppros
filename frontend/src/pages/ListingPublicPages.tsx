import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bath, BedDouble, CalendarDays, CheckCircle2, FileUp, Mail, PawPrint, Phone, Ruler, Upload } from "lucide-react";
import { api } from "../services/api";
import { Brand } from "../components/Layout";
import { Card, ErrorBox, Field, Input, Spinner, Textarea } from "../components/ui";
import { date, money, toCents } from "../utils/format";

interface PublicListing {
  slug: string;
  title: string;
  description: string | null;
  rent_cents: number;
  deposit_cents: number;
  available_on: string | null;
  lease_term_months: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  amenities: string[];
  pet_policy: string | null;
  utilities_included: string | null;
  requirements: string | null;
  application_fee_cents: number;
  fee_online: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  organization: string;
  photos: string[];
}

function PublicShell({ children, org }: { children: React.ReactNode; org?: string }) {
  const { t } = useTranslation();
  return (
    <div className="sign-page">
      <header className="portal-top">
        <div className="portal-top-inner">
          <Brand />
          {org && <span className="small" style={{ color: "#a7a5ad" }}>{t("listing.listed_by", { org })}</span>}
        </div>
      </header>
      <main id="main" className="content listing-page">
        {children}
      </main>
      <footer className="marketing-footer">
        <span>{t("listing.equal_housing")}</span>
        <Link to="/privacy">{t("nav.privacy")}</Link>
      </footer>
    </div>
  );
}

const photoUrl = (slug: string, id: string) => `/api/public/listings/${slug}/photos/${id}`;

function useMeta(l: PublicListing | undefined) {
  useEffect(() => {
    if (!l) return;
    const prev = document.title;
    document.title = `${l.title} — ${money(l.rent_cents)}/mo · ${l.city}, ${l.state}`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = (l.description ?? "").slice(0, 160);
    return () => {
      document.title = prev;
    };
  }, [l]);
}

export function PublicListingPage() {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const { data: l, error, isLoading } = useQuery({ queryKey: ["public-listing", slug], queryFn: () => api.get<PublicListing>(`/public/listings/${slug}`), retry: false, refetchOnWindowFocus: false });
  const [photo, setPhoto] = useState(0);
  const [applying, setApplying] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  useMeta(l);
  if (isLoading) return <Spinner />;
  if (error || !l)
    return (
      <PublicShell>
        <Card>
          <ErrorBox error={error} />
        </Card>
      </PublicShell>
    );
  const facts = [
    l.beds != null && { icon: BedDouble, text: t("listing.beds", { count: l.beds }) },
    l.baths != null && { icon: Bath, text: t("listing.baths", { count: l.baths }) },
    l.sqft && { icon: Ruler, text: t("listing.sqft", { value: l.sqft.toLocaleString() }) },
    l.available_on && { icon: CalendarDays, text: t("listing.available", { date: date(l.available_on) }) },
  ].filter(Boolean) as { icon: typeof Bath; text: string }[];
  return (
    <PublicShell org={l.organization}>
      <div className="listing-layout">
        <div className="stack">
          {l.photos.length > 0 && (
            <div className="listing-gallery">
              <img src={photoUrl(slug, l.photos[photo])} alt={t("listing.photo_of", { n: photo + 1, title: l.title })} />
              {l.photos.length > 1 && (
                <div className="listing-thumbs">
                  {l.photos.map((p, i) => (
                    <button key={p} className={i === photo ? "active" : ""} onClick={() => setPhoto(i)} aria-label={t("listing.show_photo", { n: i + 1 })}>
                      <img src={photoUrl(slug, p)} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <h1 style={{ margin: "0 0 4px" }}>{l.title}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {l.address}, {l.city}, {l.state} {l.postal_code}
            </p>
          </div>
          <div className="listing-facts">
            {facts.map((f) => (
              <span key={f.text}>
                <f.icon size={16} /> {f.text}
              </span>
            ))}
          </div>
          {l.description && (
            <Card title={t("listing.about")}>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{l.description}</p>
            </Card>
          )}
          {(l.amenities.length > 0 || l.pet_policy || l.utilities_included) && (
            <Card title={t("listing.details")}>
              <dl className="dl">
                {l.amenities.length > 0 && (
                  <>
                    <dt>{t("listing.amenities")}</dt>
                    <dd>{l.amenities.join(", ")}</dd>
                  </>
                )}
                {l.pet_policy && (
                  <>
                    <dt>
                      <PawPrint size={12} /> {t("listing.pets")}
                    </dt>
                    <dd>{l.pet_policy}</dd>
                  </>
                )}
                {l.utilities_included && (
                  <>
                    <dt>{t("listing.utilities")}</dt>
                    <dd>{l.utilities_included}</dd>
                  </>
                )}
                {l.lease_term_months && (
                  <>
                    <dt>{t("listing.lease_term")}</dt>
                    <dd>{t("listing.months", { count: l.lease_term_months })}</dd>
                  </>
                )}
              </dl>
            </Card>
          )}
          {l.requirements && (
            <Card title={t("listing.requirements")}>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{l.requirements}</p>
            </Card>
          )}
          <div ref={formRef}>{applying && <ApplyForm listing={l} />}</div>
        </div>
        <div className="stack listing-side">
          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="plan-price">
                {money(l.rent_cents)} <span className="small muted">{t("listing.per_month")}</span>
              </div>
              <dl className="dl small">
                <dt>{t("listing.deposit")}</dt>
                <dd>{money(l.deposit_cents)}</dd>
                <dt>{t("listing.app_fee")}</dt>
                <dd>{l.application_fee_cents ? money(l.application_fee_cents) : t("listing.no_fee")}</dd>
              </dl>
              {!applying && (
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    setApplying(true);
                    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                >
                  {t("listing.apply_now")}
                </button>
              )}
              <div className="small">
                {l.contact_email && (
                  <div>
                    <a href={`mailto:${l.contact_email}?subject=${encodeURIComponent(l.title)}`}>
                      <Mail size={12} /> {l.contact_email}
                    </a>
                  </div>
                )}
                {l.contact_phone && (
                  <div>
                    <a href={`tel:${l.contact_phone}`}>
                      <Phone size={12} /> {l.contact_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>
          <p className="small muted">{t("listing.fair_housing")}</p>
        </div>
      </div>
    </PublicShell>
  );
}

function ApplyForm({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    desired_move_in: listing.available_on ?? "",
    current_address: "",
    current_rent: "",
    current_landlord_name: "",
    current_landlord_phone: "",
    years_at_address: "",
    employer: "",
    job_title: "",
    income: "",
    occupants: 1,
    co_name: "",
    co_email: "",
    pets: "",
    vehicles: "",
    prior_eviction: false,
    message: "",
    signature_name: "",
    consent: false,
    website: "",
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const submit = useMutation({
    mutationFn: () =>
      api.post<{ token: string; checkout_url: string | null }>(`/public/listings/${listing.slug}/apply`, {
        first_name: f.first_name,
        last_name: f.last_name,
        email: f.email,
        phone: f.phone,
        desired_move_in: f.desired_move_in || null,
        current_address: f.current_address,
        current_rent_cents: f.current_rent ? toCents(f.current_rent) : null,
        current_landlord_name: f.current_landlord_name || null,
        current_landlord_phone: f.current_landlord_phone || null,
        years_at_address: f.years_at_address ? Number(f.years_at_address) : null,
        employer: f.employer || null,
        job_title: f.job_title || null,
        monthly_income_cents: f.income ? toCents(f.income) : null,
        occupants: f.occupants,
        co_applicants: f.co_name ? [{ name: f.co_name, email: f.co_email || null }] : [],
        pets: f.pets || null,
        vehicles: f.vehicles || null,
        prior_eviction: f.prior_eviction,
        message: f.message || null,
        signature_name: f.signature_name,
        consent: f.consent,
        website: f.website || null,
      }),
    onSuccess: (r) => {
      if (r.checkout_url) window.location.assign(r.checkout_url);
      else navigate(`/application/${r.token}?new=1`);
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };
  return (
    <Card title={t("apply.title")}>
      <form className="form" onSubmit={onSubmit}>
        <p className="small muted">{t("apply.intro")}</p>
        <h3 className="form-section">{t("apply.about_you")}</h3>
        <div className="form-row">
          <Field label={t("auth.first_name")}>
            <Input required value={f.first_name} onChange={(e) => set({ first_name: e.target.value })} autoComplete="given-name" />
          </Field>
          <Field label={t("auth.last_name")}>
            <Input required value={f.last_name} onChange={(e) => set({ last_name: e.target.value })} autoComplete="family-name" />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.email")}>
            <Input type="email" required value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label={t("common.phone")}>
            <Input type="tel" required minLength={7} value={f.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("apply.move_in")}>
            <Input type="date" value={f.desired_move_in} onChange={(e) => set({ desired_move_in: e.target.value })} />
          </Field>
          <Field label={t("apply.occupants")} hint={t("apply.occupants_hint")}>
            <Input type="number" min={1} max={20} value={f.occupants} onChange={(e) => set({ occupants: Number(e.target.value) })} />
          </Field>
        </div>
        <h3 className="form-section">{t("apply.residence")}</h3>
        <Field label={t("apply.current_address")}>
          <Input required minLength={3} value={f.current_address} onChange={(e) => set({ current_address: e.target.value })} autoComplete="street-address" />
        </Field>
        <div className="form-row-3">
          <Field label={t("apply.current_rent")}>
            <Input inputMode="decimal" value={f.current_rent} onChange={(e) => set({ current_rent: e.target.value })} />
          </Field>
          <Field label={t("apply.years_there")}>
            <Input inputMode="decimal" value={f.years_at_address} onChange={(e) => set({ years_at_address: e.target.value })} />
          </Field>
          <Field label={t("apply.landlord_name")}>
            <Input value={f.current_landlord_name} onChange={(e) => set({ current_landlord_name: e.target.value })} />
          </Field>
        </div>
        <Field label={t("apply.landlord_phone")}>
          <Input type="tel" value={f.current_landlord_phone} onChange={(e) => set({ current_landlord_phone: e.target.value })} />
        </Field>
        <h3 className="form-section">{t("apply.income")}</h3>
        <div className="form-row-3">
          <Field label={t("apply.employer")}>
            <Input value={f.employer} onChange={(e) => set({ employer: e.target.value })} autoComplete="organization" />
          </Field>
          <Field label={t("apply.job_title")}>
            <Input value={f.job_title} onChange={(e) => set({ job_title: e.target.value })} />
          </Field>
          <Field label={t("apply.monthly_income")} hint={t("apply.income_hint")}>
            <Input inputMode="decimal" value={f.income} onChange={(e) => set({ income: e.target.value })} />
          </Field>
        </div>
        <h3 className="form-section">{t("apply.household")}</h3>
        <div className="form-row">
          <Field label={t("apply.co_name")} hint={t("apply.co_hint")}>
            <Input value={f.co_name} onChange={(e) => set({ co_name: e.target.value })} />
          </Field>
          <Field label={t("apply.co_email")}>
            <Input type="email" value={f.co_email} onChange={(e) => set({ co_email: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("apply.pets")}>
            <Input value={f.pets} onChange={(e) => set({ pets: e.target.value })} placeholder={t("apply.pets_placeholder")} />
          </Field>
          <Field label={t("apply.vehicles")}>
            <Input value={f.vehicles} onChange={(e) => set({ vehicles: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.prior_eviction} onChange={(e) => set({ prior_eviction: e.target.checked })} /> {t("apply.prior_eviction")}
        </label>
        <Field label={t("apply.message")}>
          <Textarea rows={3} value={f.message} onChange={(e) => set({ message: e.target.value })} maxLength={3000} />
        </Field>
        <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set({ website: e.target.value })} aria-hidden="true" name="website" />
        <div className="info-box small">{t("apply.screening_note")}</div>
        <Field label={t("apply.signature")} hint={t("apply.signature_hint")}>
          <Input required minLength={2} value={f.signature_name} onChange={(e) => set({ signature_name: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} /> {t("apply.consent")}
        </label>
        <ErrorBox error={submit.error} />
        <button className="btn btn-primary" disabled={!f.consent || submit.isPending}>
          {submit.isPending ? t("apply.submitting") : listing.application_fee_cents && listing.fee_online ? t("apply.submit_and_pay", { amount: money(listing.application_fee_cents) }) : t("apply.submit")}
        </button>
        {listing.application_fee_cents > 0 && !listing.fee_online && <p className="small muted">{t("apply.fee_offline", { amount: money(listing.application_fee_cents) })}</p>}
      </form>
    </Card>
  );
}

interface AppStatus {
  first_name: string;
  listing_title: string;
  listing_slug: string | null;
  organization: string;
  status: string;
  submitted_at: string;
  fee_cents: number;
  fee_status: string;
  fee_online: boolean;
  screening_requested: boolean;
  screening_url: string | null;
  documents: { id: string; name: string; uploaded_at: string }[];
  can_upload: boolean;
}

export function ApplicationStatusPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const qc = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const input = useRef<HTMLInputElement>(null);
  const { data, error, isLoading } = useQuery({ queryKey: ["application-status", token], queryFn: () => api.get<AppStatus>(`/public/applications/${token}`), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["application-status", token] });
  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        await api.upload(`/public/applications/${token}/documents`, form);
      }
    },
    onSuccess: refresh,
  });
  const pay = useMutation({ mutationFn: () => api.post<{ checkout_url: string }>(`/public/applications/${token}/pay`), onSuccess: (r) => window.location.assign(r.checkout_url) });
  const withdraw = useMutation({ mutationFn: () => api.post(`/public/applications/${token}/withdraw`), onSuccess: refresh });
  if (isLoading) return <Spinner />;
  if (error || !data)
    return (
      <PublicShell>
        <Card>
          <ErrorBox error={error} />
        </Card>
      </PublicShell>
    );
  const open = ["submitted", "screening"].includes(data.status);
  return (
    <PublicShell org={data.organization}>
      <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div>
          <span className="eyebrow">{t("apply.status_eyebrow")}</span>
          <h1 style={{ margin: "6px 0 0" }}>{data.listing_title}</h1>
        </div>
        {params.get("new") && (
          <div className="success-box">
            <CheckCircle2 size={15} /> {t("apply.thanks", { name: data.first_name })}
          </div>
        )}
        {params.get("fee") === "paid" && <div className="success-box">{t("apply.fee_thanks")}</div>}
        <ErrorBox error={upload.error || pay.error || withdraw.error} />
        <Card>
          <dl className="dl">
            <dt>{t("common.status")}</dt>
            <dd>
              <strong>{t(`apply.status_${data.status}`)}</strong>
              <div className="small muted">{t(`apply.status_${data.status}_body`)}</div>
            </dd>
            <dt>{t("apply.submitted")}</dt>
            <dd>{date(data.submitted_at)}</dd>
            {data.fee_cents > 0 && (
              <>
                <dt>{t("listing.app_fee")}</dt>
                <dd>
                  {money(data.fee_cents)} · {t(`apply.fee_${data.fee_status}`)}
                  {data.fee_online && (
                    <div>
                      <button className="btn btn-sm btn-primary" style={{ marginTop: 6 }} onClick={() => pay.mutate()} disabled={pay.isPending}>
                        {t("apply.pay_now")}
                      </button>
                    </div>
                  )}
                </dd>
              </>
            )}
          </dl>
        </Card>
        {data.screening_requested && data.screening_url && open && (
          <Card title={t("apply.screening_title")}>
            <p>{t("apply.screening_body")}</p>
            <a className="btn btn-primary" href={data.screening_url} target="_blank" rel="noreferrer">
              {t("apply.start_screening")}
            </a>
          </Card>
        )}
        <Card title={t("apply.documents")}>
          <p className="small muted">{t("apply.documents_hint")}</p>
          {data.documents.length > 0 && (
            <ul className="list-plain" style={{ margin: "10px 0" }}>
              {data.documents.map((d) => (
                <li key={d.id}>
                  <span>
                    <FileUp size={13} /> {d.name}
                  </span>
                  <span className="small muted">{date(d.uploaded_at)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.can_upload && (
            <>
              <input ref={input} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
              <button className="btn" onClick={() => input.current?.click()} disabled={upload.isPending}>
                <Upload size={14} /> {upload.isPending ? t("common.uploading") : t("apply.upload")}
              </button>
            </>
          )}
        </Card>
        {open && (
          <button className="btn btn-ghost" style={{ justifySelf: "start" }} onClick={() => window.confirm(t("apply.withdraw_confirm")) && withdraw.mutate()}>
            {t("apply.withdraw")}
          </button>
        )}
        {data.listing_slug && <Link to={`/listings/${data.listing_slug}`}>{t("apply.back_to_listing")}</Link>}
      </div>
    </PublicShell>
  );
}
