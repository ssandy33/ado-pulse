import { readSettings } from "./settings";

export interface SevenPaceConfig {
  apiToken: string;
  baseUrl: string;
}

export class SevenPaceApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "SevenPaceApiError";
  }
}

export async function getSevenPaceConfig(): Promise<SevenPaceConfig | null> {
  const settings = await readSettings();
  const sp = settings.integrations?.sevenPace;
  if (!sp?.apiToken || !sp?.baseUrl) return null;
  return { apiToken: sp.apiToken, baseUrl: sp.baseUrl };
}

export async function sevenPaceFetch<T>(
  config: SevenPaceConfig,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const base = config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/";
  // Build query string manually to preserve literal $ in param keys
  // (URLSearchParams encodes $ as %24 which 7pace doesn't recognise)
  let urlStr = new URL(path, base).toString();
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    urlStr += (urlStr.includes("?") ? "&" : "?") + qs;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(urlStr, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 401) {
      throw new SevenPaceApiError("Invalid 7pace token", 401, "AUTH_ERROR");
    }

    if (!res.ok) {
      throw new SevenPaceApiError(
        `7pace API error: ${res.status} ${res.statusText}`,
        res.status,
        "API_ERROR"
      );
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof SevenPaceApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SevenPaceApiError("7pace API request timed out", 504, "TIMEOUT");
    }
    throw new SevenPaceApiError("7pace unavailable", 503, "UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

// ── Data fetchers ──────────────────────────────────────────────

interface SevenPaceUser {
  id: string;
  email?: string;
  uniqueName?: string;
  displayName?: string;
}

interface SevenPaceUsersResponse {
  data: SevenPaceUser[];
}

export async function getSevenPaceUsers(
  config: SevenPaceConfig
): Promise<Map<string, string>> {
  const result = await sevenPaceFetch<SevenPaceUsersResponse>(config, "users", {
    "api-version": "3.0",
  });

  // Map 7pace user ID → ADO uniqueName (email)
  const map = new Map<string, string>();
  for (const user of result.data ?? []) {
    const uniqueName = user.uniqueName || user.email;
    if (uniqueName) {
      map.set(user.id, uniqueName);
    }
  }
  return map;
}

export interface SevenPaceWorklog {
  id: string;
  userId: string;
  uniqueName: string;
  workItemId: number;
  hours: number;
  date: string;
}

interface RawWorklogUser {
  id: string;
  uniqueName?: string;
  name?: string;
  vstsId?: string;
}

interface RawWorklog {
  id: string;
  user?: RawWorklogUser;
  workItemId?: number | null;
  length: number; // seconds
  timestamp: string;
}

interface SevenPaceWorklogsResponse {
  data: RawWorklog[];
}

export interface SevenPaceWorklogsResult {
  worklogs: SevenPaceWorklog[];
  rawResponseKeys: string[];
  rawCount: number;
  requestUrl: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function getSevenPaceWorklogs(
  config: SevenPaceConfig,
  from: Date,
  to: Date
): Promise<SevenPaceWorklogsResult> {
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);

  const params = {
    "api-version": "3.0",
    "$fromTimestamp": fromStr,
    "$toTimestamp": toStr,
    "$count": "500",
  };

  // Build URL for diagnostics (use literal $ — matches actual request)
  const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/";
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const requestUrl = `${baseUrl}workLogs?${qs}`;

  // Fetch raw to inspect response shape
  const result = await sevenPaceFetch<Record<string, unknown>>(
    config,
    "workLogs",
    params
  );

  const rawResponseKeys = Object.keys(result);

  // Try common response shapes: { data: [...] }, { value: [...] }, or top-level array
  let rawWorklogs: RawWorklog[] = [];
  if (Array.isArray(result.data)) {
    rawWorklogs = result.data;
  } else if (Array.isArray(result.value)) {
    rawWorklogs = result.value as RawWorklog[];
  } else if (Array.isArray(result)) {
    rawWorklogs = result as unknown as RawWorklog[];
  }

  const worklogs = rawWorklogs.map((wl) => ({
    id: wl.id,
    userId: wl.user?.id ?? "",
    uniqueName: wl.user?.uniqueName ?? "",
    workItemId: wl.workItemId ?? 0,
    hours: wl.length / 3600,
    date: wl.timestamp,
  }));

  return {
    worklogs,
    rawResponseKeys,
    rawCount: rawWorklogs.length,
    requestUrl,
  };
}
