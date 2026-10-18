import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Wrench } from "lucide-react-native";
import { useState } from "react";
import { api, errorMessage } from "../../../src/api/client";
import type { WorkOrder } from "../../../src/api/types";
import { label } from "../../../src/format";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Chips, Empty, Loading, Notice, Row, Screen } from "../../../src/ui";

type Filter = "open" | "mine" | "all";

export default function WorkOrders() {
  const t = useTheme();
  const [filter, setFilter] = useState<Filter>("open");
  const qs = filter === "open" ? "?open_only=true" : filter === "mine" ? "?mine=true" : "";
  const q = useQuery({ queryKey: ["work-orders", filter], queryFn: () => api.get<WorkOrder[]>(`/work-orders${qs}`) });
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Chips
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "open", label: "Open" },
          { value: "mine", label: "Assigned to me" },
          { value: "all", label: "All" },
        ]}
      />
      {q.error && <Notice action={<Button kind="secondary" title="Try again" onPress={() => q.refetch()} />}>{errorMessage(q.error)}</Notice>}
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty icon={<Wrench size={32} color={t.textMuted} />} title="No requests here" body="New maintenance requests from tenants and your team show up here." />
        </Card>
      ) : (
        <Card padded={false}>
          {q.data.map((w, i) => (
            <Row
              key={w.id}
              first={i === 0}
              title={`#${w.number} ${w.title}`}
              meta={`${w.property_name}${w.unit_name ? ` · ${w.unit_name}` : ""} · ${label(w.status)}`}
              right={<Badge value={w.priority} />}
              onPress={() => router.push(`/(staff)/maintenance/${w.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
