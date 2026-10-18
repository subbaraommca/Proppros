import { Camera, ImagePlus } from "lucide-react-native";
import { Image, ScrollView, View } from "react-native";
import { API_BASE, authHeaders } from "../api/client";
import { space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { Button, T } from "../ui";

/** Thumbnails of photos stored in the API, plus Take photo / Choose photo buttons. */
export function PhotoStrip({ ids, onAdd, busy, canAdd = true }: { ids: string[]; onAdd: (source: "camera" | "library") => void; busy?: boolean; canAdd?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {ids.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {ids.map((id) => (
            <Image
              key={id}
              source={{ uri: `${API_BASE}/documents/${id}/file`, headers: authHeaders() }}
              style={{ width: 96, height: 96, borderRadius: 3, backgroundColor: t.surfaceMuted }}
              accessibilityLabel="Photo"
            />
          ))}
        </ScrollView>
      ) : (
        <T v="small" muted>
          No photos yet.
        </T>
      )}
      {canAdd && (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Take photo" icon={<Camera size={16} color={t.text} />} onPress={() => onAdd("camera")} loading={busy} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" title="Choose photo" icon={<ImagePlus size={16} color={t.text} />} onPress={() => onAdd("library")} disabled={busy} />
          </View>
        </View>
      )}
    </View>
  );
}
