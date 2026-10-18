import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { api, errorMessage } from "../../../src/api/client";
import { useAuth } from "../../../src/auth/AuthContext";
import { money, toCents, todayISO } from "../../../src/format";
import { useTheme } from "../../../src/theme/useTheme";
import { Button, Card, Chips, Field, Loading, Notice, Row, Screen, T } from "../../../src/ui";

interface LeaseRow {
  id: string;
  property_name: string;
  unit_name: string;
  balance_cents: number;
  tenants: { id: string; name: string; is_primary: boolean }[];
}
type Method = "zelle" | "check" | "cash" | "venmo" | "bank_transfer" | "card" | "other";
const METHODS: { value: Method; label: string }[] = [
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

export default function RecordPayment() {
  const t = useTheme();
  const { org } = useAuth();
  const qc = useQueryClient();
  const leases = useQuery({ queryKey: ["leases", "active"], queryFn: () => api.get<LeaseRow[]>("/leases?status=active") });
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("zelle");
  const [received, setReceived] = useState(todayISO());
  const [reference, setReference] = useState("");
  const lease = leases.data?.find((l) => l.id === leaseId);
  const save = useMutation({
    mutationFn: () =>
      api.post(`/leases/${leaseId}/payments`, {
        amount_cents: toCents(amount),
        method,
        received_on: received,
        reference: reference || null,
        tenant_id: lease?.tenants.find((x) => x.is_primary)?.id ?? null,
        send_receipt: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({ pathname: "/(staff)/money", params: { done: "payment" } });
    },
  });

  if (leases.isLoading) return <Screen><Loading /></Screen>;
  if (!lease) {
    return (
      <Screen>
        <T muted>Which lease is this payment for?</T>
        <Card padded={false}>
          {(leases.data ?? []).map((l, i) => (
            <Row
              key={l.id}
              first={i === 0}
              title={l.tenants.map((x) => x.name).join(", ") || l.unit_name}
              meta={`${l.property_name} · ${l.unit_name}`}
              right={<T v="money" color={l.balance_cents > 0 ? t.garnet : t.textMuted}>{money(l.balance_cents, org?.currency)}</T>}
              onPress={() => {
                setLeaseId(l.id);
                if (l.balance_cents > 0) setAmount((l.balance_cents / 100).toFixed(2));
              }}
            />
          ))}
          {leases.data?.length === 0 && <Row first title="No active leases" />}
        </Card>
      </Screen>
    );
  }
  return (
    <Screen footer={<Button title="Record payment" onPress={() => save.mutate()} disabled={!toCents(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(received)} loading={save.isPending} />}>
      <Card padded={false}>
        <Row first title={lease.tenants.map((x) => x.name).join(", ")} meta={`${lease.property_name} · ${lease.unit_name} · balance ${money(lease.balance_cents, org?.currency)}`} onPress={() => setLeaseId(null)} />
      </Card>
      {save.error && <Notice>{errorMessage(save.error)}</Notice>}
      <Field label="Amount" prefix="$" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
      <Chips label="Method" value={method} onChange={setMethod} options={METHODS} />
      <Field label="Date received" hint="YYYY-MM-DD" value={received} onChangeText={setReceived} keyboardType="numbers-and-punctuation" />
      <Field label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Check number or confirmation code" />
      <T v="small" muted>
        A receipt is emailed to the tenant.
      </T>
    </Screen>
  );
}
