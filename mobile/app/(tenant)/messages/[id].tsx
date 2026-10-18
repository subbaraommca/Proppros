import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { api, errorMessage } from "../../../src/api/client";
import type { ChatMessage, ThreadRow } from "../../../src/api/types";
import { Chat } from "../../../src/components/Chat";
import { Loading, Screen } from "../../../src/ui";

export default function TenantThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["portal-thread", id], queryFn: () => api.get<ThreadRow & { messages: ChatMessage[] }>(`/portal/messages/${id}`), refetchInterval: 20_000 });
  useEffect(() => {
    if (q.data) qc.invalidateQueries({ queryKey: ["portal-threads"] });
  }, [q.data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({ mutationFn: (body: string) => api.post(`/portal/messages/${id}`, { body }), onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-thread", id] }) });
  if (!q.data) return <Screen>{q.isLoading ? <Loading /> : null}</Screen>;
  return (
    <>
      <Stack.Screen options={{ title: q.data.subject }} />
      <Chat messages={q.data.messages} mine="tenant" onSend={(b) => send.mutate(b)} sending={send.isPending} error={send.error ? errorMessage(send.error) : null} />
    </>
  );
}
