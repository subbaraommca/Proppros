import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, errorMessage } from "../../../src/api/client";
import type { WorkOrder } from "../../../src/api/types";
import { PhotoStrip } from "../../../src/components/PhotoStrip";
import { dateTime, label } from "../../../src/format";
import { appendPhoto, pickPhoto } from "../../../src/photos";
import { space } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Field, Loading, Notice, Screen, T } from "../../../src/ui";

export default function TenantRequest() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const q = useQuery({ queryKey: ["portal-request", id], queryFn: () => api.get<WorkOrder & { attachments?: { id: string; content_type: string }[] }>(`/portal/work-orders/${id}`) });
  const post = useMutation({
    mutationFn: () => api.post(`/portal/work-orders/${id}/comments`, { body: comment.trim() }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["portal-request", id] });
    },
  });
  const addPhoto = useMutation({
    mutationFn: async (source: "camera" | "library") => {
      const p = await pickPhoto(source);
      if (!p) return;
      const form = new FormData();
      await appendPhoto(form, "file", p);
      await api.upload(`/portal/work-orders/${id}/attachments`, form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-request", id] }),
  });
  const w = q.data;
  if (!w) return <Screen>{q.error ? <Notice>{errorMessage(q.error)}</Notice> : <Loading />}</Screen>;
  const open = !["completed", "closed"].includes(w.status);
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Request #{w.number}</T>
        <T v="title">{w.title}</T>
        <Badge value={w.status} />
      </View>
      {(post.error || addPhoto.error) && <Notice>{errorMessage(post.error || addPhoto.error)}</Notice>}
      <Card>
        <T muted>
          {label(w.category)} · {dateTime(w.created_at)}
        </T>
        {w.description ? <T>{w.description}</T> : null}
        {w.scheduled_for ? <T color={t.lapis}>Scheduled for {dateTime(w.scheduled_for)}</T> : null}
      </Card>
      <Card title="Photos">
        <PhotoStrip ids={(w.attachments ?? []).filter((d) => d.content_type.startsWith("image/")).map((d) => d.id)} onAdd={(s) => addPhoto.mutate(s)} busy={addPhoto.isPending} canAdd={open} />
      </Card>
      <Card title="Updates">
        {(w.comments ?? []).map((c) => (
          <View key={c.id} style={{ gap: 2, borderLeftWidth: 2, borderLeftColor: c.is_system ? t.borderSubtle : t.border, paddingLeft: space.md }}>
            <T v="small" muted>
              {c.author_name} · {dateTime(c.created_at)}
            </T>
            <T muted={c.is_system}>{c.body}</T>
          </View>
        ))}
        {open && (
          <>
            <Field label="Add a note" value={comment} onChangeText={setComment} multiline />
            <Button kind="secondary" title="Send note" onPress={() => post.mutate()} disabled={!comment.trim()} loading={post.isPending} />
          </>
        )}
      </Card>
    </Screen>
  );
}
