/**
 * Registers this phone for push notifications after sign-in (DESIGN_GUIDELINES §10.7):
 * asks permission in context, sends the Expo push token to the API, and keeps it current.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let currentToken: string | null = null;

async function getToken(ask: boolean): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null; // simulators and web have no push token
  const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) || process.env.EXPO_PUBLIC_PROJECT_ID;
  if (!projectId) return null; // not linked to EAS yet (`eas init`)
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Proppros updates", importance: Notifications.AndroidImportance.HIGH });
  }
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

async function sync(token: string) {
  currentToken = token;
  try {
    await api.post("/auth/devices", { token, platform: Platform.OS });
  } catch {
    /* non-critical */
  }
}

export async function unregisterPush() {
  if (!currentToken) return;
  try {
    await api.post("/auth/devices/unregister", { token: currentToken, platform: Platform.OS });
  } catch {
    /* best effort */
  }
  currentToken = null;
}

export function usePush(signedIn: boolean, onOpen: (data: Record<string, unknown>) => void) {
  useEffect(() => {
    if (!signedIn || Platform.OS === "web") return;
    getToken(true).then((t) => {
      if (t) void sync(t);
    });
    const rotate = Notifications.addPushTokenListener(({ data }) => {
      if (data) void sync(String(data));
    });
    const tap = Notifications.addNotificationResponseReceivedListener((r) => onOpen((r.notification.request.content.data ?? {}) as Record<string, unknown>));
    return () => {
      rotate.remove();
      tap.remove();
    };
  }, [signedIn, onOpen]);
}
