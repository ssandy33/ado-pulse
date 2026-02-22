import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers, getTeamAreaPath } from "@/lib/ado/teams";
import { getPRsWithWorkItems } from "@/lib/ado/odata";
import type { ODataPullRequest } from "@/lib/ado/odata";
import {
  extractConfig,
  jsonWithCache,
  handleApiError,
  coerceAdoApiError,
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
 * Handle GET requests to compute pull-request alignment for a team over a specified date range.
 *
 * Parses the query for a team and date range, fetches team members, team area paths, and PRs,
 * aggregates per-member and team alignment metrics, and returns an AlignmentApiResponse as JSON
 * (cached). Responds with 400 if the team is not specified and with 403 when analytics access is
 * unavailable or PAT scopes are insufficient.
 *
 * @param request - The incoming Next.js request containing query parameters (`team`, optional `range`)
 * @returns An AlignmentApiResponse serialized as a JSON NextResponse, or an error JSON NextResponse for bad requests or authorization/extension issues
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
    const adoErr = coerceAdoApiError(error);

    if (adoErr && (adoErr.status === 401 || adoErr.status === 410)) {
      const message =
        adoErr.status === 410
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