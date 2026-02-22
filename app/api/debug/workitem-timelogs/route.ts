import { NextRequest, NextResponse } from "next/server";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { logger } from "@/lib/logger";
import { adoFetch, projectUrl } from "@/lib/ado/client";
import {
  getSevenPaceConfig,
  fetchAllRestWorklogPages,
} from "@/lib/sevenPace";

interface WorkItemFields {
  "System.Title"?: string;
  "System.WorkItemType"?: string;
  "System.State"?: string;
  "System.Parent"?: number;
  "Custom.FeatureExpense"?: string;
}

interface WorkItemResponse {
  id: number;
  fields: WorkItemFields;
}

interface ParentChainEntry {
  id: number;
  title: string;
  type: string;
  classification?: string;
}

const WI_FIELDS =
  "System.Title,System.WorkItemType,System.State,System.Parent,Custom.FeatureExpense";

async function fetchSingleWorkItem(
  config: { org: string; project: string; pat: string },
  id: number
): Promise<WorkItemResponse | null> {
  try {
    const url = projectUrl(
      config,
      `_apis/wit/workitems/${id}?fields=${WI_FIELDS}&api-version=7.1`
    );
    return await adoFetch<WorkItemResponse>(config, url);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  const workItemIdStr = request.nextUrl.searchParams.get("workItemId");
  if (!workItemIdStr || isNaN(Number(workItemIdStr))) {
    logger.info("Request complete", { route: "debug/workitem-timelogs", durationMs: Date.now() - start, status: 400 });
    return NextResponse.json(
      { error: "Missing or invalid workItemId parameter" },
      { status: 400 }
    );
  }
  const workItemId = parseInt(workItemIdStr, 10);

  logger.info("Request start", { route: "debug/workitem-timelogs", workItemId, team: request.nextUrl.searchParams.get("team") });

  try {
    // 1. Check 7pace config
    const spConfig = await getSevenPaceConfig();
    if (!spConfig) {
      logger.info("Request complete", { route: "debug/workitem-timelogs", durationMs: Date.now() - start, status: 400 });
      return NextResponse.json(
        { error: "7pace not configured" },
        { status: 400 }
      );
    }

    // 2. Fetch the work item from ADO
    const workItem = await fetchSingleWorkItem(configOrError, workItemId);
    if (!workItem) {
      logger.info("Request complete", { route: "debug/workitem-timelogs", durationMs: Date.now() - start, status: 404 });
      return NextResponse.json(
        { error: `Work item #${workItemId} not found` },
        { status: 404 }
      );
    }

    const fields = workItem.fields;
    const wiType = fields["System.WorkItemType"] || "Unknown";
    const rawExpense = fields["Custom.FeatureExpense"];
    const classification =
      wiType === "Feature" && (rawExpense === "CapEx" || rawExpense === "OpEx")
        ? rawExpense
        : "Unknown";

    // 3. Walk up parent chain to find Feature
    const parentChain: ParentChainEntry[] = [];
    let currentId = fields["System.Parent"];
    const maxDepth = 5;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const parent = await fetchSingleWorkItem(configOrError, currentId);
      if (!parent) break;

      const pType = parent.fields["System.WorkItemType"] || "Unknown";
      const pExpense = parent.fields["Custom.FeatureExpense"];
      const pClass =
        pType === "Feature" &&
        (pExpense === "CapEx" || pExpense === "OpEx")
          ? pExpense
          : undefined;

      parentChain.push({
        id: parent.id,
        title: parent.fields["System.Title"] || `Item ${parent.id}`,
        type: pType,
        classification: pClass,
      });

      if (pType === "Feature") break;
      currentId = parent.fields["System.Parent"];
      depth++;
    }

    // 4. Fetch 7pace worklogs with pagination and filter to the target work item
    // The _workItemIds param is not a valid 7pace filter, so we fetch
    // all worklogs and post-filter by workItemId.
    const { worklogs: allWorklogs, pagination } = await fetchAllRestWorklogPages(
      spConfig,
      { "api-version": "3.2" }
    );

    // Filter to only worklogs for the requested work item
    const rawWorklogs = allWorklogs.filter(
      (wl) => wl.workItemId === workItemId
    );

    // 6. Build team roster set for "in roster" check
    const teamName = request.nextUrl.searchParams.get("team") || "";
    let rosterSet = new Set<string>();
    if (teamName) {
      try {
        const { getTeamMembers } = await import("@/lib/ado/teams");
        const members = await getTeamMembers(configOrError, teamName);
        rosterSet = new Set(members.map((m) => m.uniqueName.toLowerCase()));
      } catch {
        // If team fetch fails, leave roster empty
      }
    }

    // 7. Map worklogs to response shape
    const worklogs = rawWorklogs.map((wl) => {
      const uniqueName = wl.user?.uniqueName || "";
      const userId = wl.user?.id || "";
      const displayName = wl.user?.name || "";

      return {
        id: wl.id,
        date: wl.timestamp,
        hours: Math.round((wl.length / 3600) * 100) / 100,
        userId,
        uniqueName: uniqueName || "Unknown",
        displayName: displayName || uniqueName || "Unknown",
        inTeamRoster: uniqueName
          ? rosterSet.has(uniqueName.toLowerCase())
          : false,
        rawLength: wl.length,
        rawFields: wl,
      };
    });

    // Sort by date descending
    worklogs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // 8. Build summary
    const totalHours = worklogs.reduce((s, w) => s + w.hours, 0);
    const uniqueLoggers = new Set(worklogs.map((w) => w.uniqueName));
    const dates = worklogs.map((w) => w.date).filter(Boolean);

    const response = {
      workItem: {
        id: workItemId,
        title: fields["System.Title"] || `Work item ${workItemId}`,
        type: wiType,
        state: fields["System.State"] || "Unknown",
        classification,
        parentChain,
      },
      worklogs,
      summary: {
        totalHours: Math.round(totalHours * 100) / 100,
        loggerCount: uniqueLoggers.size,
        dateRange:
          dates.length > 0
            ? {
                earliest: dates[dates.length - 1],
                latest: dates[0],
              }
            : null,
      },
      _debug: {
        fetchApi: "rest",
        pagination,
        totalOrgWorklogs: allWorklogs.length,
        matchedToWorkItem: rawWorklogs.length,
      },
    };

    logger.info("Request complete", { route: "debug/workitem-timelogs", durationMs: Date.now() - start });
    return jsonWithCache(response, 60);
  } catch (error) {
    logger.error("Request error", { route: "debug/workitem-timelogs", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return handleApiError(error);
  }
}
