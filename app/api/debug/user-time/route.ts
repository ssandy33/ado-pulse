import { NextRequest, NextResponse } from "next/server";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { adoFetch, projectUrl, batchAsync } from "@/lib/ado/client";
import type { AdoConfig } from "@/lib/ado/types";
import { resolveFeature } from "@/lib/ado/workItems";
import {
  getSevenPaceConfig,
  sevenPaceFetch,
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

interface RawWorklogUser {
  id: string;
  uniqueName?: string;
  name?: string;
}

interface RawWorklog {
  id: string;
  user?: RawWorklogUser;
  workItemId?: number | null;
  length: number;
  timestamp: string;
  activityType?: { name?: string } | null;
  [key: string]: unknown;
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

    // 2. Fetch all 7pace users and find matching user
    const usersResult = await sevenPaceFetch<SevenPaceUsersResponse>(
      spConfig,
      "users",
      { "api-version": "3.2" }
    );

    const allUsers = usersResult.data ?? [];
    const matchedUser = allUsers.find((u) => {
      const uEmail = (u.email || "").toLowerCase();
      const uUnique = (u.uniqueName || "").toLowerCase();
      return uEmail === email || uUnique === email;
    });

    if (!matchedUser) {
      return NextResponse.json({
        user: null,
        error: `No 7pace user found matching "${email}"`,
        availableUsers: allUsers
          .map((u) => ({
            id: u.id,
            email: u.email || u.uniqueName || "",
            displayName: u.displayName || "",
          }))
          .filter((u) => u.email)
          .slice(0, 20),
      });
    }

    // 3. Fetch 30-day worklogs from 7pace (hardcoded — ignores any query params)
    const { from: fromDate, to: toDate } = getLookbackDateRange(LOOKBACK_DAYS);
    const toDateStr = (d: Date) => d.toISOString().split(".")[0];

    const sevenPaceParams = {
      "api-version": "3.2",
      _fromTimestamp: toDateStr(fromDate),
      _toTimestamp: toDateStr(toDate),
      _count: "500",
    };

    // Build URL for diagnostic logging
    const spBase = spConfig.baseUrl.endsWith("/") ? spConfig.baseUrl : spConfig.baseUrl + "/";
    const spQs = Object.entries(sevenPaceParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    const requestUrl = `${spBase}workLogs/all?${spQs}`;

    console.log("[user-time] fetching worklogs", {
      userId: matchedUser.id,
      email,
      fromTimestamp: fromDate.toISOString(),
      toTimestamp: toDate.toISOString(),
      url: requestUrl,
    });

    const result = await sevenPaceFetch<Record<string, unknown>>(
      spConfig,
      "workLogs/all",
      sevenPaceParams
    );

    const rawResponseKeys = Object.keys(result);

    // Parse response (try common shapes)
    let allWorklogs: RawWorklog[] = [];
    if (Array.isArray(result.data)) {
      allWorklogs = result.data;
    } else if (Array.isArray(result.value)) {
      allWorklogs = result.value as RawWorklog[];
    } else if (Array.isArray(result)) {
      allWorklogs = result as unknown as RawWorklog[];
    }

    console.log("[user-time] worklogs received", {
      rawCount: allWorklogs.length,
      responseKeys: rawResponseKeys,
    });

    // 4. Filter to this user's worklogs
    const userWorklogs = allWorklogs.filter(
      (wl) => wl.user?.id === matchedUser.id
    );

    console.log("[user-time] filtered to user", {
      userId: matchedUser.id,
      userWorklogCount: userWorklogs.length,
      totalOrgWorklogs: allWorklogs.length,
    });

    // 5. Collect unique work item IDs and batch fetch details (with System.State)
    const workItemIds = [
      ...new Set(
        userWorklogs
          .map((wl) => wl.workItemId)
          .filter((id): id is number => id != null && id > 0)
      ),
    ];

    const workItemMap = await fetchWorkItemsWithState(configOrError, workItemIds);

    // 5b. Resolve parent Feature + CapEx/OpEx for each work item
    // resolveFeature expects a compatible cache; the extra System.State field is ignored
    const featureCache = new Map(
      [...workItemMap.entries()].map(([id, wi]) => [id, wi as { id: number; fields: { "System.Title"?: string; "System.WorkItemType"?: string; "System.Parent"?: number; "Custom.FeatureExpense"?: string } }])
    );
    const featureMap = new Map<number, { featureId: number | null; featureTitle: string; expenseType: string }>();
    for (const wiId of workItemIds) {
      const resolved = await resolveFeature(configOrError, wiId, featureCache);
      featureMap.set(wiId, resolved);
    }

    // 6. Aggregate worklogs by work item
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
        }[];
      }
    >();

    for (const wl of userWorklogs) {
      const wiId = wl.workItemId ?? 0;
      const hours = Math.round((wl.length / 3600) * 100) / 100;
      const activity = wl.activityType?.name || "Unknown";

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
        date: wl.timestamp,
        hours,
        activity,
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

    // 7. Build summary
    const totalHours = workItems.reduce((s, w) => s + w.totalHours, 0);
    const allDates = userWorklogs.map((w) => w.timestamp).filter(Boolean);
    allDates.sort();

    const response = {
      user: {
        id: matchedUser.id,
        email: matchedUser.email || matchedUser.uniqueName || email,
        displayName: matchedUser.displayName || "",
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
        fromTimestamp: fromDate.toISOString(),
        toTimestamp: toDate.toISOString(),
        lookbackDays: LOOKBACK_DAYS,
        userId: matchedUser.id,
        rawWorklogCount: allWorklogs.length,
        userWorklogCount: userWorklogs.length,
        responseKeys: rawResponseKeys,
        requestUrl,
      },
    };

    return jsonWithCache(response, 60);
  } catch (error) {
    return handleApiError(error);
  }
}
