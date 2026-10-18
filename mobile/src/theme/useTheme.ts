import { useColorScheme } from "react-native";
import { dark, light, type Theme } from "./tokens";

export function useTheme(): Theme {
  return useColorScheme() === "light" ? light : dark;
}
