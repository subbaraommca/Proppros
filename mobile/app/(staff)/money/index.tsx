import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { DollarSign, Receipt } from "lucide-react-native";
import { View } from "react-native";
import { api } from "../../../src/api/client";
import { useAuth } from "../../../src/auth/AuthContext";
import { date, label, money } from "../../../src/format";
import { space } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { Button, Card, Loading, Notice, Row, Screen, T } from "../../../src/ui";

interface PaymentRow {
  id: string;
  amount_cents: number;
  method: string;
  received_on: string;
  receipt_number: string;
  tenant_name?: string | null;
  property_name?: string;
  unit_name?: string;
  voided_at: string | null;
}

export default function Money() {
  const t = useTheme();
  const { org } = useAuth();
  const { done } = useLocalSearchParams<{ done?: string }>();
  const q = useQuery({ queryKey: ["payments"], queryFn: () => api.get<PaymentRow[]>("/payments") });
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {done === "payment" && <Notice tone="jade">Payment recorded. The receipt was emailed to the tenant.</Notice>}
      {done === "expense" && <Notice tone="jade">Expense saved.</Notice>}
      <View style={{ gap: space.sm }}>
        <Button title="Record a rent payment" icon={<DollarSign size={18} color={t.onAccent} />} onPress={() => router.push("/(staff)/money/payment")} />
        <Button kind="secondary" title="Add an expense with receipt" icon={<Receipt size={18} color={t.text} />} onPress={() => router.push("/(staff)/money/expense")} />
      </View>
      <Card title="Recent payments" padded={false}>
        {q.isLoading ? (
          <Loading />
        ) : !q.data?.length ? (
          <Row first title="No payments yet" />
        ) : (
          q.data
            .filter((p) => !p.voided_at)
            .slice(0, 15)
            .map((p, i) => (
              <Row
                key={p.id}
                first={i === 0}
                title={p.tenant_name || p.receipt_number}
                meta={`${date(p.received_on)} · ${label(p.method)}${p.property_name ? ` · ${p.property_name}` : ""}`}
                right={<T v="money" color={t.jade}>{money(p.amount_cents, org?.currency)}</T>}
              />
            ))
        )}
      </Card>
    </Screen>
  );
}
