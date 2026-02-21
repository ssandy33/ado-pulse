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

// ── Types ─────────────────────────────────────────────────────

export interface PaginationInfo {
  pagesFetched: number;
  totalRecords: number;
  hitSafetyCap: boolean;
}

interface SevenPaceUser {
  id: string;
  email?: string;
  uniqueName?: string;
  displayName?: string;
}

interface SevenPaceUsersResponse {
  data: SevenPaceUser[];
}

export interface SevenPaceWorklog {
  id: string;
  userId: string;
  uniqueName: string;
  displayName: string;
  workItemId: number;
  hours: number;
  date: string;
  activityType?: string;
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
  activityType?: { name?: string } | null;
}

export interface SevenPaceWorklogsResult {
  worklogs: SevenPaceWorklog[];
  rawResponseKeys: string[];
  rawCount: number;
  requestUrl: string;
  unfilteredCount?: number;
  pagination?: PaginationInfo;
  fetchApi: "odata" | "rest";
}

// ── OData types (7Pace Reporting API) ─────────────────────────

interface ODataWorklog {
  Id: string;
  UserId: string;
  WorkItemId: number | null;
  PeriodLength: number; // seconds
  Timestamp: string;
  User?: { Id: string; Name: string; Email: string };
  ActivityType?: { Id: string; Name: string; Color: string } | null;
}

interface ODataResponse {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: ODataWorklog[];
}

// ── Data fetchers ──────────────────────────────────────────────

