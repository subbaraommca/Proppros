import { Stack } from "expo-router";
import { useStackOptions } from "../../../src/tabs";
import { BrandBar } from "../../../src/ui";

// Deep links and cross-tab pushes land on top of the list, so Back always has somewhere to go.
export const unstable_settings = { initialRouteName: "index" };

export default function Layout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: "Money", header: () => <BrandBar /> }} />
      <Stack.Screen name="payment" options={{ title: "Record payment" }} />
      <Stack.Screen name="expense" options={{ title: "Add expense" }} />
    </Stack>
  );
}
