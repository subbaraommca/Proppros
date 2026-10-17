import i18n from "../i18n";

/** BCP-47 locale for Intl formatting, following the active UI language. */
function locale(): string {
  return i18n.language === "en" ? "en-US" : i18n.language;
}

export function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale(), { style: "currency", currency }).format(cents / 100);
}

/** "1,250.50" or "1250.5" → 125050. Returns null for blank/invalid input. */
export function toCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Dates from the API are "YYYY-MM-DD" (calendar dates) — format without timezone shifts. */
export function date(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale(), { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Human label for an API enum value (status, category, role…) via the `enums` locale section. */
export function label(value: string | null | undefined): string {
  if (!value) return "";
  const fallback = value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return i18n.t(`enums.${value}`, { defaultValue: fallback });
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "short" });
}

/** 1 → "1st", 22 → "22nd" (language-aware ordinal rules via i18next). */
export function ordinal(n: number): string {
  return i18n.t("format.ordinal", { count: n, ordinal: true });
}
