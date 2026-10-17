import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

/**
 * Supported UI languages. To add one: create src/locales/<code>.json with the same
 * keys as en.json, import it below, and add it to LANGUAGES. The language picker in
 * Settings → My account appears automatically once there is more than one.
 */
export const LANGUAGES: { code: string; name: string }[] = [{ code: "en", name: "English" }];

const resources = { en: { translation: en } };
const STORAGE_KEY = "pp-lang";

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in resources) return saved;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function setLanguage(code: string) {
  void i18n.changeLanguage(code);
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
