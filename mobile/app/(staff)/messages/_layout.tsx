import { Stack } from "expo-router";
import { useStackOptions } from "../../../src/tabs";

// Deep links and cross-tab pushes land on top of the list, so Back always has somewhere to go.
export const unstable_settings = { initialRouteName: "index" };

export default function Layout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
    </Stack>
  );
}
