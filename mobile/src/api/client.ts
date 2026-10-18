import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// EXPO_PUBLIC_* values are baked into the bundle — never put secrets here.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ?? (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? "https://proppros.vercel.app/api";

const TOKEN_KEY = "proppros_token";
const ORG_KEY = "proppros_org";

// SecureStore is native-only; the web build (used for previews) falls back to localStorage.
const store = {
  async get(key: string): Promise<string | null> {
    try {
      return Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (value === null) globalThis.localStorage?.removeItem(key);
        else globalThis.localStorage?.setItem(key, value);
      } else if (value === null) await SecureStore.deleteItemAsync(key);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      /* best effort: the user signs in again */
    }
  },
};

/** Small non-secret preferences (e.g. appearance). */
export const readPref = (key: string) => store.get(key);
export const writePref = (key: string, value: string | null) => store.set(key, value);

let token: string | null = null;
let orgId: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadSession(): Promise<{ token: string | null; orgId: string | null }> {
  token = await store.get(TOKEN_KEY);
  orgId = await store.get(ORG_KEY);
  return { token, orgId };
}
export async function setToken(value: string | null) {
  token = value;
  await store.set(TOKEN_KEY, value);
}
export async function setOrgId(value: string | null) {
  orgId = value;
  await store.set(ORG_KEY, value);
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Plain-language message for any error (DESIGN_GUIDELINES §10.9 — never show HTTP codes). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "Can't reach Proppros. Check your connection and try again.";
    if (e.status >= 500) return "Something went wrong on our side. Please try again.";
    return e.message || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

async function request<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers["X-Org-Id"] = orgId;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(0, "offline");
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const detail = data?.detail;
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? "Please check the highlighted fields." : "";
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, undefined, form),
};

/** Headers for <Image> sources that load protected files from the API. */
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (orgId) h["X-Org-Id"] = orgId;
  return h;
}
