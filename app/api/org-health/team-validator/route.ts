import { NextRequest } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests } from "@/lib/ado/pullRequests";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import type {
  TeamValidatorResponse,
  RosterMemberResult,
  GapAuthor,
} from "@/lib/ado/types";

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

    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    // Determine team repos (repos where any team member has a PR)
    const teamPRs = allPRs.filter((pr) =>
      memberNameSet.has(pr.createdBy.uniqueName.toLowerCase())
    );
    const teamRepoNames = [
      ...new Set(teamPRs.map((pr) => pr.repository.name)),
    ];

    // PRs in team repos from non-team authors
    const prsInTeamRepos = allPRs.filter((pr) =>
      teamRepoNames.includes(pr.repository.name)
    );

    // Roster members: check who shows up in PR data
    const rosterMembers: RosterMemberResult[] = members.map((m) => {
      const count = allPRs.filter(
        (pr) =>
          pr.createdBy.uniqueName.toLowerCase() === m.uniqueName.toLowerCase()
      ).length;
      return {
        displayName: m.displayName,
        uniqueName: m.uniqueName,
        foundInPRData: count > 0,
        prCount: count,
      };
    });

    // Sort: unmatched first, then by name
    rosterMembers.sort((a, b) => {
      if (a.foundInPRData !== b.foundInPRData)
        return a.foundInPRData ? 1 : -1;
      return a.displayName.localeCompare(b.displayName);
    });

    // Gap authors: non-team authors with PRs in team repos
    const gapMap = new Map<
      string,
      { displayName: string; prs: typeof prsInTeamRepos }
    >();

    for (const pr of prsInTeamRepos) {
      const authorKey = pr.createdBy.uniqueName.toLowerCase();
      if (!memberNameSet.has(authorKey)) {
        const existing = gapMap.get(authorKey);
        if (existing) {
          existing.prs.push(pr);
        } else {
          gapMap.set(authorKey, {
            displayName: pr.createdBy.displayName,
            prs: [pr],
          });
        }
      }
    }

    const gapAuthors: GapAuthor[] = [];
    for (const [uniqueName, { displayName, prs }] of gapMap) {
      const authorWords = displayName
        .toLowerCase()
        .split(/[\s.\-_@]+/)
        .filter((w) => w.length >= 4);

      let possibleMatchName: string | null = null;
      for (const member of members) {
        const memberWords = member.displayName
          .toLowerCase()
          .split(/[\s.\-_@]+/)
          .filter((w) => w.length >= 4);
        if (authorWords.some((aw) => memberWords.includes(aw))) {
          possibleMatchName = member.displayName;
          break;
        }
      }

      gapAuthors.push({
        uniqueName,
        displayName,
        prCount: prs.length,
        possibleMatch: possibleMatchName !== null,
        possibleMatchName,
        prs: prs.map((pr) => ({
          pullRequestId: pr.pullRequestId,
          title: pr.title,
          repoName: pr.repository.name,
          creationDate: pr.creationDate,
        })),
      });
    }

    // Sort gap authors: possible matches first, then by prCount desc
    gapAuthors.sort((a, b) => {
      if (a.possibleMatch !== b.possibleMatch)
        return a.possibleMatch ? -1 : 1;
      return b.prCount - a.prCount;
    });

    const matchedInPRData = rosterMembers.filter((m) => m.foundInPRData).length;

    const response: TeamValidatorResponse = {
      rosterMembers,
      gapAuthors,
      summary: {
        rosterSize: members.length,
        matchedInPRData,
        gapAuthorCount: gapAuthors.length,
        possibleMismatches: gapAuthors.filter((a) => a.possibleMatch).length,
      },
      teamRepos: teamRepoNames,
    };

    return jsonWithCache(response, 120);
  } catch (error) {
    return handleApiError(error);
  }
}
