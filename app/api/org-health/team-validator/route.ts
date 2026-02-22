import { NextRequest } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests } from "@/lib/ado/pullRequests";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { logger } from "@/lib/logger";
import { parseRange, resolveRange } from "@/lib/dateRange";
import type { TeamValidatorResponse, ValidatorRosterMember } from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const teamName = searchParams.get("team") || "";
    const range = parseRange(searchParams.get("range"));
    const { from, days, label } = resolveRange(range);

    logger.info("Request start", { route: "org-health/team-validator", team: teamName, range: searchParams.get("range") });

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" }, 0);
    }

    const [members, allPRs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getPullRequests(configOrError, from),
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

    const response: TeamValidatorResponse = {
      period: { days, from: from.toISOString(), to: now.toISOString(), label },
      team: { name: teamName, totalMembers: members.length },
      apiLimitHit: allPRs.length === 500,
      totalProjectPRs: allPRs.length,
      rosterMembers,
    };

    logger.info("Request complete", { route: "org-health/team-validator", durationMs: Date.now() - start });
    return jsonWithCache(response, 120);
  } catch (error) {
    logger.error("Request error", { route: "org-health/team-validator", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return handleApiError(error);
  }
}
