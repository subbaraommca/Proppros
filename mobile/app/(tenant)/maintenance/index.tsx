import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Wrench } from "lucide-react-native";
import { api, errorMessage } from "../../../src/api/client";
import type { WorkOrder } from "../../../src/api/types";
import { date, label } from "../../../src/format";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Empty, Loading, Notice, Row, Screen, PageTitle } from "../../../src/ui";

export default function TenantRequests() {
  const t = useTheme();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const q = useQuery({ queryKey: ["portal-requests"], queryFn: () => api.get<WorkOrder[]>("/portal/work-orders") });
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching} footer={<Button title="Report a problem" icon={<Plus size={18} color={t.onAccent} />} onPress={() => router.push("/(tenant)/maintenance/new")} />}>
      <PageTitle title="Maintenance" subtitle="Report a problem and follow its progress." />
      {sent && <Notice tone="jade">Request sent. Your landlord has been notified.</Notice>}
      {q.error && <Notice>{errorMessage(q.error)}</Notice>}
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty icon={<Wrench size={32} color={t.textMuted} />} title="No requests yet" body="Report a leak, a broken appliance or anything else that needs fixing — add photos so it gets fixed faster." />
        </Card>
      ) : (
        <Card padded={false}>
          {q.data.map((w, i) => (
            <Row key={w.id} first={i === 0} title={w.title} meta={`#${w.number} · ${date(w.created_at)} · ${label(w.category)}`} right={<Badge value={w.status} />} onPress={() => router.push(`/(tenant)/maintenance/${w.id}`)} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
