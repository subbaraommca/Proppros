import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { DoorOpen } from "lucide-react-native";
import { useState } from "react";
import { Platform, View } from "react-native";
import { api, errorMessage } from "../../../src/api/client";
import type { WorkOrder } from "../../../src/api/types";
import { PhotoStrip } from "../../../src/components/PhotoStrip";
import { dateTime, label } from "../../../src/format";
import { appendPhoto, pickPhoto } from "../../../src/photos";
import { space } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { Badge, Button, Card, Field, Loading, Notice, Screen, T } from "../../../src/ui";

const NEXT: Record<WorkOrder["status"], WorkOrder["status"][]> = {
  new: ["in_progress", "scheduled"],
  assigned: ["in_progress", "scheduled"],
  scheduled: ["in_progress"],
  in_progress: ["completed"],
  completed: ["closed", "in_progress"],
  closed: ["in_progress"],
};

export default function WorkOrderDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const q = useQuery({ queryKey: ["work-order", id], queryFn: () => api.get<WorkOrder>(`/work-orders/${id}`) });
  const photos = useQuery({
    queryKey: ["wo-photos", id],
    queryFn: () => api.get<{ id: string; content_type: string }[]>(`/documents?owner_type=work_order&owner_id=${id}`),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["work-order", id] });
    qc.invalidateQueries({ queryKey: ["work-orders"] });
  };
  const success = () => {
    if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  const status = useMutation({
    mutationFn: (s: string) => api.patch(`/work-orders/${id}`, { status: s }),
    onSuccess: () => {
      refresh();
      success();
    },
  });
  const post = useMutation({
    mutationFn: () => api.post(`/work-orders/${id}/comments`, { body: comment.trim(), is_internal: false }),
    onSuccess: () => {
      setComment("");
      refresh();
    },
  });
  const addPhoto = useMutation({
    mutationFn: async (source: "camera" | "library") => {
      const photo = await pickPhoto(source);
      if (!photo) return;
      const form = new FormData();
      await appendPhoto(form, "file", photo);
      form.append("owner_type", "work_order");
      form.append("owner_id", String(id));
      form.append("kind", "photo");
      await api.upload("/documents", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wo-photos", id] }),
  });
  const w = q.data;
  if (!w) return <Screen>{q.error ? <Notice>{errorMessage(q.error)}</Notice> : <Loading />}</Screen>;
  const comments = (w.comments ?? []).filter((c) => !c.is_system).slice(-10);
  const err = status.error || post.error || addPhoto.error;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Request #{w.number}</T>
        <T v="title">{w.title}</T>
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <Badge value={w.status} />
          <Badge value={w.priority} text={`${label(w.priority)} priority`} />
        </View>
      </View>
      {err && <Notice>{errorMessage(err)}</Notice>}
      <Card>
        <T muted>
          {w.property_name}
          {w.unit_name ? ` · ${w.unit_name}` : ""} · {label(w.category)}
        </T>
        {w.description ? <T>{w.description}</T> : <T muted>No details provided.</T>}
        <T v="small" muted>
          Requested by {w.tenant_name ?? "your team"} · {dateTime(w.created_at)}
        </T>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <DoorOpen size={14} color={w.permission_to_enter ? t.jade : t.textMuted} />
          <T v="small" muted>
            {w.permission_to_enter ? "Tenant gave permission to enter" : "Contact the tenant before entering"}
          </T>
        </View>
      </Card>
      {w.can_edit && (
        <Card title="Update status">
          {NEXT[w.status].map((s) => (
            <Button
              key={s}
              kind={s === "completed" ? "primary" : "secondary"}
              title={s === "in_progress" && w.status === "closed" ? "Reopen" : `Mark as ${label(s).toLowerCase()}`}
              onPress={() => status.mutate(s)}
              loading={status.isPending && status.variables === s}
            />
          ))}
        </Card>
      )}
      <Card title="Photos">
        <PhotoStrip ids={(photos.data ?? []).filter((d) => d.content_type.startsWith("image/")).map((d) => d.id)} onAdd={(s) => addPhoto.mutate(s)} busy={addPhoto.isPending} />
      </Card>
      <Card title="Updates">
        {comments.length === 0 && <T muted>No comments yet.</T>}
        {comments.map((c) => (
          <View key={c.id} style={{ gap: 2, borderLeftWidth: 2, borderLeftColor: c.is_internal ? t.citrine : t.border, paddingLeft: space.md }}>
            <T v="small" muted>
              {c.author_name} · {dateTime(c.created_at)}
              {c.is_internal ? " · Internal" : ""}
            </T>
            <T>{c.body}</T>
          </View>
        ))}
        <Field label="Add an update" value={comment} onChangeText={setComment} multiline placeholder="The tenant sees this" />
        <Button kind="secondary" title="Post update" onPress={() => post.mutate()} disabled={!comment.trim()} loading={post.isPending} />
      </Card>
    </Screen>
  );
}
