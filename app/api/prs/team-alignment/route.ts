import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers, getTeamAreaPath } from "@/lib/ado/teams";
import { getPRsWithWorkItems } from "@/lib/ado/odata";
import type { ODataPullRequest } from "@/lib/ado/odata";
import { getPRsWithWorkItemsREST } from "@/lib/ado/pullRequests";
import {
  extractConfig,
  jsonWithCache,
  handleApiError,
  coerceAdoApiError,
} from "@/lib/ado/helpers";
import { logger } from "@/lib/logger";
import { parseRange, resolveRange } from "@/lib/dateRange";
import type {
  TeamAlignment,
  MemberAlignmentDetail,
  AlignmentApiResponse,
  AlignmentPR,
} from "@/lib/ado/types";

function areaPathMatches(areaPath: string, teamAreaPaths: string[]): boolean {
  return teamAreaPaths.some(
    (tap) => areaPath === tap || areaPath.startsWith(tap + "\\")
  );
}

function classifyPR(
  pr: ODataPullRequest,
  teamAreaPaths: string[]
): "aligned" | "outOfScope" | "unlinked" {
  if (!pr.WorkItems || pr.WorkItems.length === 0) return "unlinked";
  const hasAligned = pr.WorkItems.some((wi) =>
    areaPathMatches(wi.AreaPath, teamAreaPaths)
  );
  return hasAligned ? "aligned" : "outOfScope";
}

