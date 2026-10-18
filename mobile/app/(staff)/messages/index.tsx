import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { MessageSquare } from "lucide-react-native";
import { api, errorMessage } from "../../../src/api/client";
import type { ThreadRow } from "../../../src/api/types";
import { dateTime } from "../../../src/format";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Empty, Loading, Notice, Row, Screen, PageTitle } from "../../../src/ui";

export default function StaffThreads() {
  const t = useTheme();
  const q = useQuery({ queryKey: ["threads"], queryFn: () => api.get<ThreadRow[]>("/messages/threads"), refetchInterval: 60_000 });
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <PageTitle title="Messages" subtitle="Conversations with your tenants." />
      {q.error && <Notice action={<Button kind="secondary" title="Try again" onPress={() => q.refetch()} />}>{errorMessage(q.error)}</Notice>}
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Card>
          <Empty icon={<MessageSquare size={32} color={t.textMuted} />} title="No conversations yet" body="Messages from tenants show up here. Start new conversations on the web app." />
        </Card>
      ) : (
        <Card padded={false}>
          {q.data.map((th, i) => (
            <Row
              key={th.id}
              first={i === 0}
              title={`${th.tenant_name} — ${th.subject}`}
              meta={`${th.last_author_role === "staff" ? "You: " : ""}${th.preview} · ${dateTime(th.last_message_at)}`}
              right={th.unread ? <Badge value="new" text="New" /> : undefined}
              onPress={() => router.push(`/(staff)/messages/${th.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
