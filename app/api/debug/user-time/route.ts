import { NextRequest, NextResponse } from "next/server";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { logger } from "@/lib/logger";
import { adoFetch, projectUrl, batchAsync } from "@/lib/ado/client";
import type { AdoConfig } from "@/lib/ado/types";
import { resolveFeature } from "@/lib/ado/workItems";
import {
  getSevenPaceConfig,
  getWorklogsForUser,
  SevenPaceApiError,
} from "@/lib/sevenPace";
import { getLookbackDateRange } from "@/lib/dateUtils";

const LOOKBACK_DAYS = 30;

// Extended field set — includes System.State for status display
const WI_FIELDS =
  "System.Title,System.WorkItemType,System.State,System.Parent,Custom.FeatureExpense";
const BATCH_SIZE = 200;

interface WorkItemExt {
  id: number;
  fields: {
    "System.Title"?: string;
    "System.WorkItemType"?: string;
    "System.State"?: string;
    "System.Parent"?: number;
    "Custom.FeatureExpense"?: string;
  };
}

interface WorkItemsResponse {
  count: number;
  value: WorkItemExt[];
}

async function fetchWorkItemsWithState(
  config: AdoConfig,
  ids: number[]
): Promise<Map<number, WorkItemExt>> {
  const result = new Map<number, WorkItemExt>();
  if (ids.length === 0) return result;

  const uniqueIds = [...new Set(ids)];
  const batches: number[][] = [];
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  const fetchBatch = (batchIds: number[]) => async () => {
    const idParam = batchIds.join(",");
    const url = projectUrl(
      config,
      `_apis/wit/workitems?ids=${idParam}&fields=${WI_FIELDS}&api-version=7.1`
    );
    const data = await adoFetch<WorkItemsResponse>(config, url);
    return data.value;
  };

  const batchResults = await batchAsync(
    batches.map((b) => fetchBatch(b)),
    3
  );

  for (const items of batchResults) {
    for (const item of items) {
      result.set(item.id, item);
    }
  }

  return result;
}

/**
 * Handle GET requests that retrieve a user's 7pace worklogs over a lookback period, aggregate them by work item, and return a summarized report.
 *
 * The response JSON contains:
 * - `user`: object with `id`, `email`, and `displayName`.
 * - `summary`: totals including `totalHours`, `workItemCount`, `entryCount`, optional `dateRange` (`earliest`, `latest`), and `period` (`from`, `to`, `days`).
 * - `workItems`: array of work items with metadata (`workItemId`, `title`, `type`, `state`, `featureId`, `featureTitle`, `classification`), aggregated metrics (`totalHours`, `entryCount`, `activities`) and `entries` sorted by date descending.
 * - `_debug`: diagnostic information about the fetch mode, API used, timestamps, pagination, and request metadata.
 *
 * The handler validates the `email` query parameter, ensures 7pace is configured, fetches worklogs via the 7pace API, enriches work items with Azure DevOps data and feature resolution, and caches the JSON response.
 *
 * @returns A JSON response object as described above, or an error response (status 400, 401, or 502) when configuration or upstream API errors occur.
 */
