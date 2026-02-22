import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers, getTeamAreaPath } from "@/lib/ado/teams";
import { getPRsWithWorkItems } from "@/lib/ado/odata";
import type { ODataPullRequest } from "@/lib/ado/odata";
import {
  extractConfig,
  jsonWithCache,
  handleApiError,
} from "@/lib/ado/helpers";
import { AdoApiError } from "@/lib/ado/client";
import { parseRange, resolveRange } from "@/lib/dateRange";
import type {
  TeamAlignment,
  MemberAlignmentDetail,
  AlignmentApiResponse,
} from "@/lib/ado/types";

/**
 * Determines whether an area path exactly matches or is nested under any of the team's area paths.
 *
 * @param areaPath - The area path to test (e.g., "Project\\Component\\Sub").
 * @param teamAreaPaths - Array of team area path prefixes to match against.
 * @returns `true` if `areaPath` exactly equals one of `teamAreaPaths` or starts with one of them followed by a backslash, `false` otherwise.
 */
function areaPathMatches(areaPath: string, teamAreaPaths: string[]): boolean {
  return teamAreaPaths.some(
    (tap) => areaPath === tap || areaPath.startsWith(tap + "\\")
  );
}

/**
 * Classifies a pull request as aligned, outOfScope, or unlinked based on its linked work items' area paths.
 *
 * @param pr - Pull request whose linked work items' `AreaPath` values will be evaluated
 * @param teamAreaPaths - Team area paths considered in-scope; a matching `AreaPath` marks the PR as aligned
 * @returns `'aligned'` if any linked work item's `AreaPath` matches a team area path, `'unlinked'` if the pull request has no linked work items, `'outOfScope'` otherwise
 */
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
 * Compute alignment metrics for a member's pull requests against the team's area paths.
 *
 * @param prs - Pull requests to analyze; each PR may include `WorkItems` with `AreaPath` values.
 * @param teamAreaPaths - Team area paths used to determine whether a work item's area path is in-scope.
 * @returns `MemberAlignmentDetail` containing:
 *  - `aligned`: number of PRs with at least one work item matching the team area paths,
 *  - `unlinked`: number of PRs with no associated work items,
 *  - `total`: total number of PRs analyzed,
 *  - `outOfScope`: an object with `count` (PRs that have work items but none match) and `byAreaPath` (array of `{ areaPath, count }` sorted by `count` descending). 
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
 * Compute PR alignment metrics for a team over a specified date range and return them as a JSON HTTP response.
 *
 * @returns A JSON HTTP response containing:
 *  - period: the resolved date range (days, from, to, label)
 *  - teamAreaPath: the team's default area path
 *  - alignment: team-level totals and aligned percentage
 *  - members: per-member alignment details
 * Or an error JSON: 400 if the `team` query parameter is missing, 403 if the Analytics API is unavailable or the PAT lacks required scope, or a delegated API error response for other failures.
 */
export async function GET(request: NextRequest) {
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
    const [members, teamAreaData, prs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getTeamAreaPath(configOrError, teamName),
      getPRsWithWorkItems(configOrError, fromISO, toISO),
    ]);

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
    if (error instanceof AdoApiError && (error.status === 401 || error.status === 410)) {
      const message =
        error.status === 410
          ? "Analytics extension is not enabled for this organization. Install the Analytics Marketplace extension to use PR Alignment."
          : "Analytics API requires the Analytics:Read PAT scope. Update your PAT to include this scope.";
      return NextResponse.json(
        { error: message, scopeError: true },
        { status: 403 }
      );
    }
    return handleApiError(error);
  }
}