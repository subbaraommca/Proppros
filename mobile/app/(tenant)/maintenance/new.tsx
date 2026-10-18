import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { api, errorMessage } from "../../../src/api/client";
import { appendPhoto, pickPhoto, type Photo } from "../../../src/photos";
import { space } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { Button, Card, Chips, Field, Notice, Screen, T } from "../../../src/ui";

type Category = "plumbing" | "electrical" | "hvac" | "appliance" | "pest" | "general";
type Priority = "low" | "medium" | "high" | "emergency";

export default function NewRequest() {
  const t = useTheme();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<Priority>("medium");
  const [enter, setEnter] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const add = async (source: "camera" | "library") => {
    const p = await pickPhoto(source);
    if (p) setPhotos((x) => [...x, p].slice(0, 6));
  };
  const send = useMutation({
    mutationFn: async () => {
      const wo = await api.post<{ id: string }>("/portal/work-orders", { title, description: description || null, category, priority, permission_to_enter: enter });
      for (const p of photos) {
        const form = new FormData();
        await appendPhoto(form, "file", p);
        await api.upload(`/portal/work-orders/${wo.id}/attachments`, form);
      }
      return wo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-requests"] });
      qc.invalidateQueries({ queryKey: ["portal-home"] });
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({ pathname: "/(tenant)/maintenance", params: { sent: "1" } });
    },
  });
  return (
    <Screen footer={<Button title={send.isPending ? "Sending…" : "Send request"} onPress={() => send.mutate()} disabled={!title.trim()} loading={send.isPending} />}>
      {send.error && <Notice>{errorMessage(send.error)}</Notice>}
      {priority === "emergency" && <Notice tone="garnet">For fire, gas leaks or flooding, call 911 or your landlord's emergency number first.</Notice>}
      <Field label="What's wrong?" value={title} onChangeText={setTitle} placeholder="e.g. Kitchen sink is leaking" maxLength={160} />
      <Field label="Details" value={description} onChangeText={setDescription} multiline placeholder="When did it start? Where exactly?" />
      <Card title="Photos">
        {photos.length > 0 && (
          <ScrollView horizontal contentContainerStyle={{ gap: space.sm }}>
            {photos.map((p, i) => (
              <View key={p.uri}>
                <Image source={{ uri: p.uri }} style={{ width: 96, height: 96, borderRadius: 3 }} accessibilityLabel={`Photo ${i + 1}`} />
                <Pressable onPress={() => setPhotos((x) => x.filter((y) => y !== p))} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} style={{ position: "absolute", top: 4, right: 4, backgroundColor: t.surface, borderRadius: 999, padding: 4 }}>
                  <X size={14} color={t.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Take photo" icon={<Camera size={16} color={t.text} />} onPress={() => add("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Choose photo" icon={<ImagePlus size={16} color={t.text} />} onPress={() => add("library")} />
          </View>
        </View>
      </Card>
      <Chips
        label="Type"
        value={category}
        onChange={setCategory}
        options={[
          { value: "plumbing", label: "Plumbing" },
          { value: "electrical", label: "Electrical" },
          { value: "hvac", label: "Heating / AC" },
          { value: "appliance", label: "Appliance" },
          { value: "pest", label: "Pests" },
          { value: "general", label: "Other" },
        ]}
      />
      <Chips
        label="How urgent?"
        value={priority}
        onChange={setPriority}
        options={[
          { value: "low", label: "Can wait" },
          { value: "medium", label: "Soon" },
          { value: "high", label: "Urgent" },
          { value: "emergency", label: "Emergency" },
        ]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 }}>
        <T style={{ flex: 1 }}>OK to enter if I'm not home</T>
        <Switch value={enter} onValueChange={setEnter} trackColor={{ true: t.accent, false: t.border }} accessibilityLabel="Permission to enter if I'm not home" />
      </View>
    </Screen>
  );
}
