/** Strata components for the app (DESIGN_GUIDELINES §10). Colors come from tokens via useTheme — never hard-coded. */
import NetInfo from "@react-native-community/netinfo";
import { ChevronRight, WifiOff } from "lucide-react-native";
import { useEffect, useState, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MAX_FONT_SCALE, radius, space, touch, type as typeScale, type Theme } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

type TextVariant = keyof typeof typeScale;

export function T({ v = "body", muted, loud, color, style, children, numberOfLines }: { v?: TextVariant; muted?: boolean; loud?: boolean; color?: string; style?: TextStyle; children: ReactNode; numberOfLines?: number }) {
  const t = useTheme();
  const base = typeScale[v];
  const c = color ?? (muted ? t.textMuted : loud || v === "title" || v === "hero" || v === "stat" ? t.textLoud : v === "eyebrow" ? t.textMuted : t.text);
  return (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={numberOfLines} style={[base, { color: c }, style]}>
      {children}
    </Text>
  );
}

export function OfflineBanner() {
  const t = useTheme();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: t.citrineSoft, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }} accessibilityRole="alert">
      <WifiOff size={14} color={t.citrine} />
      <T v="small" color={t.citrine}>
        You're offline — changes will be sent when you reconnect.
      </T>
    </View>
  );
}

/** Safe-area screen with optional pull-to-refresh and a pinned bottom action. */
export function Screen({ children, onRefresh, refreshing = false, footer, scroll = true }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; footer?: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        {content}
        {footer && <View style={{ padding: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: t.borderSubtle, backgroundColor: t.bg }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ title, right, children, padded = true, glow = false }: { title?: string; right?: ReactNode; children: ReactNode; padded?: boolean; glow?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: glow ? t.accent : t.border, borderRadius: radius.xs }}>
      {title && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.borderSubtle }}>
          <T v="section">{title}</T>
          {right}
        </View>
      )}
      <View style={padded ? { padding: space.lg, gap: space.md } : undefined}>{children}</View>
    </View>
  );
}

export function Button({ title, onPress, kind = "primary", disabled, loading, icon, accessibilityLabel }: { title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; disabled?: boolean; loading?: boolean; icon?: ReactNode; accessibilityLabel?: string }) {
  const t = useTheme();
  const styles: Record<string, ViewStyle> = {
    primary: { backgroundColor: t.accent, borderRadius: radius.none },
    secondary: { borderWidth: 1, borderColor: t.border, borderRadius: radius.xs },
    danger: { borderWidth: 1, borderColor: t.garnet, borderRadius: radius.xs },
    ghost: {},
  };
  const color = kind === "primary" ? t.onAccent : kind === "danger" ? t.garnet : kind === "ghost" ? t.accent : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      style={({ pressed }) => [
        { minHeight: touch.button, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        styles[kind],
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon}
      <T v="label" color={color} style={{ fontFamily: "DMSans_600SemiBold", fontSize: 15 }}>
        {title}
      </T>
    </Pressable>
  );
}

export function Field({ label, hint, error, prefix, ref, ...props }: TextInputProps & { label: string; hint?: string; error?: string; prefix?: string; ref?: Ref<TextInput> }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: touch.button, borderWidth: 1, borderColor: error ? t.garnet : focused ? t.accent : t.border, borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: t.surface }}>
        {prefix && (
          <T v="money" muted style={{ marginRight: 4 }}>
            {prefix}
          </T>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textMuted}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          {...props}
          style={[typeScale.body, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null, { flex: 1, color: t.text, paddingVertical: 10, textAlignVertical: props.multiline ? "top" : "center", minHeight: props.multiline ? 96 : undefined }, prefix ? { fontFamily: "JetBrainsMono_500Medium" } : null]}
        />
      </View>
      {error ? <T v="small" color={t.garnet}>{error}</T> : hint ? <T v="small" muted>{hint}</T> : null}
    </View>
  );
}

const TONES: Record<string, keyof Theme> = {
  active: "jade", completed: "jade", paid: "jade", succeeded: "jade", occupied: "jade",
  in_progress: "citrine", high: "citrine", vacant: "citrine", pending: "citrine", processing: "citrine",
  emergency: "garnet", overdue: "garnet", failed: "garnet",
  new: "lapis", scheduled: "lapis", assigned: "lapis", medium: "lapis",
};

export function Badge({ value, text }: { value: string; text?: string }) {
  const t = useTheme();
  const tone = TONES[value];
  const fg = tone ? (t[tone] as string) : t.textMuted;
  const bg = tone ? (t[`${tone}Soft` as keyof Theme] as string) : t.surfaceMuted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <T v="eyebrow" color={fg} style={{ textTransform: "none", letterSpacing: 0 }}>
        {text ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
      </T>
    </View>
  );
}

/** List row (§10.3): title, meta line, right side (amount/badge), chevron when it navigates. */
export function Row({ title, meta, right, onPress, first }: { title: string; meta?: string; right?: ReactNode; onPress?: () => void; first?: boolean }) {
  const t = useTheme();
  const inner = (
    <View style={{ minHeight: touch.row, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: "row", alignItems: "center", gap: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: t.borderSubtle }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2}>{title}</T>
        {meta ? (
          <T v="small" muted numberOfLines={2}>
            {meta}
          </T>
        ) : null}
      </View>
      {right}
      {onPress && <ChevronRight size={18} color={t.textMuted} />}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={meta ? `${title}, ${meta}` : title} style={({ pressed }) => ({ backgroundColor: pressed ? t.surfaceMuted : "transparent" })}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm }}>
      {icon}
      <T v="section" style={{ textAlign: "center" }}>
        {title}
      </T>
      {body && (
        <T v="small" muted style={{ textAlign: "center" }}>
          {body}
        </T>
      )}
      {action}
    </View>
  );
}

export function Notice({ tone = "garnet", children, action }: { tone?: "garnet" | "jade" | "lapis" | "citrine"; children: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t[`${tone}Soft` as keyof Theme] as string, borderLeftWidth: 2, borderLeftColor: t[tone], padding: space.md, gap: space.sm }} accessibilityRole={tone === "garnet" ? "alert" : undefined}>
      <T v="small" color={t[tone]}>
        {children}
      </T>
      {action}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T v="eyebrow">{label}</T>
      <T v="stat">{value}</T>
      {sub ? (
        <T v="small" muted>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

/** Choice chips that wrap onto new lines, so every option (and the selected one) stays visible. */
export function Chips<V extends string>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{ minHeight: touch.min, paddingHorizontal: space.lg, justifyContent: "center", borderRadius: radius.xs, borderWidth: 1, borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentSoft : "transparent" }}
            >
              <T v="label" color={active ? t.accent : t.text}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const s = StyleSheet.create({ row: { flexDirection: "row", gap: space.md } });
