import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { MessageSquare, MessageSquarePlus } from "lucide-react-native";
import { api, errorMessage } from "../../../src/api/client";
import type { ThreadRow } from "../../../src/api/types";
import { dateTime } from "../../../src/format";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Empty, Loading, Notice, Row, Screen } from "../../../src/ui";

export default function TenantThreads() {
  const t = useTheme();
  const q = useQuery({ queryKey: ["portal-threads"], queryFn: () => api.get<ThreadRow[]>("/portal/messages") });
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching} footer={<Button title="Message your landlord" icon={<MessageSquarePlus size={18} color={t.onAccent} />} onPress={() => router.push("/(tenant)/messages/new")} />}>
      {q.error && <Notice>{errorMessage(q.error)}</Notice>}
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty icon={<MessageSquare size={32} color={t.textMuted} />} title="No messages yet" body="Questions about your lease, parking or anything else? Send your landlord a message. For repairs, use Maintenance." />
        </Card>
      ) : (
        <Card padded={false}>
          {q.data.map((th, i) => (
            <Row
              key={th.id}
              first={i === 0}
              title={th.subject}
              meta={`${th.preview} · ${dateTime(th.last_message_at)}`}
              right={th.unread ? <Badge value="new" text="New" /> : undefined}
              onPress={() => router.push(`/(tenant)/messages/${th.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
