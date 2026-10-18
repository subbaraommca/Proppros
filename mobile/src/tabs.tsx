import { Tabs } from "expo-router";
import { Platform } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { fonts, MAX_FONT_SCALE } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

/** Bottom tab bar (DESIGN_GUIDELINES §10.4): icon + label, carnelian active, surface bar with a top rule. */
export function TabBar({ tabs, homeTitle }: { tabs: { name: string; title: string; icon: LucideIcon; badge?: number; href?: null }[]; homeTitle?: string }) {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        headerTintColor: t.textLoud,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, borderTopWidth: 1, ...(Platform.OS === "web" ? { height: 64, paddingTop: 6, paddingBottom: 8 } : null) },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14 },
        tabBarAllowFontScaling: true,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {tabs.map(({ name, title, icon: Icon, badge, href }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            headerTitle: name === "index" && homeTitle ? homeTitle : title,
            href,
            headerShown: !["maintenance", "messages", "money"].includes(name),
            tabBarIcon: ({ color }) => <Icon size={22} color={color} strokeWidth={1.75} />,
            tabBarBadge: badge ? badge : undefined,
            tabBarBadgeStyle: { backgroundColor: t.accent, color: t.onAccent, fontFamily: fonts.bodySemi, fontSize: 11 },
            tabBarAccessibilityLabel: badge ? `${title}, ${badge} unread` : title,
          }}
        />
      ))}
    </Tabs>
  );
}

/** Stack header options for drill-down screens inside a tab. */
export function useStackOptions() {
  const t = useTheme();
  return {
    headerStyle: { backgroundColor: t.bg },
    headerShadowVisible: false,
    headerTintColor: t.textLoud,
    headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
    contentStyle: { backgroundColor: t.bg },
    headerBackButtonDisplayMode: "minimal" as const,
  };
}

export { MAX_FONT_SCALE };
