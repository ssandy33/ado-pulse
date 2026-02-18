import { NextRequest } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests, getReviewsGivenByMember } from "@/lib/ado/pullRequests";
import { jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import type {
  MemberSummary,
  RepoSummary,
  TeamSummaryApiResponse,
} from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "14", 10);
    const teamName =
      searchParams.get("team") || process.env.ADO_DEFAULT_TEAM || "";

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" });
    }

    // Fetch members and PRs in parallel
    const [members, allPRs] = await Promise.all([
      getTeamMembers(teamName),
      getPullRequests(days),
    ]);

    // Build a set of team member uniqueNames (lowercase for case-insensitive match)
    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    // Filter PRs to team members only
    const teamPRs = allPRs.filter((pr) =>
      memberNameSet.has(pr.createdBy.uniqueName.toLowerCase())
    );

    // Fetch review counts per member in parallel
    const reviewCounts = await Promise.all(
      members.map((m) => getReviewsGivenByMember(m.id, days))
    );

    // Compute per-member stats
    const memberSummaries: MemberSummary[] = members.map((member, i) => {
      const memberPRs = teamPRs.filter(
        (pr) =>
          pr.createdBy.uniqueName.toLowerCase() ===
          member.uniqueName.toLowerCase()
      );
      const prCount = memberPRs.length;
      const repos = [
        ...new Set(memberPRs.map((pr) => pr.repository.name)),
      ];
      const lastPRDate =
        memberPRs.length > 0
          ? memberPRs.reduce((latest, pr) =>
              pr.closedDate > latest.closedDate ? pr : latest
            ).closedDate
          : null;
      const reviewsGiven = reviewCounts[i];
      const reviewFlagged = prCount >= 3 && reviewsGiven <= 1;

      return {
        id: member.id,
        displayName: member.displayName,
        uniqueName: member.uniqueName,
        prCount,
        repos,
        lastPRDate,
        isActive: prCount > 0,
        reviewsGiven,
        reviewFlagged,
      };
    });

    // Sort by PR count descending
    memberSummaries.sort((a, b) => b.prCount - a.prCount);

    // Compute repo breakdown
    const repoMap = new Map<
      string,
      { totalPRs: number; contributors: Set<string> }
    >();
    for (const pr of teamPRs) {
      const repoName = pr.repository.name;
      if (!repoMap.has(repoName)) {
        repoMap.set(repoName, { totalPRs: 0, contributors: new Set() });
      }
      const entry = repoMap.get(repoName)!;
      entry.totalPRs++;
      entry.contributors.add(pr.createdBy.displayName);
    }

    const byRepo: RepoSummary[] = Array.from(repoMap.entries())
      .map(([repoName, data]) => ({
        repoName,
        totalPRs: data.totalPRs,
        contributors: Array.from(data.contributors),
      }))
      .sort((a, b) => b.totalPRs - a.totalPRs);

    const activeContributors = memberSummaries.filter(
      (m) => m.prCount > 0
    ).length;

    const now = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const response: TeamSummaryApiResponse = {
      period: {
        days,
        from: from.toISOString(),
        to: now.toISOString(),
      },
      team: {
        name: teamName,
        totalPRs: teamPRs.length,
        activeContributors,
        totalMembers: members.length,
      },
      members: memberSummaries,
      byRepo,
    };

    return jsonWithCache(response);
  } catch (error) {
    return handleApiError(error);
  }
}
