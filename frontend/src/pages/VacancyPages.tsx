import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ExternalLink, FileText, Gavel, Megaphone, Plus, Scale, Search, Send, ShieldAlert, Trash2, UserCheck, X } from "lucide-react";
import { api, fileUrl } from "../services/api";
import type { Property } from "../types";
import { PhotoGrid } from "../components/Documents";
import { VacancyKit } from "../components/VacancyKit";
import { Badge, Card, Empty, ErrorBox, Field, Input, InviteLink, Modal, MoneyInput, PageHeader, Select, Spinner, Stat, Textarea } from "../components/ui";
import { date, dateTime, fromCents, money, toCents, todayISO } from "../utils/format";
import { Stars } from "./VendorPages";

interface Listing {
  id: string;
  slug: string;
  status: "draft" | "published" | "closed";
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
  screening_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  views: number;
  property_name: string;
  unit_name: string;
  unit_id: string;
  address: string;
  public_url: string;
  share_url: string;
  application_counts: Record<string, number>;
  photos: { id: string }[];
}

interface AppSummary {
  id: string;
  listing_title: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  desired_move_in: string | null;
  monthly_income_cents: number | null;
  income_to_rent: number | null;
  occupants: number;
  co_applicants: number;
  pets: string | null;
  prior_eviction: boolean;
  fee_status: string;
  screening_status: string;
  credit_score: number | null;
  criminal_count: number;
  eviction_count: number;
  screening_result: string | null;
  rating: number | null;
}

const STATUS_TONE: Record<string, string> = { published: "jade", draft: "citrine", closed: "" };
const APP_TONE: Record<string, string> = { submitted: "lapis", screening: "citrine", approved: "jade", declined: "garnet", withdrawn: "", converted: "jade" };

function NewListingModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const units = (properties ?? []).flatMap((p) => (p.units ?? []).map((u) => ({ value: u.id, label: `${p.name} · ${u.name}${u.status === "vacant" ? ` (${t("enums.vacant").toLowerCase()})` : ""}`, vacant: u.status === "vacant" })));
  const [unit, setUnit] = useState("");
  const create = useMutation({ mutationFn: () => api.post<Listing>("/listings", { unit_id: unit || units.find((u) => u.vacant)?.value || units[0]?.value }), onSuccess: (l) => navigate(`/vacancy/${l.id}`) });
  return (
    <Modal
      title={t("vacancy.new")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!units.length || create.isPending} onClick={() => create.mutate()}>
          {t("vacancy.create")}
        </button>
      }
    >
      <div className="form">
        <ErrorBox error={create.error} />
        <Field label={t("common.unit")} hint={t("vacancy.unit_hint")}>
          <Select value={unit || units.find((u) => u.vacant)?.value || units[0]?.value || ""} onChange={(e) => setUnit(e.target.value)} options={units} />
        </Field>
      </div>
    </Modal>
  );
}

