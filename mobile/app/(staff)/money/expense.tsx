import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { api, errorMessage } from "../../../src/api/client";
import { toCents, todayISO } from "../../../src/format";
import { appendPhoto, pickPhoto, type Photo } from "../../../src/photos";
import { space } from "../../../src/theme/tokens";
import { useTheme } from "../../../src/theme/useTheme";
import { Button, Card, Chips, Field, Loading, Notice, Screen, T } from "../../../src/ui";

type Category = "repairs" | "cleaning_maintenance" | "supplies" | "utilities" | "insurance" | "taxes" | "hoa" | "other";
const CATEGORIES: { value: Category; label: string }[] = [
  { value: "repairs", label: "Repairs" },
  { value: "cleaning_maintenance", label: "Cleaning" },
  { value: "supplies", label: "Supplies" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "taxes", label: "Taxes" },
  { value: "hoa", label: "HOA" },
  { value: "other", label: "Other" },
];

export default function AddExpense() {
  const t = useTheme();
  const qc = useQueryClient();
  const props = useQuery({ queryKey: ["properties"], queryFn: () => api.get<{ id: string; name: string }[]>("/properties") });
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("repairs");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [when, setWhen] = useState(todayISO());
  const [photo, setPhoto] = useState<Photo | null>(null);
  const prop = propertyId ?? props.data?.[0]?.id ?? null;
  const take = async (source: "camera" | "library") => {
    const p = await pickPhoto(source);
    if (p) setPhoto(p);
  };
  const save = useMutation({
    mutationFn: async () => {
      let receipt_document_id: string | null = null;
      if (photo) {
        const form = new FormData();
        await appendPhoto(form, "file", photo);
        form.append("owner_type", "property");
        form.append("owner_id", String(prop));
        form.append("kind", "receipt");
        receipt_document_id = (await api.upload<{ id: string }>("/documents", form)).id;
      }
      return api.post("/expenses", { property_id: prop, category, amount_cents: toCents(amount), expense_date: when, vendor: vendor || null, receipt_document_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace({ pathname: "/(staff)/money", params: { done: "expense" } });
    },
  });
  if (props.isLoading) return <Screen><Loading /></Screen>;
  return (
    <Screen footer={<Button title="Save expense" onPress={() => save.mutate()} disabled={!prop || !toCents(amount)} loading={save.isPending} />}>
      {save.error && <Notice>{errorMessage(save.error)}</Notice>}
      <Card title="Receipt">
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={{ width: "100%", height: 220, borderRadius: 3, backgroundColor: t.surfaceMuted }} resizeMode="contain" accessibilityLabel="Receipt photo" />
            <Pressable onPress={() => setPhoto(null)} accessibilityRole="button" accessibilityLabel="Remove receipt photo" hitSlop={12} style={{ position: "absolute", top: 8, right: 8, backgroundColor: t.surface, borderRadius: 999, padding: 6 }}>
              <X size={16} color={t.text} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" title="Take photo" icon={<Camera size={16} color={t.text} />} onPress={() => take("camera")} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" title="Choose photo" icon={<ImagePlus size={16} color={t.text} />} onPress={() => take("library")} />
            </View>
          </View>
        )}
        <T v="small" muted>
          The receipt is kept with the expense for tax time.
        </T>
      </Card>
      <Field label="Amount" prefix="$" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {(props.data?.length ?? 0) > 1 && <Chips label="Property" value={prop ?? ""} onChange={setPropertyId} options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />}
      <Chips label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
      <Field label="Vendor (optional)" value={vendor} onChangeText={setVendor} placeholder="e.g. Home Depot" />
      <Field label="Date" hint="YYYY-MM-DD" value={when} onChangeText={setWhen} keyboardType="numbers-and-punctuation" />
    </Screen>
  );
}
