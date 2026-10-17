import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { org, me } = useAuth();
  const { data, error, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/dashboard") });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;

  if (data.properties === 0) {
    return (
      <>
        <PageHeader title={t("dashboard.welcome", { name: me?.name.split(" ")[0] })} subtitle={org?.name} />
        <Card>
          <Empty
            icon={<Building2 size={40} />}
            title={t("dashboard.first_property_title")}
            action={
              <Link className="btn btn-primary" to="/properties?new=1">
                {t("properties.add")}
              </Link>
            }
          >
            {t("dashboard.first_property_body")}
          </Empty>
        </Card>
      </>
    );
  }

  const collectionPct = data.month.billed_cents ? Math.round((data.month.collected_cents * 100) / data.month.billed_cents) : 0;
  const wo = data.open_work_orders;
  return (
    <>
      <PageHeader title={t("nav.dashboard")} subtitle={`${org?.name} · ${date(data.today)}`} />
      <div className="stack">
        <div className="grid grid-4">
          <Stat
            icon={<DollarSign size={14} />}
            label={t("dashboard.collected")}
            value={money(data.month.collected_cents)}
            sub={t("dashboard.collected_sub", { pct: collectionPct, billed: money(data.month.billed_cents) })}
          />
          <Stat
            icon={<AlertTriangle size={14} />}
            label={t("dashboard.outstanding")}
            value={money(data.outstanding_cents)}
            sub={t("dashboard.outstanding_sub", { count: data.outstanding.length })}
          />
          <Stat
            icon={<Building2 size={14} />}
            label={t("dashboard.occupancy")}
            value={`${data.occupancy_pct}%`}
            sub={`${t("dashboard.units_occupied", { occupied: data.occupied_units, count: data.units })} · ${t("dashboard.property_count", { count: data.properties })}`}
          />
          <Stat
            icon={<Wrench size={14} />}
            label={t("dashboard.open_work_orders")}
            value={wo.total}
            sub={wo.emergency ? t("dashboard.emergency_count", { count: wo.emergency }) : t("dashboard.high_count", { count: wo.high })}
          />
        </div>

        <div className="two-col">
          <Card
            title={t("dashboard.cash_flow")}
            actions={
              <Link to="/reports" className="small">
                {t("common.reports_link")}
              </Link>
            }
          >
            <CashFlowChart data={data.cash_flow} />
            <div className="figure-row">
              <div>
                <div className="eyebrow">{t("dashboard.income_ytd")}</div>
                <strong>{money(data.ytd.income_cents)}</strong>
              </div>
              <div>
                <div className="eyebrow">{t("dashboard.expenses_ytd")}</div>
                <strong>{money(data.ytd.expense_cents)}</strong>
              </div>
              <div>
                <div className="eyebrow">{t("dashboard.net_ytd")}</div>
                <strong className={data.ytd.net_cents < 0 ? "danger-text" : ""}>{money(data.ytd.net_cents)}</strong>
              </div>
            </div>
          </Card>

          <div className="stack">
            <Card
              title={t("dashboard.balances_due")}
              actions={
                <Link to="/reports?tab=outstanding" className="small">
                  {t("common.all_link")}
                </Link>
              }
            >
              {data.outstanding.length === 0 ? (
                <p className="muted">{t("dashboard.all_paid")}</p>
              ) : (
                <ul className="list-plain">
                  {data.outstanding.map((o) => (
                    <li key={o.lease_id}>
                      <div>
                        <Link to={`/leases/${o.lease_id}`} className="row-link">
                          {o.tenants || t("enums.lease")}
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
            <Card title={t("dashboard.leases_ending")}>
              {data.expiring_leases.length === 0 ? (
                <p className="muted">{t("dashboard.no_leases_ending")}</p>
              ) : (
                <ul className="list-plain">
                  {data.expiring_leases.map((l) => (
                    <li key={l.lease_id}>
                      <div>
                        <Link to={`/leases/${l.lease_id}`} className="row-link">
                          {l.property_name} · {l.unit_name}
                        </Link>
                        <div className="small muted">
                          <CalendarClock size={12} /> {t("dashboard.ends", { date: date(l.end_date) })}
                        </div>
                      </div>
                      <span className={`badge ${l.days_left <= 30 ? "badge-garnet" : "badge-citrine"}`}>{t("dashboard.days", { count: l.days_left })}</span>
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
