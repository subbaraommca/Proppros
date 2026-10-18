import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { api, errorMessage } from "../../../src/api/client";
import type { ChatMessage, ThreadRow } from "../../../src/api/types";
import { Chat } from "../../../src/components/Chat";
import { Loading, Screen } from "../../../src/ui";

export default function StaffThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["thread", id], queryFn: () => api.get<ThreadRow & { messages: ChatMessage[] }>(`/messages/threads/${id}`), refetchInterval: 20_000 });
  useEffect(() => {
    if (q.data) {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    }
  }, [q.data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({ mutationFn: (body: string) => api.post(`/messages/threads/${id}`, { body }), onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", id] }) });
  if (!q.data) return <Screen>{q.isLoading ? <Loading /> : null}</Screen>;
  return (
    <>
      <Stack.Screen options={{ title: q.data.tenant_name }} />
      <Chat messages={q.data.messages} mine="staff" onSend={(b) => send.mutate(b)} sending={send.isPending} error={send.error ? errorMessage(send.error) : q.error ? errorMessage(q.error) : null} />
    </>
  );
}