function toAlignmentPR(
  pr: ODataPullRequest,
  classification: "aligned" | "outOfScope" | "unlinked",
  teamAreaPaths: string[],
  displayNameMap: Map<string, string>,
  org: string,
  project: string
): AlignmentPR {
  const author =
    displayNameMap.get(pr.CreatedBy.UserName.toLowerCase()) ??
    pr.CreatedBy.UserName;
  const repoName = pr.RepositoryName ?? "";

  let workItem: AlignmentPR["workItem"] = null;
  if (classification === "aligned") {
    const wi = pr.WorkItems.find((w) => areaPathMatches(w.AreaPath, teamAreaPaths));
    if (wi) workItem = { id: wi.WorkItemId, title: wi.Title ?? "", areaPath: wi.AreaPath };
  } else if (classification === "outOfScope") {
    const wi = pr.WorkItems.find((w) => !areaPathMatches(w.AreaPath, teamAreaPaths));
    if (wi) workItem = { id: wi.WorkItemId, title: wi.Title ?? "", areaPath: wi.AreaPath };
  }

  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repoName)}/pullrequest/${pr.PullRequestId}`;

  return {
    pullRequestId: pr.PullRequestId,
    title: pr.Title,
    author,
    repoName,
    mergedDate: pr.CompletedDate,
    workItem,
    url,
  };
}

/**
 * Aggregate alignment statistics for a set of pull requests against a team's area paths.
 *
 * Counts how many PRs are classified as aligned, unlinked, or outOfScope and tallies out-of-scope work item area paths.
 *
 * @param prs - Pull requests to evaluate; each PR should include its `WorkItems` with `AreaPath` values.
 * @param teamAreaPaths - Team area paths used to determine whether a work item's area path is considered aligned.
 * @returns An object with `aligned`, `unlinked`, and `total` counts, plus `outOfScope` containing a `count` and a `byAreaPath` array of `{ areaPath, count }` entries sorted by descending count.
 */
function buildMemberAlignment(
  prs: ODataPullRequest[],
  teamAreaPaths: string[]
): MemberAlignmentDetail {
  let aligned = 0;
  let unlinked = 0;
  let outOfScopeCount = 0;
  const outOfScopeByArea = new Map<string, number>();

  for (const pr of prs) {
    const classification = classifyPR(pr, teamAreaPaths);
    if (classification === "aligned") {
      aligned++;
    } else if (classification === "unlinked") {
      unlinked++;
    } else {
      outOfScopeCount++;
      for (const wi of pr.WorkItems) {
        if (!areaPathMatches(wi.AreaPath, teamAreaPaths)) {
          outOfScopeByArea.set(
            wi.AreaPath,
            (outOfScopeByArea.get(wi.AreaPath) || 0) + 1
          );
        }
      }
    }
  }

  const byAreaPath = Array.from(outOfScopeByArea.entries())
    .map(([areaPath, count]) => ({ areaPath, count }))
    .sort((a, b) => b.count - a.count);

  return {
    aligned,
    outOfScope: { count: outOfScopeCount, byAreaPath },
    unlinked,
    total: prs.length,
  };
}

/**
 * Handle the GET request that computes team pull-request alignment for a specified date range and team.
 *
 * Parses query parameters (team and range), retrieves team members, area paths, and pull requests, aggregates per-member and team alignment statistics, and returns an AlignmentApiResponse or an error response.
 *
 * @param request - The incoming Next.js request containing query parameters `team` and optional `range`
 * @returns A NextResponse containing the alignment payload on success or a JSON error response on failure
 */
export async function GET(request: NextRequest) {
  const start = Date.now();
  const teamName = request.nextUrl.searchParams.get("team") || "";
  const rangeParam = request.nextUrl.searchParams.get("range");
  logger.info("Request start", { route: "prs/team-alignment", team: teamName, range: rangeParam });

  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) {
    logger.info("Request complete", { route: "prs/team-alignment", durationMs: Date.now() - start, outcome: "config_error" });
    return configOrError;
  }

  if (!teamName) {
    logger.info("Request complete", { route: "prs/team-alignment", durationMs: Date.now() - start, status: 400 });
    return NextResponse.json(
      { error: "No team specified" },
      { status: 400 }
    );
  }

  const range = parseRange(rangeParam);
  const { from, to, label, days } = resolveRange(range);
  const fromISO = from.toISOString().split("T")[0];
  const toISO = to.toISOString().split("T")[0];

  try {
    // Fetch team data and PRs in parallel
    let prs: ODataPullRequest[];
    const [members, teamAreaData] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getTeamAreaPath(configOrError, teamName),
    ]);

    // Try OData first, fall back to REST on non-JSON / 400 / 410 / 401
    let fetchApi = "odata";
    try {
      prs = await getPRsWithWorkItems(configOrError, fromISO, toISO);
    } catch (err) {
      const adoErr = coerceAdoApiError(err);
      const status = adoErr?.status
        ?? (err instanceof Error ? (err as unknown as Record<string, unknown>).status : undefined);
      if (status === 400 || status === 410 || status === 401 || status === 203) {
        fetchApi = "rest";
        logger.info("OData fallback to REST", { route: "prs/team-alignment", team: teamName, odataStatus: status });
        prs = await getPRsWithWorkItemsREST(configOrError, fromISO, toISO);
      } else {
        throw err;
      }
    }
    logger.info("PRs fetched", { route: "prs/team-alignment", team: teamName, fetchApi, prCount: prs.length });

    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    const teamPRs = prs.filter((pr) =>
      memberNameSet.has(pr.CreatedBy.UserName.toLowerCase())
    );

    // Build display name lookup and categorized PR lists
    const displayNameMap = new Map<string, string>(
      members.map((m) => [m.uniqueName.toLowerCase(), m.displayName])
    );
    const categorizedPRs: AlignmentApiResponse["categorizedPRs"] = {
      aligned: [],
      outOfScope: [],
      unlinked: [],
    };
    for (const pr of teamPRs) {
      const cat = classifyPR(pr, teamAreaData.areaPaths);
      categorizedPRs[cat].push(
        toAlignmentPR(pr, cat, teamAreaData.areaPaths, displayNameMap, configOrError.org, configOrError.project)
      );
    }

    // Build per-member alignment
    const prsByMember = new Map<string, ODataPullRequest[]>();
    for (const pr of teamPRs) {
      const key = pr.CreatedBy.UserName.toLowerCase();
      if (!prsByMember.has(key)) prsByMember.set(key, []);
      prsByMember.get(key)!.push(pr);
    }

    const memberResults = members.map((m) => {
      const memberPRs = prsByMember.get(m.uniqueName.toLowerCase()) || [];
      return {
        uniqueName: m.uniqueName,
        displayName: m.displayName,
        alignment: buildMemberAlignment(memberPRs, teamAreaData.areaPaths),
      };
    });

    // Team-level totals
    const teamAlignment = buildMemberAlignment(teamPRs, teamAreaData.areaPaths);
    const alignment: TeamAlignment = {
      total: teamAlignment.total,
      aligned: teamAlignment.aligned,
      outOfScope: teamAlignment.outOfScope.count,
      unlinked: teamAlignment.unlinked,
      alignedPct:
        teamAlignment.total > 0
          ? Math.round((teamAlignment.aligned / teamAlignment.total) * 100)
          : 0,
      teamAreaPath: teamAreaData.defaultAreaPath,
    };

    const response: AlignmentApiResponse = {
      period: {
        days,
        from: fromISO,
        to: toISO,
        label,
      },
      teamAreaPath: teamAreaData.defaultAreaPath,
      alignment,
      members: memberResults,
      categorizedPRs,
    };

    logger.info("Request complete", {
      route: "prs/team-alignment",
      team: teamName,
      durationMs: Date.now() - start,
      memberCount: members.length,
      totalPRs: prs.length,
      teamPRs: teamPRs.length,
      aligned: alignment.aligned,
      outOfScope: alignment.outOfScope,
      unlinked: alignment.unlinked,
      alignedPct: alignment.alignedPct,
      teamAreaPath: teamAreaData.defaultAreaPath,
      areaPaths: teamAreaData.areaPaths.length,
    });
    return jsonWithCache(response);
  } catch (error) {
    logger.error("Request error", { route: "prs/team-alignment", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return handleApiError(error);
  }
}