export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Missing email parameter" },
      { status: 400 }
    );
  }

  try {
    // 1. Check 7pace config
    const spConfig = await getSevenPaceConfig();
    if (!spConfig) {
      return NextResponse.json(
        { error: "7pace not configured" },
        { status: 400 }
      );
    }

    // 2. Fetch worklogs for this user via OData API (real server-side filtering)
    const { from: fromDate, to: toDate } = getLookbackDateRange(LOOKBACK_DAYS);

    logger.info("Fetching worklogs via OData", {
      route: "debug/user-time",
      email,
      fromTimestamp: fromDate.toISOString(),
      toTimestamp: toDate.toISOString(),
    });

    let worklogResult;
    try {
      worklogResult = await getWorklogsForUser(spConfig, email, fromDate, toDate);
    } catch (error) {
      if (error instanceof SevenPaceApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status === 401 ? 401 : 502 }
        );
      }
      throw error;
    }

    const userWorklogs = worklogResult.worklogs;

    logger.info("Worklogs received (OData-filtered)", {
      route: "debug/user-time",
      email,
      worklogCount: userWorklogs.length,
      fetchApi: worklogResult.fetchApi,
      pagination: worklogResult.pagination,
    });

    // If no worklogs, return early with user info from the first worklog or email
    if (userWorklogs.length === 0) {
      const toDateStr = (d: Date) => d.toISOString().split(".")[0];
      return jsonWithCache({
        user: {
          id: "",
          email,
          displayName: "",
        },
        summary: {
          totalHours: 0,
          workItemCount: 0,
          entryCount: 0,
          dateRange: null,
          period: {
            from: toDateStr(fromDate),
            to: toDateStr(toDate),
            days: LOOKBACK_DAYS,
          },
        },
        workItems: [],
        _debug: {
          fetchMode: "per-user-odata",
          fetchApi: worklogResult.fetchApi,
          fromTimestamp: fromDate.toISOString(),
          toTimestamp: toDate.toISOString(),
          lookbackDays: LOOKBACK_DAYS,
          worklogCount: 0,
          requestUrl: worklogResult.requestUrl,
          pagination: worklogResult.pagination,
        },
      }, 60);
    }

    // Get user info from the first worklog
    const firstWl = userWorklogs[0];
    const userId = firstWl.userId;
    const displayName = firstWl.displayName;

    // 3. Collect unique work item IDs and batch fetch details (with System.State)
    const workItemIds = [
      ...new Set(
        userWorklogs
          .map((wl) => wl.workItemId)
          .filter((id): id is number => id != null && id > 0)
      ),
    ];

    const workItemMap = await fetchWorkItemsWithState(configOrError, workItemIds);

    // 3b. Resolve parent Feature + CapEx/OpEx for each work item
    const featureCache = new Map(
      [...workItemMap.entries()].map(([id, wi]) => [id, wi as { id: number; fields: { "System.Title"?: string; "System.WorkItemType"?: string; "System.Parent"?: number; "Custom.FeatureExpense"?: string } }])
    );
    const featureMap = new Map<number, { featureId: number | null; featureTitle: string; expenseType: string }>();
    for (const wiId of workItemIds) {
      const resolved = await resolveFeature(configOrError, wiId, featureCache);
      featureMap.set(wiId, resolved);
    }

    // 4. Aggregate worklogs by work item
    const byWorkItem = new Map<
      number,
      {
        workItemId: number;
        title: string;
        type: string;
        state: string;
        featureId: number | null;
        featureTitle: string;
        classification: string;
        totalHours: number;
        entryCount: number;
        activities: Set<string>;
        entries: {
          id: string;
          date: string;
          hours: number;
          activity: string;
          uniqueName: string;
        }[];
      }
    >();

    for (const wl of userWorklogs) {
      const wiId = wl.workItemId ?? 0;
      const hours = Math.round(wl.hours * 100) / 100;
      const activity = wl.activityType || "Unknown";

      if (!byWorkItem.has(wiId)) {
        const wi = workItemMap.get(wiId);
        const feature = featureMap.get(wiId);
        byWorkItem.set(wiId, {
          workItemId: wiId,
          title: wi?.fields["System.Title"] || (wiId === 0 ? "No Work Item" : `Work Item #${wiId}`),
          type: wi?.fields["System.WorkItemType"] || "Unknown",
          state: wi?.fields["System.State"] || "Unknown",
          featureId: feature?.featureId ?? null,
          featureTitle: feature?.featureTitle ?? "No Feature",
          classification: feature?.expenseType ?? "Unclassified",
          totalHours: 0,
          entryCount: 0,
          activities: new Set(),
          entries: [],
        });
      }

      const agg = byWorkItem.get(wiId)!;
      agg.totalHours += hours;
      agg.entryCount += 1;
      agg.activities.add(activity);
      agg.entries.push({
        id: wl.id,
        date: wl.date,
        hours,
        activity,
        uniqueName: wl.uniqueName || "Unknown",
      });
    }

    // Sort entries within each work item by date descending
    const workItems = [...byWorkItem.values()]
      .map((wi) => ({
        workItemId: wi.workItemId,
        title: wi.title,
        type: wi.type,
        state: wi.state,
        featureId: wi.featureId,
        featureTitle: wi.featureTitle,
        classification: wi.classification,
        totalHours: Math.round(wi.totalHours * 100) / 100,
        entryCount: wi.entryCount,
        activities: [...wi.activities],
        entries: wi.entries.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // 5. Build summary
    const totalHours = workItems.reduce((s, w) => s + w.totalHours, 0);
    const allDates = userWorklogs.map((w) => w.date).filter(Boolean);
    allDates.sort();

    const toDateStr = (d: Date) => d.toISOString().split(".")[0];

    const response = {
      user: {
        id: userId,
        email,
        displayName: displayName || "",
      },
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        workItemCount: workItems.filter((w) => w.workItemId !== 0).length,
        entryCount: userWorklogs.length,
        dateRange:
          allDates.length > 0
            ? { earliest: allDates[0], latest: allDates[allDates.length - 1] }
            : null,
        period: {
          from: toDateStr(fromDate),
          to: toDateStr(toDate),
          days: LOOKBACK_DAYS,
        },
      },
      workItems,
      _debug: {
        fetchMode: "per-user-odata",
        fetchApi: worklogResult.fetchApi,
        fromTimestamp: fromDate.toISOString(),
        toTimestamp: toDate.toISOString(),
        lookbackDays: LOOKBACK_DAYS,
        userId,
        worklogCount: userWorklogs.length,
        requestUrl: worklogResult.requestUrl,
        pagination: worklogResult.pagination,
      },
    };

    return jsonWithCache(response, 60);
  } catch (error) {
    return handleApiError(error);
  }
}