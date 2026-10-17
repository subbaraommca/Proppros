/**
 * Every translation key used in the code must exist in en.json (otherwise the UI shows the raw key),
 * and every other locale must have exactly the same keys as en.json.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "./en.json";

type Tree = { [k: string]: string | Tree };
const SRC = join(__dirname, "..");
const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other", "_ordinal_one", "_ordinal_two", "_ordinal_few", "_ordinal_other"];

function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : flatten(v, `${prefix}${k}.`)));
}

const keys = new Set(flatten(en as Tree));
const has = (key: string) => keys.has(key) || PLURAL_SUFFIXES.some((s) => keys.has(key + s));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx?|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("locales", () => {
  it("every static t()/i18nKey key used in the code exists in en.json", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, "utf-8");
      const patterns = [/\bt\(\s*"([a-zA-Z0-9_.]+)"/g, /i18nKey="([a-zA-Z0-9_.]+)"/g, /i18n\.t\(\s*"([a-zA-Z0-9_.]+)"/g];
      for (const re of patterns) {
        for (const m of text.matchAll(re)) if (!has(m[1])) missing.push(`${m[1]}  (${file.replace(SRC, "src")})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keys built dynamically from lists exist", () => {
    const dynamic = [
      ...["dashboard", "properties", "tenants", "leases", "payments", "expenses", "maintenance", "documents", "reports", "settings"].map((k) => `nav.${k}`),
      ...["portfolio", "money", "operations", "account"].map((k) => `nav.group_${k}`),
      ...["hero_point_rent", "hero_point_records", "hero_point_maintenance", "hero_point_reports"].map((k) => `auth.${k}`),
      ...["rent_reminders", "maintenance_updates", "lease_expiry", "document_expiry"].map((k) => `settings.pref_${k}`),
    ];
    expect(dynamic.filter((k) => !has(k))).toEqual([]);
  });

  it("every API enum value has a label", () => {
    const values = [
      "single_family", "multi_family", "condo", "townhouse", "commercial", "other",
      "vacant", "occupied", "maintenance", "active", "ended",
      "parking", "pet", "utility", "storage",
      "rent", "recurring", "late_fee", "payment", "credit", "adjustment", "opening_balance", "charge",
      "cash", "check", "zelle", "venmo", "bank_transfer", "card",
      "advertising", "auto_travel", "cleaning_maintenance", "commissions", "insurance", "legal_professional", "management_fees",
      "mortgage_interest", "other_interest", "repairs", "supplies", "taxes", "utilities", "hoa", "capital_improvement",
      "plumbing", "electrical", "hvac", "appliance", "pest", "roof", "landscaping", "general",
      "low", "medium", "high", "emergency", "new", "assigned", "scheduled", "in_progress", "completed", "closed",
      "photo", "lease", "deed", "inspection", "receipt", "invoice", "license", "id",
      "owner", "manager", "accountant", "tenant", "vendor",
    ];
    expect(values.filter((v) => !has(`enums.${v}`))).toEqual([]);
  });

  it("other locales have exactly the same keys as en.json", () => {
    const dir = __dirname;
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".json") && n !== "en.json")) {
      const other = new Set(flatten(JSON.parse(readFileSync(join(dir, name), "utf-8")) as Tree));
      expect({ file: name, missing: [...keys].filter((k) => !other.has(k)) }).toEqual({ file: name, missing: [] });
    }
  });
});
