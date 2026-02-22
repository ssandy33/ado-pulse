import { adoFetch } from "./client";
import type { AdoConfig } from "./types";

// ── OData types ───────────────────────────────────────────────

export interface ODataResponse<T> {
  value: T[];
  "@odata.count"?: number;
}

export interface ODataWorkItem {
  WorkItemId: number;
  AreaPath: string;
}

export interface ODataPullRequest {
  PullRequestId: number;
  Title: string;
  CreatedDate: string;
  CompletedDate: string;
  CreatedBy: {
    UserName: string;
    UserEmail: string;
  };
  WorkItems: ODataWorkItem[];
}

// ── Helpers ───────────────────────────────────────────────────

export function analyticsUrl(
  config: AdoConfig,
  path: string
): string {
  return `https://analytics.dev.azure.com/${config.org}/${config.project}/_odata/v4.0/${path}`;
}

export function odataFetch<T>(
  config: AdoConfig,
  path: string
): Promise<T> {
  return adoFetch<T>(config, analyticsUrl(config, path));
}

// ── Queries ───────────────────────────────────────────────────

export async function getPRsWithWorkItems(
  config: AdoConfig,
  from: string,
  to: string
): Promise<ODataPullRequest[]> {
  const filter = `CompletedDate ge ${from} and CompletedDate le ${to}`;
  const select = "PullRequestId,Title,CreatedDate,CompletedDate";
  const expand =
    "CreatedBy($select=UserName,UserEmail),WorkItems($select=WorkItemId,AreaPath)";

  const path =
    `PullRequests?$filter=${encodeURIComponent(filter)}` +
    `&$select=${encodeURIComponent(select)}` +
    `&$expand=${encodeURIComponent(expand)}` +
    `&$top=1000`;

  const data = await odataFetch<ODataResponse<ODataPullRequest>>(config, path);
  return data.value;
}
