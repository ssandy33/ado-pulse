import {
  filterMembersByAgency,
  computeFilteredTeamKPIs,
  filterAlignmentData,
  filterDiagnostics,
  filterStalePRData,
  computeFilteredTimeKPIs,
  computeFilteredGovernance,
} from "@/lib/agencyFilterUtils";
import type {
  MemberSummary,
  MemberProfile,
  AlignmentApiResponse,
  DataDiagnostics,
  StalePRResponse,
  MemberTimeEntry,
  GovernanceData,
} from "@/lib/ado/types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMemberSummary(
  overrides: Partial<MemberSummary> & { id: string; displayName: string; uniqueName: string }
): MemberSummary {
  return {
    prCount: 3,
    repos: ["repo-a"],
    lastPRDate: "2025-06-01T00:00:00Z",
    isActive: true,
    reviewsGiven: 2,
    reviewFlagged: false,
    isExcluded: false,
    role: null,
    prs: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<MemberProfile> & { adoId: string }): MemberProfile {
  return {
    displayName: "Member",
    email: "member@example.com",
    employmentType: "fte",
    agency: "arrivia",
    ...overrides,
  };
}

function makeTimeEntry(
  overrides: Partial<MemberTimeEntry> & { uniqueName: string; displayName: string }
): MemberTimeEntry {
  return {
    totalHours: 10,
    capExHours: 6,
    opExHours: 3,
    unclassifiedHours: 1,
    wrongLevelHours: 0,
    wrongLevelCount: 0,
    isExcluded: false,
    role: null,
    features: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// filterMembersByAgency
// ---------------------------------------------------------------------------

describe("filterMembersByAgency", () => {
  const alice = makeMemberSummary({ id: "a1", displayName: "Alice", uniqueName: "alice@ex.com" });
  const bob = makeMemberSummary({ id: "b1", displayName: "Bob", uniqueName: "bob@ex.com" });
  const charlie = makeMemberSummary({ id: "c1", displayName: "Charlie", uniqueName: "charlie@ex.com" });

  const lookup = new Map<string, MemberProfile>([
    ["a1", makeProfile({ adoId: "a1", agency: "arrivia", employmentType: "fte" })],
    ["b1", makeProfile({ adoId: "b1", agency: "Acme", employmentType: "contractor" })],
  ]);

  it("returns all members when filter is empty", () => {
    const result = filterMembersByAgency([alice, bob, charlie], new Set(), lookup, (m) => m.id);
    expect(result).toHaveLength(3);
  });

  it("returns only matching members when filter is active", () => {
    const result = filterMembersByAgency(
      [alice, bob, charlie],
      new Set(["arrivia"]),
      lookup,
      (m) => m.id
    );
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Alice");
  });

  it("excludes members without a profile when filter is active", () => {
    const result = filterMembersByAgency(
      [alice, bob, charlie],
      new Set(["Acme"]),
      lookup,
      (m) => m.id
    );
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Bob");
  });

  it("supports multiple selected agencies", () => {
    const result = filterMembersByAgency(
      [alice, bob, charlie],
      new Set(["arrivia", "Acme"]),
      lookup,
      (m) => m.id
    );
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// computeFilteredTeamKPIs
// ---------------------------------------------------------------------------

describe("computeFilteredTeamKPIs", () => {
  it("computes correct PR count and active contributors", () => {
    const members = [
      makeMemberSummary({ id: "a", displayName: "A", uniqueName: "a@ex.com", prCount: 5, prs: [] }),
      makeMemberSummary({ id: "b", displayName: "B", uniqueName: "b@ex.com", prCount: 3, prs: [] }),
      makeMemberSummary({ id: "c", displayName: "C", uniqueName: "c@ex.com", prCount: 0, prs: [] }),
    ];
    const result = computeFilteredTeamKPIs(members);
    expect(result.totalPRs).toBe(8);
    expect(result.activeContributors).toBe(2);
    expect(result.totalMembers).toBe(3);
  });

  it("excludes excluded members from counts", () => {
    const members = [
      makeMemberSummary({ id: "a", displayName: "A", uniqueName: "a@ex.com", prCount: 5, isExcluded: true }),
      makeMemberSummary({ id: "b", displayName: "B", uniqueName: "b@ex.com", prCount: 3 }),
    ];
    const result = computeFilteredTeamKPIs(members);
    expect(result.totalPRs).toBe(3);
    expect(result.totalMembers).toBe(1);
  });

  it("computes most active repo from member PRs", () => {
    const members = [
      makeMemberSummary({
        id: "a",
        displayName: "A",
        uniqueName: "a@ex.com",
        prs: [
          { pullRequestId: 1, title: "PR1", repoName: "repo-x", creationDate: "2025-01-01", url: "" },
          { pullRequestId: 2, title: "PR2", repoName: "repo-x", creationDate: "2025-01-02", url: "" },
        ],
      }),
      makeMemberSummary({
        id: "b",
        displayName: "B",
        uniqueName: "b@ex.com",
        prs: [
          { pullRequestId: 3, title: "PR3", repoName: "repo-y", creationDate: "2025-01-03", url: "" },
        ],
      }),
    ];
    const result = computeFilteredTeamKPIs(members);
    expect(result.mostActiveRepo).toEqual({ repoName: "repo-x", totalPRs: 2 });
  });

  it("returns null most active repo when no PRs", () => {
    const members = [
      makeMemberSummary({ id: "a", displayName: "A", uniqueName: "a@ex.com", prCount: 0, prs: [] }),
    ];
    const result = computeFilteredTeamKPIs(members);
    expect(result.mostActiveRepo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// filterAlignmentData
// ---------------------------------------------------------------------------

describe("filterAlignmentData", () => {
  const baseData: AlignmentApiResponse = {
    period: { days: 14, from: "2025-01-01", to: "2025-01-14", label: "last 14 days" },
    teamAreaPath: "Project\\Team",
    alignment: {
      total: 6,
      aligned: 4,
      outOfScope: 1,
      unlinked: 1,
      alignedPct: 67,
      teamAreaPath: "Project\\Team",
    },
    members: [
      { uniqueName: "alice@ex.com", displayName: "Alice", alignment: { aligned: 3, outOfScope: { count: 0, byAreaPath: [] }, unlinked: 0, total: 3 } },
      { uniqueName: "bob@ex.com", displayName: "Bob", alignment: { aligned: 1, outOfScope: { count: 1, byAreaPath: [] }, unlinked: 1, total: 3 } },
    ],
    categorizedPRs: {
      aligned: [
        { pullRequestId: 1, title: "PR1", author: "Alice", repoName: "r", mergedDate: "2025-01-10", workItem: null, url: "" },
        { pullRequestId: 2, title: "PR2", author: "Bob", repoName: "r", mergedDate: "2025-01-11", workItem: null, url: "" },
      ],
      outOfScope: [
        { pullRequestId: 3, title: "PR3", author: "Bob", repoName: "r", mergedDate: "2025-01-12", workItem: { id: 1, title: "WI1", areaPath: "Other" }, url: "" },
      ],
      unlinked: [
        { pullRequestId: 4, title: "PR4", author: "Bob", repoName: "r", mergedDate: "2025-01-13", workItem: null, url: "" },
      ],
    },
  };

  it("returns original data when filteredUniqueNames is empty", () => {
    const result = filterAlignmentData(baseData, new Set());
    expect(result).toBe(baseData);
  });

  it("filters members and recomputes alignment", () => {
    const result = filterAlignmentData(baseData, new Set(["alice@ex.com"]));
    expect(result.members).toHaveLength(1);
    expect(result.members[0].uniqueName).toBe("alice@ex.com");
    expect(result.categorizedPRs.aligned).toHaveLength(1);
    expect(result.categorizedPRs.outOfScope).toHaveLength(0);
    expect(result.categorizedPRs.unlinked).toHaveLength(0);
    expect(result.alignment.total).toBe(1);
    expect(result.alignment.aligned).toBe(1);
    expect(result.alignment.alignedPct).toBe(100);
  });

  it("recomputes percentage correctly for partial filter", () => {
    const result = filterAlignmentData(baseData, new Set(["bob@ex.com"]));
    expect(result.alignment.total).toBe(3); // 1 aligned + 1 outOfScope + 1 unlinked
    expect(result.alignment.aligned).toBe(1);
    expect(result.alignment.alignedPct).toBe(33); // Math.round(1/3*100)
  });
});

// ---------------------------------------------------------------------------
// filterDiagnostics
// ---------------------------------------------------------------------------

describe("filterDiagnostics", () => {
  const baseDiag: DataDiagnostics = {
    period: { days: 14, from: "2025-01-01", to: "2025-01-14", label: "last 14 days" },
    apiLimitHit: false,
    totalProjectPRs: 100,
    rosterMembers: [
      { uniqueName: "alice@ex.com", displayName: "Alice", matchedPRCount: 5, foundInProjectPRs: true },
      { uniqueName: "bob@ex.com", displayName: "Bob", matchedPRCount: 0, foundInProjectPRs: false },
      { uniqueName: "charlie@ex.com", displayName: "Charlie", matchedPRCount: 3, foundInProjectPRs: true },
    ],
    summary: { totalRosterMembers: 3, membersWithPRs: 2, membersNotFound: 1, membersFoundButZero: 0 },
    confidence: "medium",
  };

  it("returns original diagnostics when filteredUniqueNames is empty", () => {
    const result = filterDiagnostics(baseDiag, new Set());
    expect(result).toBe(baseDiag);
  });

  it("filters roster and recomputes summary", () => {
    const result = filterDiagnostics(baseDiag, new Set(["alice@ex.com"]));
    expect(result.rosterMembers).toHaveLength(1);
    expect(result.summary.totalRosterMembers).toBe(1);
    expect(result.summary.membersWithPRs).toBe(1);
    expect(result.summary.membersNotFound).toBe(0);
    expect(result.confidence).toBe("high");
  });

  it("recomputes confidence to low when only unmatched members in filter", () => {
    const result = filterDiagnostics(baseDiag, new Set(["bob@ex.com"]));
    expect(result.summary.membersWithPRs).toBe(0);
    expect(result.confidence).toBe("zero");
  });

  it("recomputes confidence correctly for mixed filter", () => {
    const result = filterDiagnostics(baseDiag, new Set(["alice@ex.com", "bob@ex.com"]));
    expect(result.summary.totalRosterMembers).toBe(2);
    expect(result.summary.membersWithPRs).toBe(1);
    // ratio = 0.5, which triggers "medium" (>= 0.5 and < 0.8)
    expect(result.confidence).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// filterStalePRData
// ---------------------------------------------------------------------------

describe("filterStalePRData", () => {
  const baseData: StalePRResponse = {
    summary: { fresh: 1, aging: 1, stale: 1, total: 3 },
    prs: [
      { id: 1, title: "PR1", author: "Alice", authorUniqueName: "alice@ex.com", repoName: "r", createdDate: "2025-01-14", ageInDays: 1, reviewerCount: 1, staleness: "fresh" },
      { id: 2, title: "PR2", author: "Bob", authorUniqueName: "bob@ex.com", repoName: "r", createdDate: "2025-01-10", ageInDays: 5, reviewerCount: 0, staleness: "aging" },
      { id: 3, title: "PR3", author: "Charlie", authorUniqueName: "charlie@ex.com", repoName: "r", createdDate: "2025-01-01", ageInDays: 14, reviewerCount: 2, staleness: "stale" },
    ],
  };

  it("returns original data when filteredUniqueNames is empty", () => {
    const result = filterStalePRData(baseData, new Set());
    expect(result).toBe(baseData);
  });

  it("filters PRs by authorUniqueName and recomputes summary", () => {
    const result = filterStalePRData(baseData, new Set(["alice@ex.com"]));
    expect(result.prs).toHaveLength(1);
    expect(result.prs[0].author).toBe("Alice");
    expect(result.summary).toEqual({ fresh: 1, aging: 0, stale: 0, total: 1 });
  });

  it("returns empty when no matching authors", () => {
    const result = filterStalePRData(baseData, new Set(["nobody@ex.com"]));
    expect(result.prs).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeFilteredTimeKPIs
// ---------------------------------------------------------------------------

describe("computeFilteredTimeKPIs", () => {
  it("computes correct hour sums and not-logging count", () => {
    const members = [
      makeTimeEntry({ uniqueName: "a@ex.com", displayName: "A", totalHours: 10, capExHours: 6, opExHours: 3 }),
      makeTimeEntry({ uniqueName: "b@ex.com", displayName: "B", totalHours: 8, capExHours: 5, opExHours: 2 }),
      makeTimeEntry({ uniqueName: "c@ex.com", displayName: "C", totalHours: 0, capExHours: 0, opExHours: 0 }),
    ];
    const result = computeFilteredTimeKPIs(members);
    expect(result.totalHours).toBe(18);
    expect(result.capExHours).toBe(11);
    expect(result.opExHours).toBe(5);
    expect(result.membersNotLogging).toBe(1);
    expect(result.membersLogging).toBe(2);
  });

  it("excludes excluded members", () => {
    const members = [
      makeTimeEntry({ uniqueName: "a@ex.com", displayName: "A", totalHours: 10, capExHours: 6, opExHours: 3 }),
      makeTimeEntry({ uniqueName: "b@ex.com", displayName: "B", totalHours: 0, capExHours: 0, opExHours: 0, isExcluded: true }),
    ];
    const result = computeFilteredTimeKPIs(members);
    expect(result.totalHours).toBe(10);
    expect(result.membersNotLogging).toBe(0);
    expect(result.membersLogging).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeFilteredGovernance
// ---------------------------------------------------------------------------

describe("computeFilteredGovernance", () => {
  const baseGov: GovernanceData = {
    expectedHours: 320, // 8 * 10 * 4
    businessDays: 10,
    hoursPerDay: 8,
    activeMembers: 4,
    compliancePct: 75,
    isCompliant: false,
  };

  it("recalculates for filtered member count", () => {
    const result = computeFilteredGovernance(baseGov, 160, 2);
    expect(result.activeMembers).toBe(2);
    expect(result.expectedHours).toBe(160); // 8 * 10 * 2
    expect(result.compliancePct).toBe(100);
    expect(result.isCompliant).toBe(true);
  });

  it("handles zero expected hours", () => {
    const result = computeFilteredGovernance(baseGov, 0, 0);
    expect(result.expectedHours).toBe(0);
    expect(result.compliancePct).toBe(0);
    expect(result.isCompliant).toBe(false);
  });

  it("preserves businessDays and hoursPerDay", () => {
    const result = computeFilteredGovernance(baseGov, 80, 1);
    expect(result.businessDays).toBe(10);
    expect(result.hoursPerDay).toBe(8);
  });
});
