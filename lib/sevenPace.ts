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
  const url = new URL(path, config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url.toString(), {
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

export async function getSevenPaceWorklogs(
  config: SevenPaceConfig,
  from: Date,
  to: Date
): Promise<SevenPaceWorklog[]> {
  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  const result = await sevenPaceFetch<SevenPaceWorklogsResponse>(
    config,
    "workLogs",
    {
      "api-version": "3.0",
      "$fromTimestamp": fromStr,
      "$toTimestamp": toStr,
      "$count": "500",
    }
  );

  return (result.data ?? []).map((wl) => ({
    id: wl.id,
    userId: wl.user?.id ?? "",
    uniqueName: wl.user?.uniqueName ?? "",
    workItemId: wl.workItemId ?? 0,
    hours: wl.length / 3600,
    date: wl.timestamp,
  }));
}
