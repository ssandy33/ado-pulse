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

/**
 * Builds a fully qualified Azure DevOps Analytics OData URL for the specified organization, project, and endpoint path.
 *
 * @param config - Configuration containing `org` and `project` used to construct the URL
 * @param path - OData endpoint path (relative to the analytics OData root), including any query components
 * @returns The fully qualified Analytics OData URL
 */

export function analyticsUrl(
  config: AdoConfig,
  path: string
): string {
  return `https://analytics.dev.azure.com/${encodeURIComponent(config.org)}/${encodeURIComponent(config.project)}/_odata/v4.0/${path}`;
}

/**
 * Fetches OData JSON from the Azure DevOps analytics endpoint for the provided path and returns it parsed as the requested type.
 *
 * @param path - The analytics API path and query string to request (OData query).
 * @returns The fetched OData response parsed into the requested type `T`.
 */
export function odataFetch<T>(
  config: AdoConfig,
  path: string
): Promise<T> {
  return adoFetch<T>(config, analyticsUrl(config, path));
}

/**
 * Fetches pull requests completed within the given date range, including creator and work item details.
 *
 * @param from - Inclusive start date string used in the OData CompletedDate filter (e.g., "2025-01-01T00:00:00Z")
 * @param to - Inclusive end date string used in the OData CompletedDate filter (e.g., "2025-01-31T23:59:59Z")
 * @returns An array of `ODataPullRequest` objects matching the filter; each contains `PullRequestId`, `Title`, `CreatedDate`, `CompletedDate`, `CreatedBy` (`UserName`, `UserEmail`), and `WorkItems` (`WorkItemId`, `AreaPath`)
 */

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