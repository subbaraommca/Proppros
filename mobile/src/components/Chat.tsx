import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ChatMessage } from "../api/types";
import { dateTime } from "../format";
import { MAX_FONT_SCALE, radius, space, touch, type as typeScale } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { Button, Notice, OfflineBanner, T } from "../ui";

/** Conversation view: bubbles (mine right / theirs left) and a reply bar above the keyboard. */
export function Chat({ messages, mine, onSend, sending, error }: { messages: ChatMessage[]; mine: "staff" | "tenant"; onSend: (body: string) => void; sending: boolean; error?: string | null }) {
  const t = useTheme();
  const [body, setBody] = useState("");
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
  }, [messages.length]);
  const send = () => {
    if (!body.trim()) return;
    onSend(body.trim());
    setBody("");
  };
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          {messages.map((m) => {
            const own = m.author_role === mine;
            return (
              <View key={m.id} style={{ alignSelf: own ? "flex-end" : "flex-start", maxWidth: "82%", gap: 3, alignItems: own ? "flex-end" : "flex-start" }}>
                <View style={{ backgroundColor: own ? t.accentSoft : t.surface, borderWidth: own ? 0 : 1, borderColor: t.borderSubtle, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <T>{m.body}</T>
                </View>
                <T v="small" muted>
                  {m.author_name} · {dateTime(m.created_at)}
                  {m.via === "sms" ? " · by text" : ""}
                </T>
              </View>
            );
          })}
        </ScrollView>
        {error ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <Notice>{error}</Notice>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: t.borderSubtle, alignItems: "flex-end" }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write a message"
            placeholderTextColor={t.textMuted}
            multiline
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Message"
            style={[typeScale.body, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null, { flex: 1, color: t.text, minHeight: touch.button, maxHeight: 140, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, backgroundColor: t.surface }]}
          />
          <View style={{ width: 88 }}>
            <Button title="Send" onPress={send} disabled={!body.trim()} loading={sending} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
