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
  withLogging,
} from "@/lib/ado/helpers";
import { parseRange, resolveRange } from "@/lib/dateRange";
import type {
  TeamAlignment,
  MemberAlignmentDetail,
  AlignmentApiResponse,
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
async function handler(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  const teamName = request.nextUrl.searchParams.get("team") || "";
  if (!teamName) {
    return NextResponse.json(
      { error: "No team specified" },
      { status: 400 }
    );
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));
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

    // Try OData first, fall back to REST on 410/401
    try {
      prs = await getPRsWithWorkItems(configOrError, fromISO, toISO);
    } catch (err) {
      const adoErr = coerceAdoApiError(err);
      const status = adoErr?.status
        ?? (err instanceof Error ? (err as unknown as Record<string, unknown>).status : undefined);
      if (status === 410 || status === 401) {
        prs = await getPRsWithWorkItemsREST(configOrError, fromISO, toISO);
      } else {
        throw err;
      }
    }

    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    const teamPRs = prs.filter((pr) =>
      memberNameSet.has(pr.CreatedBy.UserName.toLowerCase())
    );

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
    };

    return jsonWithCache(response);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging("prs/team-alignment", handler);