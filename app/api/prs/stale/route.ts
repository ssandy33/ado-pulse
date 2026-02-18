import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getOpenPullRequests } from "@/lib/ado/pullRequests";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import type { Staleness, OpenPR, StalePRResponse } from "@/lib/ado/types";

function getStaleness(ageInDays: number): Staleness {
  if (ageInDays <= 2) return "fresh";
  if (ageInDays <= 6) return "aging";
  return "stale";
}

export async function GET(request: NextRequest) {
  const configOrError = extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const teamName = request.nextUrl.searchParams.get("team") || "";

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" });
    }

    const [members, openPRs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getOpenPullRequests(configOrError),
    ]);

    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    const teamPRs = openPRs.filter((pr) =>
      memberNameSet.has(pr.createdBy.uniqueName.toLowerCase())
    );

    const now = Date.now();
    const prs: OpenPR[] = teamPRs.map((pr) => {
      const ageInDays = Math.floor(
        (now - new Date(pr.creationDate).getTime()) / 86_400_000
      );
      return {
        id: pr.pullRequestId,
        title: pr.title,
        author: pr.createdBy.displayName,
        repoName: pr.repository.name,
        createdDate: pr.creationDate,
        ageInDays,
        reviewerCount: pr.reviewers?.length ?? 0,
        staleness: getStaleness(ageInDays),
      };
    });

    prs.sort((a, b) => b.ageInDays - a.ageInDays);

    const summary = {
      fresh: prs.filter((p) => p.staleness === "fresh").length,
      aging: prs.filter((p) => p.staleness === "aging").length,
      stale: prs.filter((p) => p.staleness === "stale").length,
      total: prs.length,
    };

    const response: StalePRResponse = { summary, prs };
    return jsonWithCache(response);
  } catch (error) {
    return handleApiError(error);
  }
}
