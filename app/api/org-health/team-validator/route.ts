import { NextRequest } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests } from "@/lib/ado/pullRequests";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import type { TeamValidatorResponse, ValidatorRosterMember } from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const configOrError = extractConfig(request);
  if ("status" in configOrError) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const teamName = searchParams.get("team") || "";
    const days = parseInt(searchParams.get("days") || "14", 10);

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" }, 0);
    }

    const [members, allPRs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getPullRequests(configOrError, days),
    ]);

    const { org, project } = configOrError;

    // Build set of all PR author emails across the entire project
    const allPRAuthors = new Set(
      allPRs.map((pr) => pr.createdBy.uniqueName.toLowerCase())
    );

    // For each roster member, check identity resolution against all project PRs
    const rosterMembers: ValidatorRosterMember[] = members.map((m) => {
      const key = m.uniqueName.toLowerCase();
      const foundInProjectPRs = allPRAuthors.has(key);
      const memberPRs = allPRs.filter(
        (pr) => pr.createdBy.uniqueName.toLowerCase() === key
      );

      return {
        uniqueName: m.uniqueName,
        displayName: m.displayName,
        foundInProjectPRs,
        matchedPRCount: memberPRs.length,
        prs: memberPRs.map((pr) => ({
          pullRequestId: pr.pullRequestId,
          title: pr.title,
          repoName: pr.repository.name,
          creationDate: pr.creationDate,
          url: `https://dev.azure.com/${org}/${project}/_git/${encodeURIComponent(pr.repository.name)}/pullrequest/${pr.pullRequestId}`,
        })),
      };
    });

    // Sort: not-found first, then by display name
    rosterMembers.sort((a, b) => {
      if (a.foundInProjectPRs !== b.foundInProjectPRs)
        return a.foundInProjectPRs ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });

    const now = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const response: TeamValidatorResponse = {
      period: { days, from: from.toISOString(), to: now.toISOString() },
      team: { name: teamName, totalMembers: members.length },
      apiLimitHit: allPRs.length === 500,
      totalProjectPRs: allPRs.length,
      rosterMembers,
    };

    return jsonWithCache(response, 120);
  } catch (error) {
    return handleApiError(error);
  }
}