export async function getSevenPaceUsers(
  config: SevenPaceConfig
): Promise<Map<string, string>> {
  const result = await sevenPaceFetch<SevenPaceUsersResponse>(config, "users", {
    "api-version": "3.2",
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

function toDateStr(d: Date): string {
  // 7pace expects datetime format: 2021-11-06T10:28:00
  return d.toISOString().split(".")[0];
}

function toISODate(d: Date): string {
  return d.toISOString();
}

// ── OData per-user fetch (preferred) ──────────────────────────

const ODATA_MAX_PAGES = 10; // safety cap: prevent runaway pagination

/**
 * Fetch worklogs for a specific user via the OData Reporting API.
 * This endpoint supports real server-side user filtering via
 * `worklogsFilter=User/Email eq 'email'`, unlike the REST
 * `/workLogs/all` endpoint where `_userId` is silently ignored.
 */
export async function getWorklogsForUser(
  config: SevenPaceConfig,
  email: string,
  from: Date,
  to: Date
): Promise<SevenPaceWorklogsResult> {
  // Derive the OData base from the configured REST base URL.
  // e.g. "https://arrivia.timehub.7pace.com/api/rest" → "https://arrivia.timehub.7pace.com"
  const origin = config.baseUrl.replace(/\/api\/rest\/?$/, "").replace(/\/+$/, "");
  const odataBase = `${origin}/api/odata/v3.2/workLogsOnly`;

  // Build the initial OData URL with user + date filters
  const filterExpr = `Timestamp ge ${toISODate(from)} and Timestamp lt ${toISODate(to)}`;
  const params = new URLSearchParams();
  params.set("$apply", `filter(${filterExpr})`);
  params.set("worklogsFilter", `User/Email eq '${email}'`);

  const requestUrl = `${odataBase}?${params.toString()}`;

  const allWorklogs: SevenPaceWorklog[] = [];
  let currentUrl = requestUrl;
  let pagesFetched = 0;

  while (currentUrl && pagesFetched < ODATA_MAX_PAGES) {
    const result = await fetchODataPage(config, currentUrl);
    const mapped = result.value.map(mapODataWorklog);
    allWorklogs.push(...mapped);
    pagesFetched++;

    // Follow @odata.nextLink for pagination
    currentUrl = result["@odata.nextLink"] ?? "";
  }

  return {
    worklogs: allWorklogs,
    rawResponseKeys: ["@odata.context", "value"],
    rawCount: allWorklogs.length,
    requestUrl,
    fetchApi: "odata",
    pagination: {
      pagesFetched,
      totalRecords: allWorklogs.length,
      hitSafetyCap: pagesFetched >= ODATA_MAX_PAGES,
    },
  };
}

async function fetchODataPage(
  config: SevenPaceConfig,
  url: string
): Promise<ODataResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
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
        `7pace OData API error: ${res.status} ${res.statusText}`,
        res.status,
        "ODATA_API_ERROR"
      );
    }

    return res.json() as Promise<ODataResponse>;
  } catch (error) {
    if (error instanceof SevenPaceApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SevenPaceApiError("7pace OData request timed out", 504, "TIMEOUT");
    }
    throw new SevenPaceApiError("7pace OData unavailable", 503, "UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}

function mapODataWorklog(wl: ODataWorklog): SevenPaceWorklog {
  return {
    id: wl.Id,
    userId: wl.UserId ?? wl.User?.Id ?? "",
    uniqueName: wl.User?.Email ?? "",
    displayName: wl.User?.Name ?? "",
    workItemId: wl.WorkItemId ?? 0,
    hours: wl.PeriodLength / 3600,
    date: wl.Timestamp,
    activityType: wl.ActivityType?.Name,
  };
}

// ── REST paginated fetch (for org-wide queries) ───────────────

const REST_PAGE_SIZE = 500;
const REST_MAX_PAGES = 10; // safety cap: 5,000 worklogs

/**
 * Fetch all worklogs from the REST /workLogs/all endpoint with
 * _skip pagination. Use this only for org-wide queries (e.g.,
 * workitem-timelogs debug). For per-user queries, use
 * getWorklogsForUser() which uses the OData API.
 */
export async function fetchAllRestWorklogPages(
  config: SevenPaceConfig,
  params: Record<string, string>
): Promise<{ worklogs: RawWorklog[]; pagination: PaginationInfo }> {
  const allWorklogs: RawWorklog[] = [];
  let page = 0;

  while (page < REST_MAX_PAGES) {
    const pageParams = {
      ...params,
      _count: String(REST_PAGE_SIZE),
      _skip: String(page * REST_PAGE_SIZE),
    };

    const result = await sevenPaceFetch<Record<string, unknown>>(
      config,
      "workLogs/all",
      pageParams
    );

    let pageWorklogs: RawWorklog[] = [];
    if (Array.isArray(result.data)) {
      pageWorklogs = result.data;
    } else if (Array.isArray(result.value)) {
      pageWorklogs = result.value as RawWorklog[];
    } else if (Array.isArray(result)) {
      pageWorklogs = result as unknown as RawWorklog[];
    }

    allWorklogs.push(...pageWorklogs);
    page++;

    if (pageWorklogs.length < REST_PAGE_SIZE) break;
  }

  return {
    worklogs: allWorklogs,
    pagination: {
      pagesFetched: page,
      totalRecords: allWorklogs.length,
      hitSafetyCap: page >= REST_MAX_PAGES,
    },
  };
}

/**
 * Fetch org-wide worklogs via REST /workLogs/all with pagination.
 * NOTE: The _userId parameter on this endpoint is silently ignored
 * by the 7Pace API — it always returns ALL org worklogs.
 * For per-user queries, use getWorklogsForUser() instead.
 */
export async function getSevenPaceWorklogs(
  config: SevenPaceConfig,
  from: Date,
  to: Date
): Promise<SevenPaceWorklogsResult> {
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);

  const params: Record<string, string> = {
    "api-version": "3.2",
    "_fromTimestamp": fromStr,
    "_toTimestamp": toStr,
  };

  // Build URL for diagnostics
  const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/";
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const requestUrl = `${baseUrl}workLogs/all?${qs}`;

  const { worklogs: rawWorklogs, pagination } = await fetchAllRestWorklogPages(config, params);

  const worklogs = rawWorklogs.map((wl) => ({
    id: wl.id,
    userId: wl.user?.id ?? "",
    uniqueName: wl.user?.uniqueName ?? "",
    displayName: wl.user?.name ?? "",
    workItemId: wl.workItemId ?? 0,
    hours: wl.length / 3600,
    date: wl.timestamp,
    activityType: wl.activityType?.name,
  }));

  // If no worklogs found, try without date filters to check if endpoint works at all
  let unfilteredCount: number | undefined;
  if (rawWorklogs.length === 0) {
    try {
      const probe = await sevenPaceFetch<Record<string, unknown>>(
        config,
        "workLogs/all",
        { "api-version": "3.2", "_count": "5" }
      );
      const probeData = Array.isArray(probe.data) ? probe.data
        : Array.isArray(probe.value) ? probe.value
        : Array.isArray(probe) ? probe : [];
      unfilteredCount = probeData.length;
    } catch {
      unfilteredCount = -1; // error
    }
  }

  return {
    worklogs,
    rawResponseKeys: ["data"],
    rawCount: rawWorklogs.length,
    requestUrl,
    unfilteredCount,
    pagination,
    fetchApi: "rest",
  };
}
