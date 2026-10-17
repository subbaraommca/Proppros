import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Plus, Trash2, UserPlus } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease, Tenant, Unit } from "../types";
import { Badge, BalanceText, Card, Empty, ErrorBox, Field, Input, MoneyInput, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { date, money, ordinal, toCents, todayISO } from "../utils/format";
import { TenantFormModal } from "./TenantsPage";

export function LeasesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [status, setStatus] = useState("active");
  const navigate = useNavigate();
  const { data, error, isLoading } = useQuery({
    queryKey: ["leases", status],
    queryFn: () => api.get<Lease[]>(`/leases${status ? `?status=${status}` : ""}`),
  });
  return (
    <>
      <PageHeader
        title={t("nav.leases")}
        actions={
          can("owner", "manager") && (
            <Link className="btn btn-primary" to="/leases/new">
              <Plus size={16} /> {t("leases.new")}
            </Link>
          )
        }
      />
      <div className="toolbar">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t("leases.filter_status")}
          options={[
            { value: "active", label: t("enums.active") },
            { value: "ended", label: t("enums.ended") },
            { value: "", label: t("leases.all") },
          ]}
        />
      </div>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<FileText size={40} />} title={status === "active" ? t("leases.empty_active") : t("leases.empty")}>
            {t("leases.empty_body")}
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("leases.property_unit")}</th>
                  <th>{t("common.tenants")}</th>
                  <th>{t("leases.term")}</th>
                  <th>{t("common.status")}</th>
                  <th className="num">{t("common.rent")}</th>
                  <th className="num">{t("common.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((l) => (
                  <tr key={l.id} onClick={() => navigate(`/leases/${l.id}`)} style={{ cursor: "pointer" }}>
                    <td>
                      <Link to={`/leases/${l.id}`} className="row-link">
                        {l.property_name} · {l.unit_name}
                      </Link>
                    </td>
                    <td>{l.tenants.map((tn) => tn.name).join(", ")}</td>
                    <td className="small nowrap">
                      {date(l.start_date)} – {l.ended_on ? date(l.ended_on) : l.end_date ? date(l.end_date) : t("common.month_to_month")}
                    </td>
                    <td>
                      <Badge value={l.status} />
                    </td>
                    <td className="num">{money(l.rent_cents)}</td>
                    <td className="num">
                      <BalanceText cents={l.balance_cents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

type ChargeDraft = { charge_type: string; description: string; amount: string };

export function LeaseNewPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get<Unit[]>("/units") });
  const { data: tenants, refetch: refetchTenants } = useQuery({ queryKey: ["tenants"], queryFn: () => api.get<Tenant[]>("/tenants") });
  const [addingTenant, setAddingTenant] = useState(false);
  const today = todayISO();
  const [f, setF] = useState({
    unit_id: params.get("unit") ?? "",
    tenant_ids: params.get("tenant") ? [params.get("tenant")!] : ([] as string[]),
    start_date: today,
    end_date: "",
    rent: "",
    due_day: "1",
    deposit: "",
    late_fee_type: "flat",
    late_fee: "",
    grace_days: "5",
    existing: false,
    opening_balance: "",
    notes: "",
  });
  const [charges, setCharges] = useState<ChargeDraft[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const unitOptions = useMemo(
    () => [
      { value: "", label: t("leases.select_unit") },
      ...(units ?? []).map((u) => ({ value: u.id, label: `${u.property_name} · ${u.name}${u.status === "occupied" ? t("leases.occupied_suffix") : ""}` })),
    ],
    [units, t],
  );
  const selectedUnit = units?.find((u) => u.id === f.unit_id);

  const create = useMutation({
    mutationFn: () => {
      const lateAmount = f.late_fee_type === "percent" ? Math.round(Number(f.late_fee || 0) * 100) : toCents(f.late_fee) ?? 0;
      return api.post<Lease>("/leases", {
        unit_id: f.unit_id,
        tenant_ids: f.tenant_ids,
        start_date: f.start_date,
        end_date: f.end_date || null,
        rent_cents: toCents(f.rent),
        due_day: Number(f.due_day),
        deposit_cents: toCents(f.deposit) ?? 0,
        late_fee_type: lateAmount ? f.late_fee_type : "none",
        late_fee_amount: lateAmount,
        grace_days: Number(f.grace_days || 0),
        // Existing lease: start automatic charges from the next due date; prior balance goes in as an opening balance.
        charges_start_on: f.existing ? today : f.start_date,
        opening_balance_cents: f.existing ? toCents(f.opening_balance) ?? 0 : 0,
        recurring_charges: charges
          .filter((c) => c.description && toCents(c.amount))
          .map((c) => ({ charge_type: c.charge_type, description: c.description, amount_cents: toCents(c.amount) })),
        notes: f.notes || null,
      });
    },
    onSuccess: (lease) => navigate(`/leases/${lease.id}`),
  });

  const toggleTenant = (id: string) => setF({ ...f, tenant_ids: f.tenant_ids.includes(id) ? f.tenant_ids.filter((x) => x !== id) : [...f.tenant_ids, id] });
  const valid = f.unit_id && f.tenant_ids.length > 0 && f.start_date && toCents(f.rent);
  const isPast = f.start_date < today;
  const dueDayOptions = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: t("leases.due_day_option", { day: ordinal(i + 1) }) }));

  return (
    <>
      <PageHeader breadcrumb={<Link to="/leases">{t("nav.leases")}</Link>} title={t("leases.new")} />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={create.error} />
          <Card title={t("leases.unit_and_tenants")}>
            <div className="form">
              <Field label={t("common.unit")}>
                <Select value={f.unit_id} onChange={set("unit_id")} options={unitOptions} />
              </Field>
              {selectedUnit?.market_rent_cents && !f.rent && (
                <p className="small muted">
                  {t("leases.market_rent_hint", { amount: money(selectedUnit.market_rent_cents) })}{" "}
                  <button className="link-btn" onClick={() => setF({ ...f, rent: (selectedUnit.market_rent_cents! / 100).toFixed(2) })}>
                    {t("leases.use_it")}
                  </button>
                </p>
              )}
              <div className="field">
                <span>{t("leases.tenants_on_lease")}</span>
                <div className="stack" style={{ gap: 6 }}>
                  {tenants?.map((tn) => (
                    <label key={tn.id} className="check">
                      <input type="checkbox" checked={f.tenant_ids.includes(tn.id)} onChange={() => toggleTenant(tn.id)} />
                      {tn.first_name} {tn.last_name} {tn.email && <span className="muted small">· {tn.email}</span>}
                    </label>
                  ))}
                  {tenants?.length === 0 && <p className="muted small">{t("tenants.empty_title")}.</p>}
                </div>
                <div>
                  <button className="btn btn-sm" type="button" onClick={() => setAddingTenant(true)}>
                    <UserPlus size={14} /> {t("leases.new_tenant")}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={t("leases.terms")}>
            <div className="form">
              <div className="form-row">
                <Field label={t("leases.start_date")}>
                  <Input type="date" value={f.start_date} onChange={set("start_date")} />
                </Field>
                <Field label={t("leases.end_date")} hint={t("leases.end_date_hint")}>
                  <Input type="date" value={f.end_date} onChange={set("end_date")} />
                </Field>
              </div>
              <div className="form-row-3">
                <Field label={t("leases.monthly_rent")}>
                  <MoneyInput value={f.rent} onChange={(v) => setF({ ...f, rent: v })} />
                </Field>
                <Field label={t("leases.due_day")}>
                  <Select value={f.due_day} onChange={set("due_day")} options={dueDayOptions} />
                </Field>
                <Field label={t("leases.deposit")}>
                  <MoneyInput value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
                </Field>
              </div>
              <div className="form-row-3">
                <Field label={t("leases.late_fee")}>
                  <Select
                    value={f.late_fee_type}
                    onChange={set("late_fee_type")}
                    options={[
                      { value: "flat", label: t("enums.flat") },
                      { value: "percent", label: t("enums.percent") },
                    ]}
                  />
                </Field>
                <Field label={f.late_fee_type === "percent" ? t("leases.percent") : t("common.amount")} hint={t("leases.late_fee_blank")}>
                  {f.late_fee_type === "percent" ? (
                    <Input type="number" min={0} max={100} step="0.5" value={f.late_fee} onChange={set("late_fee")} placeholder="5" />
                  ) : (
                    <MoneyInput value={f.late_fee} onChange={(v) => setF({ ...f, late_fee: v })} />
                  )}
                </Field>
                <Field label={t("leases.grace_days")}>
                  <Input type="number" min={0} max={27} value={f.grace_days} onChange={set("grace_days")} />
                </Field>
              </div>
            </div>
          </Card>

          <Card
            title={t("leases.recurring_charges")}
            actions={
              <button className="btn btn-sm" onClick={() => setCharges([...charges, { charge_type: "parking", description: "", amount: "" }])}>
                <Plus size={14} /> {t("leases.add_charge")}
              </button>
            }
          >
            {charges.length === 0 ? (
              <p className="muted small">{t("leases.recurring_hint")}</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {charges.map((c, i) => (
                  <div key={i} className="form-row-3" style={{ alignItems: "end" }}>
                    <Select
                      value={c.charge_type}
                      onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, charge_type: e.target.value } : x)))}
                      options={["parking", "pet", "utility", "storage", "other"]}
                      aria-label={t("leases.charge_type")}
                    />
                    <Input
                      placeholder={t("common.description")}
                      value={c.description}
                      onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <MoneyInput value={c.amount} onChange={(v) => setCharges(charges.map((x, j) => (j === i ? { ...x, amount: v } : x)))} aria-label={t("common.amount")} />
                      <button className="icon-btn" aria-label={t("leases.remove_charge")} onClick={() => setCharges(charges.filter((_, j) => j !== i))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title={t("leases.billing_start")}>
            <div className="form">
              <label className="check">
                <input type="checkbox" checked={f.existing} onChange={(e) => setF({ ...f, existing: e.target.checked })} />
                {t("leases.in_progress")}
              </label>
              {f.existing ? (
                <>
                  <p className="small muted">{t("leases.in_progress_hint")}</p>
                  <Field label={t("leases.opening_balance")} hint={t("leases.opening_balance_hint")}>
                    <MoneyInput value={f.opening_balance} onChange={(v) => setF({ ...f, opening_balance: v })} />
                  </Field>
                </>
              ) : (
                <p className="small muted">
                  {t("leases.auto_rent_from", { date: date(f.start_date) })}
                  {isPast && ` ${t("leases.past_start_note")}`}
                </p>
              )}
            </div>
          </Card>
          <Card title={t("common.notes")}>
            <Textarea value={f.notes} onChange={set("notes")} placeholder={t("leases.notes_placeholder")} aria-label={t("common.notes")} />
          </Card>
          <button className="btn btn-primary btn-block" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? t("auth.creating") : t("leases.create")}
          </button>
        </div>
      </div>
      {addingTenant && (
        <TenantFormModal
          onClose={() => setAddingTenant(false)}
          onSaved={(saved) => {
            void refetchTenants();
            setF((prev) => ({ ...prev, tenant_ids: [...prev.tenant_ids, saved.id] }));
          }}
        />
      )}
    </>
  );
}
