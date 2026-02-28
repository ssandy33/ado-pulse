import type {
  MemberSummary,
  MemberProfile,
  AlignmentApiResponse,
  TeamAlignment,
  DataDiagnostics,
  StalePRResponse,
  MemberTimeEntry,
  GovernanceData,
} from "@/lib/ado/types";

/**
 * Generic member filtering by agency. Returns all members when filter is empty.
 * `getLookupKey` extracts the map key from each member (e.g. member.id or member.uniqueName).
 */
export function filterMembersByAgency<T>(
  members: T[],
  agencyFilter: Set<string>,
  agencyLookup: Map<string, MemberProfile>,
  getLookupKey: (member: T) => string
): T[] {
  if (agencyFilter.size === 0) return members;
  return members.filter((member) => {
    const profile = agencyLookup.get(getLookupKey(member));
    if (!profile) return false;
    return agencyFilter.has(profile.agency);
  });
}

/**
 * Derive team KPI values from a filtered set of MemberSummary[].
 */
export function computeFilteredTeamKPIs(members: MemberSummary[]): {
  totalPRs: number;
  activeContributors: number;
  totalMembers: number;
  mostActiveRepo: { repoName: string; totalPRs: number } | null;
} {
  const nonExcluded = members.filter((m) => !m.isExcluded);
  const totalPRs = nonExcluded.reduce((sum, m) => sum + m.prCount, 0);
  const activeContributors = nonExcluded.filter((m) => m.prCount > 0).length;

  // Count PRs per repo across all member PRs
  const repoCount = new Map<string, number>();
  for (const m of nonExcluded) {
    for (const pr of m.prs) {
      repoCount.set(pr.repoName, (repoCount.get(pr.repoName) ?? 0) + 1);
    }
  }

  let mostActiveRepo: { repoName: string; totalPRs: number } | null = null;
  for (const [repoName, count] of repoCount) {
    if (!mostActiveRepo || count > mostActiveRepo.totalPRs) {
      mostActiveRepo = { repoName, totalPRs: count };
    }
  }

  return {
    totalPRs,
    activeContributors,
    totalMembers: nonExcluded.length,
    mostActiveRepo,
  };
}

/**
 * Filter alignment data to only include members in `filteredUniqueNames`.
 * Recomputes alignment totals and percentage.
 */
export function filterAlignmentData(
  data: AlignmentApiResponse,
  filteredUniqueNames: Set<string>
): AlignmentApiResponse {
  if (filteredUniqueNames.size === 0) return data;

  const filteredMembers = data.members.filter((m) =>
    filteredUniqueNames.has(m.uniqueName.toLowerCase())
  );

  const filteredAligned = data.categorizedPRs.aligned.filter((pr) =>
    filteredUniqueNames.has(pr.authorUniqueName.toLowerCase())
  );
  const filteredOutOfScope = data.categorizedPRs.outOfScope.filter((pr) =>
    filteredUniqueNames.has(pr.authorUniqueName.toLowerCase())
  );
  const filteredUnlinked = data.categorizedPRs.unlinked.filter((pr) =>
    filteredUniqueNames.has(pr.authorUniqueName.toLowerCase())
  );

  const aligned = filteredAligned.length;
  const outOfScope = filteredOutOfScope.length;
  const unlinked = filteredUnlinked.length;
  const total = aligned + outOfScope + unlinked;

  const alignment: TeamAlignment = {
    ...data.alignment,
    total,
    aligned,
    outOfScope,
    unlinked,
    alignedPct: total > 0 ? Math.round((aligned / total) * 100) : 0,
  };

  return {
    ...data,
    alignment,
    members: filteredMembers,
    categorizedPRs: {
      aligned: filteredAligned,
      outOfScope: filteredOutOfScope,
      unlinked: filteredUnlinked,
    },
  };
}

/**
 * Compute confidence level from summary ratio, matching server-side logic.
 */
