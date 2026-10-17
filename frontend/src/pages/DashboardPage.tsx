import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarClock, DollarSign, Wrench } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { CashFlowChart } from "../components/CashFlowChart";
import { BalanceText, Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../components/ui";
import { date, money } from "../utils/format";

interface Dashboard {
  today: string;
  properties: number;
  units: number;
  occupied_units: number;
  occupancy_pct: number;
  month: { billed_cents: number; collected_cents: number };
  outstanding_cents: number;
  outstanding: { lease_id: string; property_name: string; unit_name: string; tenants: string; balance_cents: number }[];
  ytd: { income_cents: number; expense_cents: number; net_cents: number };
  cash_flow: { period: string; income_cents: number; expense_cents: number; net_cents: number }[];
  expiring_leases: { lease_id: string; unit_name: string; property_name: string; end_date: string; days_left: number }[];
  open_work_orders: { total: number; emergency: number; high: number };
}

export function DashboardPage() {
  const { org, me } = useAuth();
  const { data, error, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/dashboard") });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  if (data.properties === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${me?.name.split(" ")[0]}`} subtitle={org?.name} />
        <Card>
          <Empty icon={<Building2 size={40} />} title="Add your first property" action={<Link className="btn btn-primary" to="/properties?new=1">Add property</Link>}>
            Start with a property and its units, then add tenants and leases. Rent will post automatically every month.
          </Empty>
        </Card>
      </>
    );
  }

  const collectionPct = data.month.billed_cents ? Math.round((data.month.collected_cents * 100) / data.month.billed_cents) : 0;
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${org?.name} · ${date(data.today)}`} />
      <div className="stack">
        <div className="grid grid-4">
          <Stat icon={<DollarSign size={14} />} label="Collected this month" value={money(data.month.collected_cents)} sub={`${collectionPct}% of ${money(data.month.billed_cents)} billed`} />
          <Stat icon={<AlertTriangle size={14} />} label="Outstanding" value={money(data.outstanding_cents)} sub={`${data.outstanding.length} lease${data.outstanding.length === 1 ? "" : "s"} with a balance`} />
          <Stat icon={<Building2 size={14} />} label="Occupancy" value={`${data.occupancy_pct}%`} sub={`${data.occupied_units} of ${data.units} units · ${data.properties} properties`} />
          <Stat
            icon={<Wrench size={14} />}
            label="Open work orders"
            value={data.open_work_orders.total}
            sub={data.open_work_orders.emergency ? `${data.open_work_orders.emergency} emergency` : `${data.open_work_orders.high} high priority`}
          />
        </div>

        <div className="two-col">
          <Card title="Cash flow — last 12 months" actions={<Link to="/reports" className="small">Reports →</Link>}>
            <CashFlowChart data={data.cash_flow} />
            <div className="figure-row">
              <div>
                <div className="eyebrow">Income YTD</div>
                <strong>{money(data.ytd.income_cents)}</strong>
              </div>
              <div>
                <div className="eyebrow">Expenses YTD</div>
                <strong>{money(data.ytd.expense_cents)}</strong>
              </div>
              <div>
                <div className="eyebrow">Net YTD</div>
                <strong className={data.ytd.net_cents < 0 ? "danger-text" : ""}>{money(data.ytd.net_cents)}</strong>
              </div>
            </div>
          </Card>

          <div className="stack">
            <Card title="Balances due" actions={<Link to="/reports?tab=outstanding" className="small">All →</Link>}>
              {data.outstanding.length === 0 ? (
                <p className="muted">Everyone is paid up. 🎉</p>
              ) : (
                <ul className="list-plain">
                  {data.outstanding.map((o) => (
                    <li key={o.lease_id}>
                      <div>
                        <Link to={`/leases/${o.lease_id}`} className="row-link">
                          {o.tenants || "Lease"}
                        </Link>
                        <div className="small muted">
                          {o.property_name} · {o.unit_name}
                        </div>
                      </div>
                      <BalanceText cents={o.balance_cents} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Leases ending in 90 days">
              {data.expiring_leases.length === 0 ? (
                <p className="muted">No leases ending soon.</p>
              ) : (
                <ul className="list-plain">
                  {data.expiring_leases.map((l) => (
                    <li key={l.lease_id}>
                      <div>
                        <Link to={`/leases/${l.lease_id}`} className="row-link">
                          {l.property_name} · {l.unit_name}
                        </Link>
                        <div className="small muted">
                          <CalendarClock size={12} /> Ends {date(l.end_date)}
                        </div>
                      </div>
                      <span className={`badge ${l.days_left <= 30 ? "badge-garnet" : "badge-citrine"}`}>{l.days_left} days</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
