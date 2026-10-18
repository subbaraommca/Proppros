// Strata design tokens for the app — mirrors the web `--pp-*` variables (docs/DESIGN_GUIDELINES.md).
// Use these, never raw hex values, in components.

export const dark = {
  bg: "#111217",
  surface: "#16171d",
  surfaceMuted: "#1b1d24",
  border: "#2c2e37",
  borderSubtle: "#22242c",
  text: "#e6dfd8",
  textMuted: "#9c9aa3",
  textLoud: "#ffffff",
  accent: "#edaf88", // carnelian
  accentSoft: "#342c2c",
  onAccent: "#111217",
  jade: "#62ba9e",
  jadeSoft: "#212e2f",
  citrine: "#d9b45b",
  citrineSoft: "#312d26",
  garnet: "#db7b7b",
  garnetSoft: "#32252a",
  lapis: "#93a8e2",
  lapisSoft: "#282b39",
};

export const light: typeof dark = {
  bg: "#f6f4f0",
  surface: "#ffffff",
  surfaceMuted: "#f1eee9",
  border: "#e1dcd4",
  borderSubtle: "#ece8e2",
  text: "#2b2724",
  textMuted: "#6b6560",
  textLoud: "#14110f",
  accent: "#a4502a",
  accentSoft: "#f5ece8",
  onAccent: "#ffffff",
  jade: "#26705a",
  jadeSoft: "#e7efed",
  citrine: "#7d5f0f",
  citrineSoft: "#f1ede5",
  garnet: "#b03a3a",
  garnetSoft: "#f6e9e9",
  lapis: "#3e58a8",
  lapisSoft: "#eaedf5",
};

export type Theme = typeof dark;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { none: 0, xs: 2, sm: 3, md: 6, pill: 999 };

// Families loaded in app/_layout.tsx (DESIGN_GUIDELINES §10.2).
export const fonts = {
  display: "Archivo_700Bold",
  displaySemi: "Archivo_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemi: "DMSans_600SemiBold",
  mono: "JetBrainsMono_500Medium",
};

export const type = {
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  hero: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  stat: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  section: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" as const },
  money: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 22 },
};

export const touch = { min: 44, button: 48, row: 56 };
export const MAX_FONT_SCALE = 1.3;
