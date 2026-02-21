import { NextRequest, NextResponse } from "next/server";
import { getTeamMembers } from "@/lib/ado/teams";
import { getPullRequests, getReviewsGivenByMember } from "@/lib/ado/pullRequests";
import { batchAsync } from "@/lib/ado/client";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { getExclusions } from "@/lib/settings";
import { parseRange, resolveRange } from "@/lib/dateRange";
import type {
  MemberSummary,
  RepoSummary,
  TeamSummaryApiResponse,
  DataDiagnostics,
  DiagnosticRosterMember,
} from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const range = parseRange(searchParams.get("range"));
    const { from, days, label } = resolveRange(range);
    const teamName = searchParams.get("team") || "";

    if (!teamName) {
      return jsonWithCache({ error: "No team specified" });
    }

    // Fetch members and PRs in parallel
    const [members, allPRs] = await Promise.all([
      getTeamMembers(configOrError, teamName),
      getPullRequests(configOrError, from),
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
      members.map((m) => () => getReviewsGivenByMember(configOrError, m.id, from)),
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
        isExcluded: false,
        role: null,
      };
    });

    // ── Apply member role exclusions ──────────────────────────────
    const exclusions = await getExclusions();
    const excludedSet = new Map(
      exclusions
        .filter((e) => e.excludeFromMetrics)
        .map((e) => [e.uniqueName.toLowerCase(), e.role])
    );

    for (const m of memberSummaries) {
      const role = excludedSet.get(m.uniqueName.toLowerCase());
      if (role !== undefined) {
        m.isExcluded = true;
        m.role = role || null;
      }
    }

    // Sort: non-excluded first (by prCount desc), then excluded (by prCount desc)
    memberSummaries.sort((a, b) => {
      if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1;
      return b.prCount - a.prCount;
    });

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

    const nonExcludedMembers = memberSummaries.filter((m) => !m.isExcluded);
    const activeContributors = nonExcludedMembers.filter(
      (m) => m.prCount > 0
    ).length;
    const totalPRsFromContributors = nonExcludedMembers.reduce(
      (sum, m) => sum + m.prCount,
      0
    );

    // ── Diagnostics: roster identity resolution ────────────────────
    const allPRAuthors = new Set(
      allPRs.map((pr) => pr.createdBy.uniqueName.toLowerCase())
    );

    const nonExcludedUniqueNames = new Set(
      nonExcludedMembers.map((m) => m.uniqueName.toLowerCase())
    );
    const diagMembers = members.filter((m) =>
      nonExcludedUniqueNames.has(m.uniqueName.toLowerCase())
    );

    const diagRosterMembers: DiagnosticRosterMember[] = diagMembers.map((m) => {
      const key = m.uniqueName.toLowerCase();
      const foundInProjectPRs = allPRAuthors.has(key);
      const matchedPRCount = allPRs.filter(
        (pr) => pr.createdBy.uniqueName.toLowerCase() === key
      ).length;
      return {
        uniqueName: m.uniqueName,
        displayName: m.displayName,
        matchedPRCount,
        foundInProjectPRs,
      };
    });

    const membersWithPRs = diagRosterMembers.filter(
      (m) => m.foundInProjectPRs && m.matchedPRCount > 0
    ).length;
    const membersNotFound = diagRosterMembers.filter(
      (m) => !m.foundInProjectPRs
    ).length;
    const membersFoundButZero = diagRosterMembers.filter(
      (m) => m.foundInProjectPRs && m.matchedPRCount === 0
    ).length;

    const totalRosterMembers = diagMembers.length;
    const ratio = totalRosterMembers > 0 ? membersWithPRs / totalRosterMembers : 1;
    let confidence: DataDiagnostics["confidence"];
    if (membersWithPRs === 0 && allPRs.length > 0) {
      confidence = "zero";
    } else if (ratio < 0.5) {
      confidence = "low";
    } else if (ratio < 0.8) {
      confidence = "medium";
    } else {
      confidence = "high";
    }

    const now = new Date();

    const diagnostics: DataDiagnostics = {
      period: { days, from: from.toISOString(), to: now.toISOString(), label },
      apiLimitHit: allPRs.length === 500,
      totalProjectPRs: allPRs.length,
      rosterMembers: diagRosterMembers,
      summary: {
        totalRosterMembers,
        membersWithPRs,
        membersNotFound,
        membersFoundButZero,
      },
      confidence,
    };

    const response: TeamSummaryApiResponse = {
      period: {
        days,
        from: from.toISOString(),
        to: now.toISOString(),
        label,
      },
      team: {
        name: teamName,
        totalPRs: totalPRsFromContributors,
        activeContributors,
        totalMembers: nonExcludedMembers.length,
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
