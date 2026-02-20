import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests, getReviewsGivenByMember } from "@/lib/ado/pullRequests";
import { batchAsync } from "@/lib/ado/client";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import type {
  MemberSummary,
  RepoSummary,
  TeamSummaryApiResponse,
  DataDiagnostics,
  UnmatchedInTeamRepo,
} from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const configOrError = extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "14", 10);
    const teamName = searchParams.get("team") || "";

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" });
    }

    // Fetch members and PRs in parallel
    const [members, allPRs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getPullRequests(configOrError, days),
    ]);

    // Build a set of team member uniqueNames (lowercase for case-insensitive match)
    const memberNameSet = new Set(
      members.map((m) => m.uniqueName.toLowerCase())
    );

    // Filter PRs to team members only
    const teamPRs = allPRs.filter((pr) =>
      memberNameSet.has(pr.createdBy.uniqueName.toLowerCase())
    );

    // Fetch review counts per member in batches of 5
    const reviewCounts = await batchAsync(
      members.map((m) => () => getReviewsGivenByMember(configOrError, m.id, days)),
      5
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
      { repoId: string; totalPRs: number; contributors: Set<string> }
    >();
    for (const pr of teamPRs) {
      const repoName = pr.repository.name;
      if (!repoMap.has(repoName)) {
        repoMap.set(repoName, {
          repoId: pr.repository.id,
          totalPRs: 0,
          contributors: new Set(),
        });
      }
      const entry = repoMap.get(repoName)!;
      entry.totalPRs++;
      entry.contributors.add(pr.createdBy.displayName);
    }

    const byRepo: RepoSummary[] = Array.from(repoMap.entries())
      .map(([repoName, data]) => ({
        repoId: data.repoId,
        repoName,
        totalPRs: data.totalPRs,
        contributors: Array.from(data.contributors),
      }))
      .sort((a, b) => b.totalPRs - a.totalPRs);

    const activeContributors = memberSummaries.filter(
      (m) => m.prCount > 0
    ).length;

    // ── Diagnostics computation ──────────────────────────────────
    const teamRepoNames = Array.from(repoMap.keys());

    // Count all PRs (from anyone) in the repos the team touches
    const prsInTeamRepos = allPRs.filter((pr) =>
      teamRepoNames.includes(pr.repository.name)
    );
    const PRsInTeamRepos = prsInTeamRepos.length;
    const teamMatchedPRs = teamPRs.length;
    const gapPRs = PRsInTeamRepos - teamMatchedPRs;
    const matchRate =
      PRsInTeamRepos > 0
        ? Math.round((teamMatchedPRs / PRsInTeamRepos) * 100)
        : 100;

    // Find unmatched authors in team repos
    const rosterWords = members.flatMap((m) => {
      const parts = m.displayName.toLowerCase().split(/[\s.\-_@]+/);
      return parts.filter((w) => w.length >= 4);
    });

    const unmatchedInTeamRepos: UnmatchedInTeamRepo[] = [];
    const unmatchedMap = new Map<
      string,
      { displayName: string; count: number }
    >();

    for (const pr of prsInTeamRepos) {
      const authorKey = pr.createdBy.uniqueName.toLowerCase();
      if (!memberNameSet.has(authorKey)) {
        const existing = unmatchedMap.get(authorKey);
        if (existing) {
          existing.count++;
        } else {
          unmatchedMap.set(authorKey, {
            displayName: pr.createdBy.displayName,
            count: 1,
          });
        }
      }
    }

    for (const [uniqueName, { displayName, count }] of unmatchedMap) {
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
        const overlap = authorWords.some((aw) => memberWords.includes(aw));
        if (overlap) {
          possibleMatchName = member.displayName;
          break;
        }
      }

      unmatchedInTeamRepos.push({
        uniqueName,
        displayName,
        prCount: count,
        possibleMatch: possibleMatchName !== null,
        possibleMatchName,
      });
    }

    const rosterIdentities = members.map((m) => m.uniqueName);

    const diagnostics: DataDiagnostics = {
      totalProjectPRs: allPRs.length,
      teamMatchedPRs,
      gapPRs,
      matchRate,
      teamRepos: teamRepoNames,
      PRsInTeamRepos,
      apiLimitHit: allPRs.length === 500,
      rosterIdentities,
      unmatchedInTeamRepos,
      zeroActivityWarning: teamMatchedPRs === 0 && allPRs.length > 0,
    };

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
      diagnostics,
    };

    return jsonWithCache(response);
  } catch (error) {
    return handleApiError(error);
  }
}
