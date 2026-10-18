import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CalendarDays, Megaphone, Wrench } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { api, errorMessage } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { date, money, toCents } from "../../src/format";
import { space } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { Button, Card, Chips, Field, Loading, Notice, PageTitle, Screen, T } from "../../src/ui";

interface PortalLease {
  id: string;
  status: string;
  balance_cents: number;
  monthly_total_cents: number;
  next_due_date: string | null;
  property?: { name: string; address: string };
  unit?: { name: string };
}
interface Home {
  tenant_name: string;
  organization: string;
  leases: PortalLease[];
  open_requests: number;
}
interface PayOptions {
  enabled: boolean;
  leases: { lease_id: string; available: boolean; payable_cents: number; pending_cents: number; allow_partial: boolean; card_fee: { bps: number; fixed_cents: number } | null }[];
}

function PayCard({ lease }: { lease: PortalLease }) {
  const t = useTheme();
  const { org } = useAuth();
  const opts = useQuery({ queryKey: ["pay-options"], queryFn: () => api.get<PayOptions>("/portal/online-payments") });
  const o = opts.data?.leases.find((x) => x.lease_id === lease.id);
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<"us_bank_account" | "card">("us_bank_account");
  const value = amount ?? (o ? (o.payable_cents / 100).toFixed(2) : "");
  const pay = useMutation({
    mutationFn: () => api.post<{ url: string }>(`/portal/leases/${lease.id}/pay`, { amount_cents: toCents(value), method }),
    onSuccess: async (r) => {
      await WebBrowser.openBrowserAsync(r.url); // Stripe's hosted page; card details never touch the app (§10.8)
      opts.refetch();
    },
  });
  if (!opts.data) return null;
  if (!opts.data.enabled || !o?.available) {
    return (
      <T v="small" muted>
        Pay your landlord as you usually do. Payments show up here once they're recorded.
      </T>
    );
  }
  if (o.payable_cents <= 0) {
    return <T v="small" color={t.jade}>{o.pending_cents > 0 ? `${money(o.pending_cents, org?.currency)} is processing.` : "You're all paid up. Thank you!"}</T>;
  }
  return (
    <View style={{ gap: space.md }}>
      {pay.error && <Notice>{errorMessage(pay.error)}</Notice>}
      {o.allow_partial && <Field label="Amount" prefix="$" value={value} onChangeText={setAmount} keyboardType="decimal-pad" />}
      <Chips
        label="Pay with"
        value={method}
        onChange={setMethod}
        options={[
          { value: "us_bank_account", label: "Bank account" },
          { value: "card", label: o.card_fee ? "Card (fee applies)" : "Card" },
        ]}
      />
      <Button title={`Pay ${money(toCents(value) ?? 0, org?.currency)}`} onPress={() => pay.mutate()} disabled={!toCents(value)} loading={pay.isPending} />
    </View>
  );
}

export default function TenantHome() {
  const t = useTheme();
  const { org } = useAuth();
  const home = useQuery({ queryKey: ["portal-home"], queryFn: () => api.get<Home>("/portal/home") });
  const news = useQuery({ queryKey: ["portal-announcements"], queryFn: () => api.get<{ id: string; title: string; body: string; created_at: string }[]>("/portal/announcements") });
  const refresh = () => {
    home.refetch();
    news.refetch();
  };
  const d = home.data;
  return (
    <Screen onRefresh={refresh} refreshing={home.isRefetching}>
      {home.error && <Notice action={<Button kind="secondary" title="Try again" onPress={refresh} />}>{errorMessage(home.error)}</Notice>}
      {!d ? (
        home.isLoading && <Loading />
      ) : (
        <>
          <PageTitle title={`Welcome, ${d.tenant_name}`} subtitle={d.organization} />
          {d.leases
            .filter((l) => l.status === "active")
            .map((l) => (
              <Card key={l.id} glow>
                <T v="eyebrow">Current balance · {l.property?.name}</T>
                <T v="hero" color={l.balance_cents > 0 ? t.garnet : t.textLoud}>
                  {l.balance_cents < 0 ? `${money(-l.balance_cents, org?.currency)} credit` : money(l.balance_cents, org?.currency)}
                </T>
                {l.next_due_date ? (
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <CalendarDays size={14} color={t.textMuted} />
                    <T v="small" muted>
                      Next rent due: {money(l.monthly_total_cents, org?.currency)} on {date(l.next_due_date)}
                    </T>
                  </View>
                ) : null}
                <PayCard lease={l} />
              </Card>
            ))}
          {d.leases.length === 0 && (
            <Card>
              <T muted>Your landlord hasn't added your lease yet.</T>
            </Card>
          )}
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Wrench size={18} color={t.accent} />
              <T style={{ flex: 1 }}>{d.open_requests ? `${d.open_requests} open maintenance request${d.open_requests === 1 ? "" : "s"}` : "Something need fixing?"}</T>
            </View>
            <Button kind="secondary" title="Report a problem" onPress={() => router.push("/(tenant)/maintenance/new")} />
          </Card>
          {(news.data ?? []).slice(0, 3).map((a) => (
            <Card key={a.id}>
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                <Megaphone size={16} color={t.lapis} />
                <T v="section" style={{ flex: 1 }}>
                  {a.title}
                </T>
              </View>
              <T>{a.body}</T>
              <T v="small" muted>
                {date(a.created_at)}
              </T>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
