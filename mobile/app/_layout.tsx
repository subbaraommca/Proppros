import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, isStaff, useAuth } from "../src/auth/AuthContext";
import { usePush } from "../src/push/usePush";
import { queryClient } from "../src/queryClient";
import { ThemeProvider, useAppearance } from "../src/theme/useTheme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function PushRouting() {
  const { me, org } = useAuth();
  const open = useCallback(
    (data: Record<string, unknown>) => {
      const id = typeof data.id === "string" ? data.id : "";
      const staff = isStaff(org);
      switch (data.type) {
        case "work_order":
          if (staff) router.push(`/(staff)/maintenance/${id}`);
          break;
        case "portal_work_order":
          router.push(`/(tenant)/maintenance/${id}`);
          break;
        case "thread":
          if (staff) router.push(`/(staff)/messages/${id}`);
          break;
        case "portal_thread":
          router.push(`/(tenant)/messages/${id}`);
          break;
        default:
          router.push(staff ? "/(staff)" : "/(tenant)");
      }
    },
    [org],
  );
  usePush(!!me, open);
  return null;
}

function Shell() {
  const { theme: t } = useAppearance();
  const { loading } = useAuth();
  const [fontsLoaded] = useFonts({
    // Archivo at the web's 112% width (assets/fonts, generated from the web's variable font; OFL).
    "ArchivoSE-Bold": require("../assets/fonts/Archivo-SemiExpanded-Bold.ttf"),
    "ArchivoSE-SemiBold": require("../assets/fonts/Archivo-SemiExpanded-SemiBold.ttf"),
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    JetBrainsMono_500Medium,
  });
  useEffect(() => {
    if (fontsLoaded && !loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, loading]);
  if (!fontsLoaded || loading) return null; // splash stays up (§10.2, §10.12)
  return (
    <>
      <StatusBar style="light" />
      <PushRouting />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
