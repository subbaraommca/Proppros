import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { AlertTriangle, Building2, DollarSign, Wrench } from "lucide-react-native";
import { api, errorMessage } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { date, money } from "../../src/format";
import { useTheme } from "../../src/theme/useTheme";
import { Button, Card, Loading, Notice, PageTitle, Row, Screen, Stat, T } from "../../src/ui";

interface Dashboard {
  today: string;
  properties: number;
  units: number;
  occupied_units: number;
  occupancy_pct: number;
  month: { billed_cents: number; collected_cents: number };
  outstanding_cents: number;
  outstanding: { lease_id: string; tenants: string; property_name: string; unit_name: string; balance_cents: number }[];
  expiring_leases: { lease_id: string; property_name: string; unit_name: string; end_date: string; days_left: number }[];
  open_work_orders: { total: number; emergency: number; high: number };
}

/** Owner/manager dashboard — same stats and wording as the web Dashboard, stacked for a phone. */
export default function StaffHome() {
  const t = useTheme();
  const { org } = useAuth();
  const q = useQuery({ queryKey: ["dashboard", org?.id], queryFn: () => api.get<Dashboard>("/dashboard"), enabled: org?.role !== "maintenance" });
  if (org?.role === "maintenance") return <Redirect href="/(staff)/maintenance" />;
  const d = q.data;
  const icon = (I: typeof DollarSign) => <I size={14} color={t.textMuted} />;
  const pct = d && d.month.billed_cents ? Math.round((d.month.collected_cents / d.month.billed_cents) * 100) : 0;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <PageTitle title="Dashboard" subtitle={`${org?.name ?? ""}${d ? ` · ${date(d.today)}` : ""}`} />
      {q.error && <Notice action={<Button kind="secondary" title="Try again" onPress={() => q.refetch()} />}>{errorMessage(q.error)}</Notice>}
      {!d ? (
        q.isLoading && <Loading />
      ) : (
        <>
          <Card>
            <Stat icon={icon(DollarSign)} label="Collected this month" value={money(d.month.collected_cents, org?.currency)} sub={`${pct}% of ${money(d.month.billed_cents, org?.currency)} billed`} />
          </Card>
          <Card>
            <Stat
              icon={icon(AlertTriangle)}
              label="Outstanding"
              value={money(d.outstanding_cents, org?.currency)}
              sub={d.outstanding.length ? `${d.outstanding.length} lease${d.outstanding.length === 1 ? "" : "s"} with a balance` : "Everyone is paid up"}
            />
          </Card>
          <Card>
            <Stat icon={icon(Building2)} label="Occupancy" value={`${d.occupancy_pct}%`} sub={`${d.occupied_units} of ${d.units} units · ${d.properties} propert${d.properties === 1 ? "y" : "ies"}`} />
          </Card>
          <Card padded={false}>
            <Row
              first
              title={`${d.open_work_orders.total} open work order${d.open_work_orders.total === 1 ? "" : "s"}`}
              meta={d.open_work_orders.emergency ? `${d.open_work_orders.emergency} emergency` : `${d.open_work_orders.high} high priority`}
              right={<Wrench size={16} color={d.open_work_orders.emergency ? t.garnet : t.textMuted} />}
              onPress={() => router.push("/(staff)/maintenance")}
            />
          </Card>
          {d.outstanding.length > 0 && (
            <Card title="Balances due" padded={false}>
              {d.outstanding.map((o, i) => (
                <Row key={o.lease_id} first={i === 0} title={o.tenants || o.unit_name} meta={`${o.property_name} · ${o.unit_name}`} right={<T v="money" color={t.garnet}>{money(o.balance_cents, org?.currency)}</T>} />
              ))}
            </Card>
          )}
          {d.expiring_leases.length > 0 && (
            <Card title="Leases ending soon" padded={false}>
              {d.expiring_leases.map((l, i) => (
                <Row key={l.lease_id} first={i === 0} title={`${l.property_name} · ${l.unit_name}`} meta={`Ends ${date(l.end_date)} (${l.days_left} days)`} />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
