import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, Trash2, UserPlus } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Lease, Tenant, Unit } from "../types";
import { Badge, BalanceText, Card, Empty, ErrorBox, Field, Input, MoneyInput, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { date, money, ordinal, toCents, todayISO } from "../utils/format";
import { TenantFormModal } from "./TenantsPage";

export function LeasesPage() {
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
        title="Leases"
        actions={
          can("owner", "manager") && (
            <Link className="btn btn-primary" to="/leases/new">
              <Plus size={16} /> New lease
            </Link>
          )
        }
      />
      <div className="toolbar">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          options={[
            { value: "active", label: "Active" },
            { value: "ended", label: "Ended" },
            { value: "", label: "All leases" },
          ]}
        />
      </div>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<FileText size={40} />} title={status === "active" ? "No active leases" : "No leases"}>
            Create a lease to start posting rent automatically.
          </Empty>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property · Unit</th>
                  <th>Tenants</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th className="num">Rent</th>
                  <th className="num">Balance</th>
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
                    <td>{l.tenants.map((t) => t.name).join(", ")}</td>
                    <td className="small nowrap">
                      {date(l.start_date)} – {l.ended_on ? date(l.ended_on) : l.end_date ? date(l.end_date) : "Month-to-month"}
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
    () => [{ value: "", label: "Select a unit…" }, ...(units ?? []).map((u) => ({ value: u.id, label: `${u.property_name} · ${u.name}${u.status === "occupied" ? " (occupied)" : ""}` }))],
    [units],
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

  const toggleTenant = (id: string) =>
    setF({ ...f, tenant_ids: f.tenant_ids.includes(id) ? f.tenant_ids.filter((x) => x !== id) : [...f.tenant_ids, id] });
  const valid = f.unit_id && f.tenant_ids.length > 0 && f.start_date && toCents(f.rent);
  const isPast = f.start_date < today;

  return (
    <>
      <PageHeader breadcrumb={<Link to="/leases">Leases</Link>} title="New lease" />
      <div className="two-col">
        <div className="stack">
          <ErrorBox error={create.error} />
          <Card title="Unit & tenants">
            <div className="form">
              <Field label="Unit">
                <Select value={f.unit_id} onChange={set("unit_id")} options={unitOptions} />
              </Field>
              {selectedUnit?.market_rent_cents && !f.rent && (
                <p className="small muted">
                  Market rent for this unit: {money(selectedUnit.market_rent_cents)}{" "}
                  <button className="link-btn" onClick={() => setF({ ...f, rent: (selectedUnit.market_rent_cents! / 100).toFixed(2) })}>
                    Use it
                  </button>
                </p>
              )}
              <div className="field">
                <span>Tenants on the lease</span>
                <div className="stack" style={{ gap: 6 }}>
                  {tenants?.map((t) => (
                    <label key={t.id} className="check">
                      <input type="checkbox" checked={f.tenant_ids.includes(t.id)} onChange={() => toggleTenant(t.id)} />
                      {t.first_name} {t.last_name} {t.email && <span className="muted small">· {t.email}</span>}
                    </label>
                  ))}
                  {tenants?.length === 0 && <p className="muted small">No tenants yet.</p>}
                </div>
                <div>
                  <button className="btn btn-sm" type="button" onClick={() => setAddingTenant(true)}>
                    <UserPlus size={14} /> New tenant
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Terms">
            <div className="form">
              <div className="form-row">
                <Field label="Start date">
                  <Input type="date" value={f.start_date} onChange={set("start_date")} />
                </Field>
                <Field label="End date" hint="leave blank for month-to-month">
                  <Input type="date" value={f.end_date} onChange={set("end_date")} />
                </Field>
              </div>
              <div className="form-row-3">
                <Field label="Monthly rent">
                  <MoneyInput value={f.rent} onChange={(v) => setF({ ...f, rent: v })} />
                </Field>
                <Field label="Due day">
                  <Select value={f.due_day} onChange={set("due_day")} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${ordinal(i + 1)} of the month` }))} />
                </Field>
                <Field label="Security deposit">
                  <MoneyInput value={f.deposit} onChange={(v) => setF({ ...f, deposit: v })} />
                </Field>
              </div>
              <div className="form-row-3">
                <Field label="Late fee">
                  <Select
                    value={f.late_fee_type}
                    onChange={set("late_fee_type")}
                    options={[
                      { value: "flat", label: "Flat amount" },
                      { value: "percent", label: "% of rent" },
                    ]}
                  />
                </Field>
                <Field label={f.late_fee_type === "percent" ? "Percent" : "Amount"} hint="blank = no late fee">
                  {f.late_fee_type === "percent" ? (
                    <Input type="number" min={0} max={100} step="0.5" value={f.late_fee} onChange={set("late_fee")} placeholder="5" />
                  ) : (
                    <MoneyInput value={f.late_fee} onChange={(v) => setF({ ...f, late_fee: v })} />
                  )}
                </Field>
                <Field label="Grace period (days)">
                  <Input type="number" min={0} max={27} value={f.grace_days} onChange={set("grace_days")} />
                </Field>
              </div>
            </div>
          </Card>

          <Card
            title="Recurring charges"
            actions={
              <button className="btn btn-sm" onClick={() => setCharges([...charges, { charge_type: "parking", description: "", amount: "" }])}>
                <Plus size={14} /> Add charge
              </button>
            }
          >
            {charges.length === 0 ? (
              <p className="muted small">Parking, pet rent, utilities… posted together with rent each month.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {charges.map((c, i) => (
                  <div key={i} className="form-row-3" style={{ alignItems: "end" }}>
                    <Select
                      value={c.charge_type}
                      onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, charge_type: e.target.value } : x)))}
                      options={["parking", "pet", "utility", "storage", "other"]}
                      aria-label="Charge type"
                    />
                    <Input placeholder="Description" value={c.description} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <MoneyInput value={c.amount} onChange={(v) => setCharges(charges.map((x, j) => (j === i ? { ...x, amount: v } : x)))} aria-label="Amount" />
                      <button className="icon-btn" aria-label="Remove charge" onClick={() => setCharges(charges.filter((_, j) => j !== i))}>
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
          <Card title="Billing start">
            <div className="form">
              <label className="check">
                <input type="checkbox" checked={f.existing} onChange={(e) => setF({ ...f, existing: e.target.checked })} />
                This lease is already in progress
              </label>
              {f.existing ? (
                <>
                  <p className="small muted">Automatic rent starts from the next due date. Enter what the tenant owes today (if anything) as an opening balance.</p>
                  <Field label="Opening balance" hint="amount owed today; negative = credit">
                    <MoneyInput value={f.opening_balance} onChange={(v) => setF({ ...f, opening_balance: v })} />
                  </Field>
                </>
              ) : (
                <p className="small muted">
                  Rent posts automatically on each due date from {date(f.start_date)}.
                  {isPast && " Because the start date is in the past, rent for past due dates will be posted now."}
                </p>
              )}
            </div>
          </Card>
          <Card title="Notes">
            <Textarea value={f.notes} onChange={set("notes")} placeholder="Private notes (not shown to tenants)" aria-label="Notes" />
          </Card>
          <button className="btn btn-primary btn-block" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create lease"}
          </button>
        </div>
      </div>
      {addingTenant && (
        <TenantFormModal
          onClose={() => setAddingTenant(false)}
          onSaved={(t) => {
            void refetchTenants();
            setF((prev) => ({ ...prev, tenant_ids: [...prev.tenant_ids, t.id] }));
          }}
        />
      )}
    </>
  );
}