function computeConfidence(
  membersWithPRs: number,
  totalRosterMembers: number
): DataDiagnostics["confidence"] {
  if (totalRosterMembers === 0) return "high";
  const ratio = membersWithPRs / totalRosterMembers;
  if (membersWithPRs === 0) return "zero";
  if (ratio < 0.5) return "low";
  if (ratio < 0.8) return "medium";
  return "high";
}

/**
 * Filter diagnostics roster to only include members in `filteredUniqueNames`.
 * Recomputes summary counts and confidence.
 */
export function filterDiagnostics(
  diagnostics: DataDiagnostics,
  filteredUniqueNames: Set<string>
): DataDiagnostics {
  if (filteredUniqueNames.size === 0) return diagnostics;

  const filteredRoster = diagnostics.rosterMembers.filter((m) =>
    filteredUniqueNames.has(m.uniqueName.toLowerCase())
  );

  const totalRosterMembers = filteredRoster.length;
  const membersWithPRs = filteredRoster.filter(
    (m) => m.foundInProjectPRs && m.matchedPRCount > 0
  ).length;
  const membersNotFound = filteredRoster.filter(
    (m) => !m.foundInProjectPRs
  ).length;
  const membersFoundButZero = filteredRoster.filter(
    (m) => m.foundInProjectPRs && m.matchedPRCount === 0
  ).length;

  return {
    ...diagnostics,
    rosterMembers: filteredRoster,
    summary: {
      totalRosterMembers,
      membersWithPRs,
      membersNotFound,
      membersFoundButZero,
    },
    confidence: computeConfidence(membersWithPRs, totalRosterMembers),
  };
}

/**
 * Filter stale PR data by authorUniqueName. Recomputes summary counts.
 */
export function filterStalePRData(
  data: StalePRResponse,
  filteredUniqueNames: Set<string>
): StalePRResponse {
  if (filteredUniqueNames.size === 0) return data;

  const filteredPRs = data.prs.filter((pr) =>
    pr.authorUniqueName
      ? filteredUniqueNames.has(pr.authorUniqueName.toLowerCase())
      : false
  );

  return {
    summary: {
      fresh: filteredPRs.filter((p) => p.staleness === "fresh").length,
      aging: filteredPRs.filter((p) => p.staleness === "aging").length,
      stale: filteredPRs.filter((p) => p.staleness === "stale").length,
      total: filteredPRs.length,
    },
    prs: filteredPRs,
  };
}

/**
 * Derive time tracking KPI values from a filtered set of MemberTimeEntry[].
 */
export function computeFilteredTimeKPIs(members: MemberTimeEntry[]): {
  totalHours: number;
  capExHours: number;
  opExHours: number;
  membersNotLogging: number;
  membersLogging: number;
} {
  const nonExcluded = members.filter((m) => !m.isExcluded);
  const totalHours = nonExcluded.reduce((s, m) => s + m.totalHours, 0);
  const capExHours = nonExcluded.reduce((s, m) => s + m.capExHours, 0);
  const opExHours = nonExcluded.reduce((s, m) => s + m.opExHours, 0);
  const membersNotLogging = nonExcluded.filter((m) => m.totalHours === 0).length;
  const membersLogging = nonExcluded.length - membersNotLogging;

  return { totalHours, capExHours, opExHours, membersNotLogging, membersLogging };
}

/**
 * Recalculate governance data for a filtered member count.
 */
export function computeFilteredGovernance(
  governance: GovernanceData,
  filteredTotalHours: number,
  filteredActiveCount: number
): GovernanceData {
  const expectedHours =
    governance.hoursPerDay * governance.businessDays * filteredActiveCount;
  const compliancePct =
    expectedHours > 0 ? (filteredTotalHours / expectedHours) * 100 : 0;

  return {
    ...governance,
    activeMembers: filteredActiveCount,
    expectedHours,
    compliancePct,
    isCompliant: compliancePct >= 80,
  };
}