export function VacancyPage() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const { data, error, isLoading } = useQuery({ queryKey: ["listings"], queryFn: () => api.get<Listing[]>("/listings") });
  const { data: apps } = useQuery({ queryKey: ["applications"], queryFn: () => api.get<AppSummary[]>("/applications") });
  const open = (apps ?? []).filter((a) => ["submitted", "screening"].includes(a.status)).length;
  return (
    <>
      <PageHeader
        title={t("nav.vacancy")}
        subtitle={t("vacancy.subtitle")}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> {t("vacancy.new")}
          </button>
        }
      />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<Megaphone size={40} />} title={t("vacancy.empty_title")} action={<button className="btn btn-primary" onClick={() => setCreating(true)}>{t("vacancy.new")}</button>}>
            {t("vacancy.empty_body")}
          </Empty>
        </Card>
      ) : (
        <div className="stack">
          <div className="grid grid-3">
            <Stat label={t("vacancy.published")} value={data.filter((l) => l.status === "published").length} />
            <Stat label={t("vacancy.to_review")} value={open} />
            <Stat label={t("vacancy.views")} value={data.reduce((s, l) => s + l.views, 0)} />
          </div>
          <Card pad={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("vacancy.listing")}</th>
                    <th className="num">{t("common.rent")}</th>
                    <th>{t("common.status")}</th>
                    <th className="num">{t("vacancy.views")}</th>
                    <th>{t("vacancy.applications")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((l) => {
                    const total = Object.values(l.application_counts).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={l.id}>
                        <td>
                          <Link to={`/vacancy/${l.id}`} className="row-link">
                            {l.title}
                          </Link>
                          <div className="small muted">{l.available_on ? t("vacancy.available_from", { date: date(l.available_on) }) : l.address}</div>
                        </td>
                        <td className="num">{money(l.rent_cents)}</td>
                        <td>
                          <Badge tone={STATUS_TONE[l.status]}>{t(`vacancy.status_${l.status}`)}</Badge>
                        </td>
                        <td className="num">{l.views}</td>
                        <td className="small">{total ? t("vacancy.app_count", { count: total }) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {creating && <NewListingModal onClose={() => setCreating(false)} />}
    </>
  );
}

function ListingForm({ listing }: { listing: Listing }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const init = () => ({
    title: listing.title,
    description: listing.description ?? "",
    rent: fromCents(listing.rent_cents),
    deposit: fromCents(listing.deposit_cents),
    available_on: listing.available_on ?? "",
    lease_term_months: listing.lease_term_months ?? 12,
    beds: listing.beds ?? "",
    baths: listing.baths ?? "",
    sqft: listing.sqft ?? "",
    amenities: listing.amenities.join(", "),
    pet_policy: listing.pet_policy ?? "",
    utilities_included: listing.utilities_included ?? "",
    requirements: listing.requirements ?? "",
    fee: listing.application_fee_cents ? fromCents(listing.application_fee_cents) : "",
    screening_url: listing.screening_url ?? "",
    contact_email: listing.contact_email ?? "",
    contact_phone: listing.contact_phone ?? "",
  });
  const [f, setF] = useState(init);
  const [dirty, setDirty] = useState(false);
  const set = (patch: Partial<ReturnType<typeof init>>) => {
    setF({ ...f, ...patch });
    setDirty(true);
  };
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/listings/${listing.id}`, {
        title: f.title,
        description: f.description || null,
        rent_cents: toCents(f.rent),
        deposit_cents: toCents(f.deposit) ?? 0,
        available_on: f.available_on || null,
        lease_term_months: Number(f.lease_term_months) || null,
        beds: f.beds === "" ? null : Number(f.beds),
        baths: f.baths === "" ? null : Number(f.baths),
        sqft: f.sqft === "" ? null : Number(f.sqft),
        amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        pet_policy: f.pet_policy || null,
        utilities_included: f.utilities_included || null,
        requirements: f.requirements || null,
        application_fee_cents: f.fee ? toCents(f.fee) : 0,
        screening_url: f.screening_url || null,
        contact_email: f.contact_email || null,
        contact_phone: f.contact_phone || null,
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["listing", listing.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
  return (
    <Card title={t("vacancy.details")}>
      <div className="form">
        <ErrorBox error={save.error} />
        <Field label={t("vacancy.title")}>
          <Input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} />
        </Field>
        <Field label={t("common.description")} hint={t("vacancy.description_hint")}>
          <Textarea rows={6} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={10000} />
        </Field>
        <div className="form-row-3">
          <Field label={t("common.rent")}>
            <MoneyInput value={f.rent} onChange={(rent) => set({ rent })} />
          </Field>
          <Field label={t("leases.deposit")}>
            <MoneyInput value={f.deposit} onChange={(deposit) => set({ deposit })} />
          </Field>
          <Field label={t("vacancy.available_on")}>
            <Input type="date" value={f.available_on} onChange={(e) => set({ available_on: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("units.beds")}>
            <Input type="number" step="0.5" min={0} value={f.beds} onChange={(e) => set({ beds: e.target.value })} />
          </Field>
          <Field label={t("units.baths")}>
            <Input type="number" step="0.5" min={0} value={f.baths} onChange={(e) => set({ baths: e.target.value })} />
          </Field>
          <Field label={t("units.sqft")}>
            <Input type="number" min={0} value={f.sqft} onChange={(e) => set({ sqft: e.target.value })} />
          </Field>
        </div>
        <Field label={t("vacancy.amenities")} hint={t("vacancy.amenities_hint")}>
          <Input value={f.amenities} onChange={(e) => set({ amenities: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t("vacancy.pet_policy")}>
            <Input value={f.pet_policy} onChange={(e) => set({ pet_policy: e.target.value })} placeholder={t("vacancy.pet_placeholder")} maxLength={300} />
          </Field>
          <Field label={t("vacancy.utilities")}>
            <Input value={f.utilities_included} onChange={(e) => set({ utilities_included: e.target.value })} placeholder={t("vacancy.utilities_placeholder")} maxLength={300} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("vacancy.lease_term")}>
            <Input type="number" min={1} max={60} value={f.lease_term_months} onChange={(e) => set({ lease_term_months: Number(e.target.value) })} />
          </Field>
          <Field label={t("vacancy.app_fee")} hint={t("vacancy.app_fee_hint")}>
            <MoneyInput value={f.fee} onChange={(fee) => set({ fee })} />
          </Field>
        </div>
        <Field label={t("vacancy.requirements")} hint={t("vacancy.requirements_hint")}>
          <Textarea rows={3} value={f.requirements} onChange={(e) => set({ requirements: e.target.value })} maxLength={2000} />
        </Field>
        <Field label={t("vacancy.screening_url")} hint={t("vacancy.screening_url_hint")}>
          <Input type="url" value={f.screening_url} onChange={(e) => set({ screening_url: e.target.value })} placeholder="https://www.mysmartmove.com/" />
        </Field>
        <div className="form-row">
          <Field label={t("vacancy.contact_email")}>
            <Input type="email" value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} />
          </Field>
          <Field label={t("vacancy.contact_phone")}>
            <Input type="tel" value={f.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} />
          </Field>
        </div>
        <p className="small muted">{t("vacancy.fair_housing_tip")}</p>
        <div className="actions">
          <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </button>
          {dirty && <span className="small muted">{t("inspections.unsaved")}</span>}
        </div>
      </div>
    </Card>
  );
}

export function ApplicantsTable({ apps }: { apps: AppSummary[] }) {
  const { t } = useTranslation();
  if (!apps.length) return <p className="muted small">{t("vacancy.no_applications")}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t("vacancy.applicant")}</th>
            <th>{t("common.status")}</th>
            <th className="num">{t("vacancy.income_ratio")}</th>
            <th className="num">{t("vacancy.credit")}</th>
            <th>{t("vacancy.background")}</th>
            <th>{t("vacancy.household")}</th>
            <th>{t("vacancy.rating")}</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className={["declined", "withdrawn"].includes(a.status) ? "voided" : ""}>
              <td>
                <Link to={`/vacancy/applications/${a.id}`} className="row-link">
                  {a.name}
                </Link>
                <div className="small muted">
                  {date(a.created_at)}
                  {a.desired_move_in ? ` · ${t("vacancy.move_in", { date: date(a.desired_move_in) })}` : ""}
                </div>
              </td>
              <td>
                <Badge tone={APP_TONE[a.status]}>{t(`vacancy.app_${a.status}`)}</Badge>
              </td>
              <td className={`num${a.income_to_rent != null && a.income_to_rent < 3 ? " danger-text" : ""}`}>{a.income_to_rent != null ? `${a.income_to_rent}×` : "—"}</td>
              <td className="num">{a.credit_score ?? "—"}</td>
              <td className="small">
                {a.screening_status !== "completed" ? (
                  <span className="muted">{t(`vacancy.screening_${a.screening_status}`)}</span>
                ) : (
                  <>
                    <span className={a.criminal_count ? "danger-text" : ""}>{t("vacancy.criminal_n", { count: a.criminal_count })}</span>
                    {" · "}
                    <span className={a.eviction_count ? "danger-text" : ""}>{t("vacancy.eviction_n", { count: a.eviction_count })}</span>
                  </>
                )}
                {a.prior_eviction && <div className="danger-text">{t("vacancy.self_reported_eviction")}</div>}
              </td>
              <td className="small">
                {t("vacancy.people", { count: a.occupants })}
                {a.pets ? ` · ${t("vacancy.has_pets")}` : ""}
              </td>
              <td>{a.rating ? <Stars value={a.rating} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListingManagePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: l, error, isLoading } = useQuery({ queryKey: ["listing", id], queryFn: () => api.get<Listing>(`/listings/${id}`) });
  const { data: apps } = useQuery({ queryKey: ["applications", id], queryFn: () => api.get<AppSummary[]>(`/applications?listing_id=${id}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["listing", id] });
    qc.invalidateQueries({ queryKey: ["listings"] });
  };
  const publish = useMutation({ mutationFn: () => api.post(`/listings/${id}/publish`), onSuccess: refresh });
  const close = useMutation({ mutationFn: () => api.post(`/listings/${id}/close`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.del(`/listings/${id}`), onSuccess: () => navigate("/vacancy") });
  if (isLoading) return <Spinner />;
  if (error || !l) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/vacancy">{t("nav.vacancy")}</Link>}
        title={
          <>
            {l.title} <Badge tone={STATUS_TONE[l.status]}>{t(`vacancy.status_${l.status}`)}</Badge>
          </>
        }
        subtitle={`${l.property_name} · ${l.unit_name} · ${t("vacancy.views_n", { count: l.views })}`}
        actions={
          <>
            {l.status === "published" && (
              <a className="btn" href={`/listings/${l.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> {t("vacancy.view_public")}
              </a>
            )}
            {l.status !== "published" ? (
              <button className="btn btn-primary" onClick={() => publish.mutate()} disabled={publish.isPending}>
                <Megaphone size={15} /> {t("vacancy.publish")}
              </button>
            ) : (
              <button className="btn" onClick={() => close.mutate()} disabled={close.isPending}>
                {t("vacancy.close")}
              </button>
            )}
            {l.status === "draft" && !apps?.length && (
              <button className="btn btn-ghost" onClick={() => window.confirm(t("vacancy.delete_confirm")) && remove.mutate()} aria-label={t("common.delete")}>
                <Trash2 size={15} />
              </button>
            )}
          </>
        }
      />
      <div className="stack">
        <ErrorBox error={publish.error || close.error || remove.error} />
        {l.status === "published" && <VacancyKit listing={l} />}
        <Card title={t("vacancy.applicants", { count: apps?.length ?? 0 })} pad={!apps?.length}>
          <ApplicantsTable apps={apps ?? []} />
        </Card>
        <div className="two-col">
          <ListingForm key={l.id + l.status} listing={l} />
          <Card title={t("properties.photos")}>
            <p className="small muted" style={{ marginBottom: 10 }}>
              {t("vacancy.photos_hint")}
            </p>
            <PhotoGrid ownerType="listing" ownerId={l.id} canUpload />
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Application detail & screening report ────────────────────────────────────

interface CreditSummary {
  total_debt_cents?: number;
  open_accounts?: number;
  late_payments?: number;
  collections_count?: number;
  collections_cents?: number;
  bankruptcies?: number;
  notes?: string;
}
interface CriminalRecord {
  offense: string;
  severity: "felony" | "misdemeanor" | "infraction" | "other";
  offense_date: string | null;
  jurisdiction: string | null;
  disposition: string | null;
}
interface EvictionRecord {
  filed_on: string | null;
  court: string | null;
  plaintiff: string | null;
  outcome: "judgment" | "dismissed" | "settled" | "pending" | "unknown";
  amount_cents: number | null;
}
interface ApplicationDetail extends AppSummary {
  first_name: string;
  last_name: string;
  current_address: string | null;
  current_rent_cents: number | null;
  current_landlord_name: string | null;
  current_landlord_phone: string | null;
  years_at_address: number | null;
  employer: string | null;
  job_title: string | null;
  co_applicants_list?: never;
  vehicles: string | null;
  message: string | null;
  signature_name: string;
  consent_at: string;
  fee_cents: number;
  screening_provider: string | null;
  screening_report_date: string | null;
  credit_summary: CreditSummary;
  criminal_records: CriminalRecord[];
  eviction_records: EvictionRecord[];
  screening_document_id: string | null;
  screening_notes: string | null;
  staff_notes: string | null;
  adverse_action_sent_at: string | null;
  lease_id: string | null;
  listing: { id: string; title: string; rent_cents: number; deposit_cents: number; screening_url: string | null; requirements: string | null; available_on: string | null; lease_term_months: number | null };
  documents: { id: string; name: string; content_type: string; created_at: string }[];
  co_applicants_detail?: never;
}

function creditBand(score: number | null) {
  if (score == null) return { tone: "", key: "none" };
  if (score >= 740) return { tone: "jade", key: "excellent" };
  if (score >= 670) return { tone: "jade", key: "good" };
  if (score >= 580) return { tone: "citrine", key: "fair" };
  return { tone: "garnet", key: "poor" };
}

function ScreeningReport({ app, onEdit, canEdit }: { app: ApplicationDetail; onEdit: () => void; canEdit: boolean }) {
  const { t } = useTranslation();
  const band = creditBand(app.credit_score);
  const cs = app.credit_summary ?? {};
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <ShieldAlert size={16} /> {t("screening.title")}
        </span>
      }
      actions={
        canEdit && (
          <button className="btn btn-sm" onClick={onEdit}>
            {app.screening_status === "completed" ? t("common.edit") : t("screening.enter")}
          </button>
        )
      }
    >
      {app.screening_status !== "completed" ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="muted small">{app.screening_status === "requested" ? t("screening.waiting") : t("screening.not_started")}</p>
          <p className="small muted">{t("screening.how")}</p>
        </div>
      ) : (
        <div className="stack">
          <div className="small muted">
            {[app.screening_provider, app.screening_report_date && date(app.screening_report_date)].filter(Boolean).join(" · ")}
            {app.screening_result && (
              <>
                {" · "}
                <Badge tone={app.screening_result === "pass" ? "jade" : app.screening_result === "review" ? "citrine" : "garnet"}>{t(`screening.result_${app.screening_result}`)}</Badge>
              </>
            )}
          </div>
          <section className="screen-section">
            <h4>
              <Scale size={14} /> {t("screening.credit")}
            </h4>
            <div className="screen-credit">
              <div>
                <div className="credit-score">{app.credit_score ?? "—"}</div>
                {app.credit_score != null && <Badge tone={band.tone}>{t(`screening.band_${band.key}`)}</Badge>}
              </div>
              <dl className="dl small">
                <dt>{t("screening.total_debt")}</dt>
                <dd>{cs.total_debt_cents != null ? money(cs.total_debt_cents) : "—"}</dd>
                <dt>{t("screening.open_accounts")}</dt>
                <dd>{cs.open_accounts ?? "—"}</dd>
                <dt>{t("screening.late_payments")}</dt>
                <dd>{cs.late_payments ?? "—"}</dd>
                <dt>{t("screening.collections")}</dt>
                <dd className={cs.collections_count ? "danger-text" : ""}>{cs.collections_count != null ? `${cs.collections_count}${cs.collections_cents ? ` · ${money(cs.collections_cents)}` : ""}` : "—"}</dd>
                <dt>{t("screening.bankruptcies")}</dt>
                <dd className={cs.bankruptcies ? "danger-text" : ""}>{cs.bankruptcies ?? "—"}</dd>
              </dl>
            </div>
            {cs.notes && <p className="small">{cs.notes}</p>}
          </section>
          <section className="screen-section">
            <h4>
              <Gavel size={14} /> {t("screening.criminal")} <Badge tone={app.criminal_records.length ? "garnet" : "jade"}>{t("screening.records", { count: app.criminal_records.length })}</Badge>
            </h4>
            {app.criminal_records.length ? (
              <ul className="list-plain">
                {app.criminal_records.map((r, i) => (
                  <li key={i} style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong className="small">{r.offense}</strong> <Badge tone={r.severity === "felony" ? "garnet" : "citrine"}>{t(`screening.sev_${r.severity}`)}</Badge>
                      <div className="small muted">{[r.jurisdiction, r.disposition].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="small nowrap">{date(r.offense_date) || "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{t("screening.no_criminal")}</p>
            )}
          </section>
          <section className="screen-section">
            <h4>
              <AlertTriangle size={14} /> {t("screening.evictions")} <Badge tone={app.eviction_records.length ? "garnet" : "jade"}>{t("screening.records", { count: app.eviction_records.length })}</Badge>
            </h4>
            {app.eviction_records.length ? (
              <ul className="list-plain">
                {app.eviction_records.map((r, i) => (
                  <li key={i} style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong className="small">{t(`screening.outcome_${r.outcome}`)}</strong>
                      {r.amount_cents ? <span className="small"> · {money(r.amount_cents)}</span> : null}
                      <div className="small muted">{[r.court, r.plaintiff].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="small nowrap">{date(r.filed_on) || "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{t("screening.no_evictions")}</p>
            )}
          </section>
          {app.screening_notes && <p className="small" style={{ whiteSpace: "pre-wrap" }}>{app.screening_notes}</p>}
          {app.screening_document_id && (
            <a className="btn btn-sm" style={{ justifySelf: "start" }} href={fileUrl(`/applications/${app.id}/documents/${app.screening_document_id}`)} target="_blank" rel="noreferrer">
              <FileText size={13} /> {t("screening.full_report")}
            </a>
          )}
          <p className="small muted">{t("screening.fair_use")}</p>
        </div>
      )}
    </Card>
  );
}

const emptyCrim = (): CriminalRecord => ({ offense: "", severity: "misdemeanor", offense_date: null, jurisdiction: null, disposition: null });
const emptyEvic = (): EvictionRecord => ({ filed_on: null, court: null, plaintiff: null, outcome: "judgment", amount_cents: null });

function ScreeningModal({ app, onClose }: { app: ApplicationDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cs = app.credit_summary ?? {};
  const [f, setF] = useState({
    provider: app.screening_provider ?? "",
    report_date: app.screening_report_date ?? todayISO(),
    credit_score: app.credit_score?.toString() ?? "",
    total_debt: cs.total_debt_cents != null ? fromCents(cs.total_debt_cents) : "",
    open_accounts: cs.open_accounts?.toString() ?? "",
    late_payments: cs.late_payments?.toString() ?? "",
    collections_count: cs.collections_count?.toString() ?? "",
    collections: cs.collections_cents != null ? fromCents(cs.collections_cents) : "",
    bankruptcies: cs.bankruptcies?.toString() ?? "",
    credit_notes: cs.notes ?? "",
    criminal: app.criminal_records.length ? app.criminal_records : [],
    evictions: app.eviction_records.length ? app.eviction_records : [],
    result: app.screening_result ?? "",
    notes: app.screening_notes ?? "",
    document_id: app.screening_document_id ?? "",
  });
  const num = (v: string) => (v === "" ? null : Number(v));
  const uploadReport = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<{ id: string }>(`/applications/${app.id}/report-file`, form);
    },
    onSuccess: (r) => setF((x) => ({ ...x, document_id: r.id })),
  });
  const save = useMutation({
    mutationFn: () =>
      api.put(`/applications/${app.id}/screening`, {
        provider: f.provider || null,
        report_date: f.report_date || null,
        credit_score: num(f.credit_score),
        credit_summary: {
          total_debt_cents: f.total_debt ? toCents(f.total_debt) : null,
          open_accounts: num(f.open_accounts),
          late_payments: num(f.late_payments),
          collections_count: num(f.collections_count),
          collections_cents: f.collections ? toCents(f.collections) : null,
          bankruptcies: num(f.bankruptcies),
          notes: f.credit_notes || null,
        },
        criminal_records: f.criminal.filter((r) => r.offense.trim()),
        eviction_records: f.evictions,
        document_id: f.document_id || null,
        result: f.result || null,
        notes: f.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", app.id] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      onClose();
    },
  });
  const setCrim = (i: number, patch: Partial<CriminalRecord>) => setF({ ...f, criminal: f.criminal.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setEvic = (i: number, patch: Partial<EvictionRecord>) => setF({ ...f, evictions: f.evictions.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <Modal
      title={t("screening.enter_title", { name: app.name })}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error || uploadReport.error} />
        <p className="small muted">{t("screening.enter_intro")}</p>
        <div className="form-row-3">
          <Field label={t("screening.provider")}>
            <Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="TransUnion SmartMove" />
          </Field>
          <Field label={t("screening.report_date")}>
            <Input type="date" value={f.report_date} onChange={(e) => setF({ ...f, report_date: e.target.value })} />
          </Field>
          <Field label={t("screening.report_file")}>
            {f.document_id ? (
              <span className="small">
                <Check size={13} /> {t("screening.attached")}{" "}
                <button type="button" className="link-btn small" onClick={() => setF({ ...f, document_id: "" })}>
                  {t("common.remove")}
                </button>
              </span>
            ) : (
              <input type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadReport.mutate(e.target.files[0])} aria-label={t("screening.report_file")} />
            )}
          </Field>
        </div>
        <h3 className="form-section">
          <Scale size={14} /> {t("screening.credit")}
        </h3>
        <div className="form-row-3">
          <Field label={t("screening.score")} hint="300–850">
            <Input type="number" min={300} max={850} value={f.credit_score} onChange={(e) => setF({ ...f, credit_score: e.target.value })} />
          </Field>
          <Field label={t("screening.total_debt")}>
            <MoneyInput value={f.total_debt} onChange={(total_debt) => setF({ ...f, total_debt })} />
          </Field>
          <Field label={t("screening.open_accounts")}>
            <Input type="number" min={0} value={f.open_accounts} onChange={(e) => setF({ ...f, open_accounts: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("screening.late_payments")}>
            <Input type="number" min={0} value={f.late_payments} onChange={(e) => setF({ ...f, late_payments: e.target.value })} />
          </Field>
          <Field label={t("screening.collections_count")}>
            <Input type="number" min={0} value={f.collections_count} onChange={(e) => setF({ ...f, collections_count: e.target.value })} />
          </Field>
          <Field label={t("screening.collections_amount")}>
            <MoneyInput value={f.collections} onChange={(collections) => setF({ ...f, collections })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("screening.bankruptcies")}>
            <Input type="number" min={0} value={f.bankruptcies} onChange={(e) => setF({ ...f, bankruptcies: e.target.value })} />
          </Field>
          <Field label={t("screening.credit_notes")}>
            <Input value={f.credit_notes} onChange={(e) => setF({ ...f, credit_notes: e.target.value })} />
          </Field>
        </div>
        <h3 className="form-section">
          <Gavel size={14} /> {t("screening.criminal")}
        </h3>
        {f.criminal.map((r, i) => (
          <div key={i} className="record-row">
            <Input value={r.offense} placeholder={t("screening.offense")} onChange={(e) => setCrim(i, { offense: e.target.value })} aria-label={t("screening.offense")} />
            <Select value={r.severity} onChange={(e) => setCrim(i, { severity: e.target.value as CriminalRecord["severity"] })} options={["felony", "misdemeanor", "infraction", "other"].map((s) => ({ value: s, label: t(`screening.sev_${s}`) }))} aria-label={t("screening.severity")} />
            <Input type="date" value={r.offense_date ?? ""} onChange={(e) => setCrim(i, { offense_date: e.target.value || null })} aria-label={t("common.date")} />
            <Input value={r.jurisdiction ?? ""} placeholder={t("screening.jurisdiction")} onChange={(e) => setCrim(i, { jurisdiction: e.target.value || null })} aria-label={t("screening.jurisdiction")} />
            <Input value={r.disposition ?? ""} placeholder={t("screening.disposition")} onChange={(e) => setCrim(i, { disposition: e.target.value || null })} aria-label={t("screening.disposition")} />
            <button type="button" className="icon-btn" onClick={() => setF({ ...f, criminal: f.criminal.filter((_, j) => j !== i) })} aria-label={t("common.remove")}>
              <X size={14} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, criminal: [...f.criminal, emptyCrim()] })}>
            <Plus size={13} /> {t("screening.add_criminal")}
          </button>
        </div>
        <h3 className="form-section">
          <AlertTriangle size={14} /> {t("screening.evictions")}
        </h3>
        {f.evictions.map((r, i) => (
          <div key={i} className="record-row">
            <Input type="date" value={r.filed_on ?? ""} onChange={(e) => setEvic(i, { filed_on: e.target.value || null })} aria-label={t("screening.filed_on")} />
            <Input value={r.court ?? ""} placeholder={t("screening.court")} onChange={(e) => setEvic(i, { court: e.target.value || null })} aria-label={t("screening.court")} />
            <Input value={r.plaintiff ?? ""} placeholder={t("screening.plaintiff")} onChange={(e) => setEvic(i, { plaintiff: e.target.value || null })} aria-label={t("screening.plaintiff")} />
            <Select value={r.outcome} onChange={(e) => setEvic(i, { outcome: e.target.value as EvictionRecord["outcome"] })} options={["judgment", "dismissed", "settled", "pending", "unknown"].map((s) => ({ value: s, label: t(`screening.outcome_${s}`) }))} aria-label={t("screening.outcome")} />
            <MoneyInput value={r.amount_cents != null ? fromCents(r.amount_cents) : ""} onChange={(v) => setEvic(i, { amount_cents: v ? toCents(v) : null })} aria-label={t("common.amount")} />
            <button type="button" className="icon-btn" onClick={() => setF({ ...f, evictions: f.evictions.filter((_, j) => j !== i) })} aria-label={t("common.remove")}>
              <X size={14} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, evictions: [...f.evictions, emptyEvic()] })}>
            <Plus size={13} /> {t("screening.add_eviction")}
          </button>
        </div>
        <h3 className="form-section">{t("screening.assessment")}</h3>
        <div className="form-row">
          <Field label={t("screening.result")}>
            <Select value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} options={[{ value: "", label: "—" }, ...["pass", "review", "fail"].map((s) => ({ value: s, label: t(`screening.result_${s}`) }))]} />
          </Field>
          <Field label={t("common.notes")}>
            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function AdverseActionModal({ app, onClose }: { app: ApplicationDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const preset = ["reason_credit", "reason_eviction", "reason_criminal", "reason_income", "reason_collections"];
  const [reasons, setReasons] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [f, setF] = useState({ agency_name: app.screening_provider ?? "", agency_address: "", agency_phone: "", credit_score_used: app.credit_score != null });
  const send = useMutation({
    mutationFn: () => api.post(`/applications/${app.id}/adverse-action`, { ...f, reasons: [...reasons.map((r) => t(`screening.${r}`)), ...(other ? [other] : [])] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application", app.id] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("screening.aa_title")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={(!reasons.length && !other) || !f.agency_name || !f.agency_address || !f.agency_phone || send.isPending} onClick={() => send.mutate()}>
            <Send size={14} /> {t("screening.aa_send")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={send.error} />
        <p className="small muted">{t("screening.aa_intro")}</p>
        <div className="field">
          <span>{t("screening.aa_reasons")}</span>
          {preset.map((r) => (
            <label key={r} className="check small">
              <input type="checkbox" checked={reasons.includes(r)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r] : reasons.filter((x) => x !== r))} /> {t(`screening.${r}`)}
            </label>
          ))}
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("screening.aa_other")} />
        </div>
        <Field label={t("screening.aa_agency")}>
          <Input value={f.agency_name} onChange={(e) => setF({ ...f, agency_name: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t("screening.aa_address")}>
            <Input value={f.agency_address} onChange={(e) => setF({ ...f, agency_address: e.target.value })} />
          </Field>
          <Field label={t("screening.aa_phone")}>
            <Input value={f.agency_phone} onChange={(e) => setF({ ...f, agency_phone: e.target.value })} />
          </Field>
        </div>
        <p className="small muted">{t("screening.aa_agency_hint")}</p>
        {app.credit_score != null && (
          <label className="check small">
            <input type="checkbox" checked={f.credit_score_used} onChange={(e) => setF({ ...f, credit_score_used: e.target.checked })} /> {t("screening.aa_score_used")}
          </label>
        )}
      </div>
    </Modal>
  );
}

function ConvertModal({ app, onClose }: { app: ApplicationDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = app.desired_move_in ?? app.listing.available_on ?? todayISO();
  const endFrom = (s: string) => {
    const d = new Date(`${s}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + (app.listing.lease_term_months ?? 12));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const [f, setF] = useState({ start_date: start, end_date: endFrom(start), rent: fromCents(app.listing.rent_cents), deposit: fromCents(app.listing.deposit_cents), due_day: 1, invite: true, include_co: true });
  const [result, setResult] = useState<{ lease_id: string; invites: { name: string; email: string; url: string; email_sent: boolean }[] } | null>(null);
  const convert = useMutation({
    mutationFn: () =>
      api.post<{ lease_id: string; invites: { name: string; email: string; url: string; email_sent: boolean }[] }>(`/applications/${app.id}/convert`, {
        start_date: f.start_date,
        end_date: f.end_date || null,
        rent_cents: toCents(f.rent),
        deposit_cents: toCents(f.deposit) ?? 0,
        due_day: f.due_day,
        include_co_applicants: f.include_co,
        invite_to_portal: f.invite,
        close_listing: true,
      }),
    onSuccess: setResult,
  });
  if (result)
    return (
      <Modal
        title={t("vacancy.converted_title")}
        onClose={() => navigate(`/leases/${result.lease_id}`)}
        footer={
          <button className="btn btn-primary" onClick={() => navigate(`/leases/${result.lease_id}`)}>
            {t("vacancy.open_lease")}
          </button>
        }
      >
        <div className="stack">
          <div className="success-box">{t("vacancy.converted_body")}</div>
          {result.invites.map((i) => (
            <div key={i.email}>
              <strong className="small">{i.name}</strong>
              <InviteLink url={i.url} emailSent={i.email_sent} email={i.email} />
            </div>
          ))}
        </div>
      </Modal>
    );
  return (
    <Modal
      title={t("vacancy.convert_title", { name: app.name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!toCents(f.rent) || convert.isPending} onClick={() => convert.mutate()}>
            <UserCheck size={14} /> {t("vacancy.create_lease")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={convert.error} />
        <div className="form-row">
          <Field label={t("leases.start_date")}>
            <Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value, end_date: endFrom(e.target.value) })} />
          </Field>
          <Field label={t("leases.end_date")}>
            <Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("common.rent")}>
            <MoneyInput value={f.rent} onChange={(rent) => setF({ ...f, rent })} />
          </Field>
          <Field label={t("leases.deposit")}>
            <MoneyInput value={f.deposit} onChange={(deposit) => setF({ ...f, deposit })} />
          </Field>
          <Field label={t("leases.due_day")}>
            <Input type="number" min={1} max={28} value={f.due_day} onChange={(e) => setF({ ...f, due_day: Number(e.target.value) })} />
          </Field>
        </div>
        {app.co_applicants > 0 && (
          <label className="check small">
            <input type="checkbox" checked={f.include_co} onChange={(e) => setF({ ...f, include_co: e.target.checked })} /> {t("vacancy.include_co")}
          </label>
        )}
        <label className="check small">
          <input type="checkbox" checked={f.invite} onChange={(e) => setF({ ...f, invite: e.target.checked })} /> {t("vacancy.invite_portal")}
        </label>
        <p className="small muted">{t("vacancy.convert_note")}</p>
      </div>
    </Modal>
  );
}

export function ApplicationPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [modal, setModal] = useState<"screening" | "adverse" | "convert" | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const { data: a, error, isLoading } = useQuery({ queryKey: ["application", id], queryFn: () => api.get<ApplicationDetail>(`/applications/${id}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["application", id] });
    qc.invalidateQueries({ queryKey: ["applications"] });
  };
  const patch = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch(`/applications/${id}`, body), onSuccess: () => { setNotes(null); refresh(); } });
  const screen = useMutation({ mutationFn: () => api.post<{ email_sent: boolean }>(`/applications/${id}/request-screening`), onSuccess: refresh });
  const approve = useMutation({ mutationFn: () => api.post(`/applications/${id}/approve`, {}), onSuccess: refresh });
  const decline = useMutation({ mutationFn: () => api.post(`/applications/${id}/decline`, {}), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.del(`/applications/${id}`), onSuccess: () => navigate("/vacancy") });
  if (isLoading) return <Spinner />;
  if (error || !a) return <ErrorBox error={error} />;
  const open = ["submitted", "screening"].includes(a.status);
  const ratio = a.income_to_rent;
  return (
    <>
      <PageHeader
        breadcrumb={<Link to={`/vacancy/${a.listing.id}`}>{a.listing.title}</Link>}
        title={
          <>
            {a.name} <Badge tone={APP_TONE[a.status]}>{t(`vacancy.app_${a.status}`)}</Badge>
          </>
        }
        subtitle={t("vacancy.applied_on", { date: dateTime(a.created_at) })}
        actions={
          <>
            {open && (
              <button className="btn" onClick={() => screen.mutate()} disabled={screen.isPending || !a.listing.screening_url} title={a.listing.screening_url ? undefined : t("vacancy.screening_url_missing")}>
                <Search size={15} /> {a.screening_status === "requested" ? t("vacancy.resend_screening") : t("vacancy.request_screening")}
              </button>
            )}
            {(open || a.status === "declined") && (
              <button className="btn btn-primary" onClick={() => window.confirm(t("vacancy.approve_confirm")) && approve.mutate()} disabled={approve.isPending}>
                <Check size={15} /> {t("vacancy.approve")}
              </button>
            )}
            {a.status === "approved" && (
              <button className="btn btn-primary" onClick={() => setModal("convert")}>
                <UserCheck size={15} /> {t("vacancy.convert")}
              </button>
            )}
            {(open || a.status === "approved") && (
              <button className="btn" onClick={() => (a.screening_status === "completed" ? setModal("adverse") : window.confirm(t("vacancy.decline_confirm")) && decline.mutate())}>
                <X size={15} /> {t("vacancy.decline")}
              </button>
            )}
          </>
        }
      />
      <div className="stack">
        <ErrorBox error={patch.error || screen.error || approve.error || decline.error || remove.error} />
        {screen.data && <div className="success-box">{screen.data.email_sent ? t("vacancy.screening_emailed") : t("vacancy.screening_not_emailed")}</div>}
        {a.adverse_action_sent_at && <div className="info-box">{t("screening.aa_sent", { date: dateTime(a.adverse_action_sent_at) })}</div>}
        {a.lease_id && (
          <div className="success-box">
            {t("vacancy.converted_banner")} <Link to={`/leases/${a.lease_id}`}>{t("vacancy.open_lease")}</Link>
          </div>
        )}
        <div className="grid grid-4">
          <Stat label={t("vacancy.income")} value={a.monthly_income_cents ? money(a.monthly_income_cents) : "—"} sub={ratio != null ? t("vacancy.ratio_sub", { ratio }) : undefined} />
          <Stat label={t("vacancy.credit")} value={a.credit_score ?? "—"} sub={t(`vacancy.screening_${a.screening_status}`)} />
          <Stat label={t("vacancy.household")} value={t("vacancy.people", { count: a.occupants })} sub={a.co_applicants ? t("vacancy.co_n", { count: a.co_applicants }) : undefined} />
          <Stat label={t("listing.app_fee")} value={a.fee_cents ? money(a.fee_cents) : "—"} sub={a.fee_cents ? t(`apply.fee_${a.fee_status}`) : undefined} />
        </div>
        <div className="two-col">
          <div className="stack">
            <ScreeningReport app={a} onEdit={() => setModal("screening")} canEdit={a.status !== "converted"} />
            <Card title={t("vacancy.application")}>
              <dl className="dl small">
                <dt>{t("common.email")}</dt>
                <dd>
                  <a href={`mailto:${a.email}`}>{a.email}</a>
                </dd>
                <dt>{t("common.phone")}</dt>
                <dd>{a.phone ? <a href={`tel:${a.phone}`}>{a.phone}</a> : "—"}</dd>
                <dt>{t("apply.move_in")}</dt>
                <dd>{date(a.desired_move_in) || "—"}</dd>
                <dt>{t("apply.current_address")}</dt>
                <dd>
                  {a.current_address}
                  {a.years_at_address != null && <span className="muted"> · {t("vacancy.years", { count: a.years_at_address })}</span>}
                </dd>
                <dt>{t("apply.current_rent")}</dt>
                <dd>{a.current_rent_cents != null ? money(a.current_rent_cents) : "—"}</dd>
                <dt>{t("vacancy.current_landlord")}</dt>
                <dd>{[a.current_landlord_name, a.current_landlord_phone].filter(Boolean).join(" · ") || "—"}</dd>
                <dt>{t("apply.employer")}</dt>
                <dd>{[a.job_title, a.employer].filter(Boolean).join(", ") || "—"}</dd>
                <dt>{t("apply.pets")}</dt>
                <dd>{a.pets || "—"}</dd>
                <dt>{t("apply.vehicles")}</dt>
                <dd>{a.vehicles || "—"}</dd>
                <dt>{t("vacancy.prior_eviction")}</dt>
                <dd className={a.prior_eviction ? "danger-text" : ""}>{a.prior_eviction ? t("common.yes") : t("common.no")}</dd>
                <dt>{t("vacancy.signed")}</dt>
                <dd>
                  {a.signature_name} · {dateTime(a.consent_at)}
                </dd>
              </dl>
              {a.message && <p className="small" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{a.message}</p>}
            </Card>
          </div>
          <div className="stack">
            <Card title={t("vacancy.your_assessment")}>
              <div className="form">
                <div>
                  <div className="small muted">{t("vacancy.rating")}</div>
                  <Stars value={a.rating} onChange={(rating) => patch.mutate({ rating })} size={18} />
                </div>
                <Field label={t("vacancy.private_notes")}>
                  <Textarea rows={4} value={notes ?? a.staff_notes ?? ""} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
                </Field>
                {notes !== null && (
                  <button className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => patch.mutate({ staff_notes: notes })}>
                    {t("common.save")}
                  </button>
                )}
                {a.fee_cents > 0 && a.fee_status === "unpaid" && (
                  <div className="actions">
                    <button className="btn btn-sm" onClick={() => patch.mutate({ fee_status: "paid" })}>
                      {t("vacancy.fee_mark_paid")}
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => patch.mutate({ fee_status: "waived" })}>
                      {t("vacancy.fee_waive")}
                    </button>
                  </div>
                )}
              </div>
            </Card>
            <Card title={t("vacancy.applicant_files")}>
              {a.documents.length ? (
                <ul className="list-plain">
                  {a.documents.map((d) => (
                    <li key={d.id}>
                      <a href={fileUrl(`/applications/${a.id}/documents/${d.id}`)} target="_blank" rel="noreferrer" className="small">
                        <FileText size={13} /> {d.name}
                      </a>
                      <span className="small muted">{date(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">{t("vacancy.no_files")}</p>
              )}
            </Card>
            {a.listing.requirements && (
              <Card title={t("vacancy.requirements")}>
                <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {a.listing.requirements}
                </p>
              </Card>
            )}
            {a.status !== "converted" && (
              <button className="btn btn-ghost btn-danger" style={{ justifySelf: "start" }} onClick={() => window.confirm(t("vacancy.delete_app_confirm")) && remove.mutate()}>
                <Trash2 size={14} /> {t("vacancy.delete_app")}
              </button>
            )}
          </div>
        </div>
      </div>
      {modal === "screening" && <ScreeningModal app={a} onClose={() => setModal(null)} />}
      {modal === "adverse" && <AdverseActionModal app={a} onClose={() => setModal(null)} />}
      {modal === "convert" && <ConvertModal app={a} onClose={() => setModal(null)} />}
    </>
  );
}
