import { Tabs } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { Platform } from "react-native";
import { BrandBar } from "./ui";
import { fonts } from "./theme/tokens";
import { useTheme } from "./theme/useTheme";

/**
 * Bottom tab bar (DESIGN_GUIDELINES §10.4). Like the web sidebar, the brand bar on top and the tab bar
 * stay dark in both themes; the active tab is carnelian.
 */
export function TabBar({ tabs }: { tabs: { name: string; title: string; icon: LucideIcon; badge?: number; href?: null }[] }) {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        header: () => <BrandBar />,
        tabBarActiveTintColor: t.barAccent,
        tabBarInactiveTintColor: t.barText,
        tabBarStyle: { backgroundColor: t.bar, borderTopColor: t.barLine, borderTopWidth: 1, ...(Platform.OS === "web" ? { height: 64, paddingTop: 6, paddingBottom: 8 } : null) },
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
            href,
            headerShown: !["maintenance", "messages", "money"].includes(name),
            tabBarIcon: ({ color }) => <Icon size={22} color={color} strokeWidth={1.75} />,
            tabBarBadge: badge ? badge : undefined,
            tabBarBadgeStyle: { backgroundColor: t.barAccent, color: t.bar, fontFamily: fonts.bodySemi, fontSize: 11 },
            tabBarAccessibilityLabel: badge ? `${title}, ${badge} unread` : title,
          }}
        />
      ))}
    </Tabs>
  );
}

/** Stack screens inside a tab: the first screen shows its own page title, drill-downs get a dark bar with Back. */
export function useStackOptions() {
  const t = useTheme();
  return {
    headerStyle: { backgroundColor: t.bar },
    headerShadowVisible: false,
    headerTintColor: t.barTextActive,
    headerTitleStyle: { fontFamily: fonts.display, fontSize: 17, color: t.barTextActive },
    contentStyle: { backgroundColor: t.bg },
    headerBackButtonDisplayMode: "minimal" as const,
  };
}
