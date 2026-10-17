/**
 * API client (same shape as Pickzona's): JSON in/out, httpOnly cookie auth,
 * and the active organization sent as X-Org-Id.
 */
const ORG_KEY = "pp-org";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function setOrgId(id: string | null) {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {
    /* storage unavailable */
  }
}

function toUserMessage(status: number, detail: unknown): string {
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: string[] } | undefined;
    if (first?.msg) {
      const field = first.loc?.[first.loc.length - 1];
      return field ? `${String(field).replace(/_/g, " ")}: ${first.msg.replace(/^Value error, /, "")}` : first.msg;
    }
    return "Please check your input and try again.";
  }
  if (typeof detail === "string" && detail) return detail;
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  return `Request failed (${status})`;
}

export function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "An unexpected error occurred.";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
  const org = getOrgId();
  if (org) headers["X-Org-Id"] = org;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects on network failure (offline, DNS, CORS) — never show "Failed to fetch".
    throw new ApiError(0, "Can't reach Proppros. Check your internet connection and try again.");
  }
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* not JSON */
    }
    if (res.status === 403 && detail === "You are not a member of this organization.") setOrgId(null);
    throw new ApiError(res.status, toUserMessage(res.status, detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};

/** URL for a file/PDF endpoint (opened in a new tab; the cookie authenticates it). */
export function fileUrl(path: string): string {
  const org = getOrgId();
  return `/api${path}${org ? `${path.includes("?") ? "&" : "?"}org=${org}` : ""}`;
}
