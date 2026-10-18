import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { api, errorMessage } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { date, money } from "../../src/format";
import { space } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { Badge, Button, Card, Loading, Notice, Row, Screen, Stat, T } from "../../src/ui";

interface Dashboard {
  units: number;
  occupied_units: number;
  occupancy_pct: number;
  month: { billed_cents: number; collected_cents: number };
  outstanding_cents: number;
  outstanding: { lease_id: string; tenants: string; property_name: string; unit_name: string; balance_cents: number }[];
  expiring_leases: { lease_id: string; property_name: string; unit_name: string; end_date: string; days_left: number }[];
  open_work_orders: { total: number; emergency: number; high: number };
}

export default function StaffHome() {
  const t = useTheme();
  const { org } = useAuth();
  const q = useQuery({ queryKey: ["dashboard", org?.id], queryFn: () => api.get<Dashboard>("/dashboard"), enabled: org?.role !== "maintenance" });
  if (org?.role === "maintenance") return <Redirect href="/(staff)/maintenance" />;
  const d = q.data;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.error && <Notice action={<Button kind="secondary" title="Try again" onPress={() => q.refetch()} />}>{errorMessage(q.error)}</Notice>}
      {!d ? (
        q.isLoading && <Loading />
      ) : (
        <>
          <Card glow>
            <T v="eyebrow">Collected this month</T>
            <T v="hero">{money(d.month.collected_cents, org?.currency)}</T>
            <T v="small" muted>
              of {money(d.month.billed_cents, org?.currency)} billed
            </T>
          </Card>
          <Card>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Stat label="Owed to you" value={money(d.outstanding_cents, org?.currency)} />
              <Stat label="Occupancy" value={`${d.occupancy_pct}%`} sub={`${d.occupied_units} of ${d.units} units`} />
            </View>
          </Card>
          <Card title="Open maintenance" padded={false}>
            <Row
              first
              title={`${d.open_work_orders.total} open request${d.open_work_orders.total === 1 ? "" : "s"}`}
              meta={d.open_work_orders.emergency ? `${d.open_work_orders.emergency} emergency` : d.open_work_orders.high ? `${d.open_work_orders.high} high priority` : "Nothing urgent"}
              right={d.open_work_orders.emergency ? <Badge value="emergency" /> : undefined}
              onPress={() => router.push("/(staff)/maintenance")}
            />
          </Card>
          <Card title="Balances due" padded={false}>
            {d.outstanding.length ? (
              d.outstanding.map((o, i) => (
                <Row key={o.lease_id} first={i === 0} title={o.tenants || o.unit_name} meta={`${o.property_name} · ${o.unit_name}`} right={<T v="money" color={t.garnet}>{money(o.balance_cents, org?.currency)}</T>} />
              ))
            ) : (
              <Row first title="Everyone is paid up" />
            )}
          </Card>
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
