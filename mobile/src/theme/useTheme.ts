import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { readPref, writePref } from "../api/client";
import { dark, light, type Theme } from "./tokens";

/** Appearance (DESIGN_GUIDELINES §10.1): dark-first like the web; the user can pick Light or Match phone in More. */
export type Appearance = "dark" | "light" | "system";
const KEY = "proppros_appearance";

interface ThemeValue {
  theme: Theme;
  scheme: "dark" | "light";
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
}

const ThemeContext = createContext<ThemeValue>({ theme: dark, scheme: "dark", appearance: "dark", setAppearance: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>("dark");
  useEffect(() => {
    readPref(KEY).then((v) => {
      if (v === "light" || v === "system" || v === "dark") setAppearanceState(v);
    });
  }, []);
  const scheme: "dark" | "light" = appearance === "system" ? (system === "light" ? "light" : "dark") : appearance;
  const value: ThemeValue = {
    theme: scheme === "light" ? light : dark,
    scheme,
    appearance,
    setAppearance: (a) => {
      setAppearanceState(a);
      void writePref(KEY, a);
    },
  };
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useAppearance() {
  return useContext(ThemeContext);
}
