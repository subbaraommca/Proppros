import { Archivo_600SemiBold, Archivo_700Bold } from "@expo-google-fonts/archivo";
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, isStaff, useAuth } from "../src/auth/AuthContext";
import { usePush } from "../src/push/usePush";
import { queryClient } from "../src/queryClient";
import { useTheme } from "../src/theme/useTheme";

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
  const t = useTheme();
  const scheme = useColorScheme();
  const { loading } = useAuth();
  const [fontsLoaded] = useFonts({ Archivo_600SemiBold, Archivo_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, JetBrainsMono_500Medium });
  useEffect(() => {
    if (fontsLoaded && !loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, loading]);
  if (!fontsLoaded || loading) return null; // splash stays up (§10.2, §10.12)
  return (
    <>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <PushRouting />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
