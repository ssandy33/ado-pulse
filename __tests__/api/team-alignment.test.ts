import { GET } from "@/app/api/prs/team-alignment/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

jest.mock("@/lib/ado/helpers", () => {
  const actual = jest.requireActual("@/lib/ado/helpers");
  return {
    extractConfig: jest.fn().mockResolvedValue({
      org: "test-org",
      project: "test-project",
      pat: "test-pat",
    }),
    jsonWithCache: jest.fn((data: unknown) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json(data);
    }),
    handleApiError: jest.fn((error: unknown) => {
      const { NextResponse } = require("next/server");
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      return NextResponse.json({ error: message }, { status: 500 });
    }),
    coerceAdoApiError: actual.coerceAdoApiError,
  };
});

jest.mock("@/lib/ado/teams", () => ({
  getTeamMembers: jest.fn().mockResolvedValue([
    { id: "1", displayName: "Alice", uniqueName: "alice@test.com" },
    { id: "2", displayName: "Bob", uniqueName: "bob@test.com" },
  ]),
  getTeamAreaPath: jest.fn().mockResolvedValue({
    defaultAreaPath: "Project\\TeamA",
    areaPaths: ["Project\\TeamA"],
  }),
}));

const mockGetPRsWithWorkItems = jest.fn();
const mockGetPRsWithWorkItemsREST = jest.fn();

jest.mock("@/lib/ado/odata", () => ({
  getPRsWithWorkItems: (...args: unknown[]) =>
    mockGetPRsWithWorkItems(...args),
}));

jest.mock("@/lib/ado/pullRequests", () => ({
  getPRsWithWorkItemsREST: (...args: unknown[]) =>
    mockGetPRsWithWorkItemsREST(...args),
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/prs/team-alignment");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, {
    headers: {
      "x-ado-org": "test-org",
      "x-ado-project": "test-project",
      "x-ado-pat": "test-pat",
    },
  });
}

describe("GET /api/prs/team-alignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when no team specified", async () => {
    const res = await GET(makeRequest({ range: "14" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No team specified/);
  });

  it("classifies PRs correctly: aligned, out-of-scope, unlinked", async () => {
    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "Aligned PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA\\SubArea" }],
      },
      {
        PullRequestId: 2,
        Title: "Out of scope PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 200, AreaPath: "Project\\TeamB" }],
      },
      {
        PullRequestId: 3,
        Title: "Unlinked PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "bob@test.com", UserEmail: "bob@test.com" },
        WorkItems: [],
      },
      {
        PullRequestId: 4,
        Title: "Exact area path match",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "bob@test.com", UserEmail: "bob@test.com" },
        WorkItems: [{ WorkItemId: 300, AreaPath: "Project\\TeamA" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.alignment.total).toBe(4);
    expect(body.alignment.aligned).toBe(2);
    expect(body.alignment.outOfScope).toBe(1);
    expect(body.alignment.unlinked).toBe(1);
    expect(body.alignment.alignedPct).toBe(50);
    expect(body.teamAreaPath).toBe("Project\\TeamA");
  });

  it("per-member breakdowns sum to team totals", async () => {
    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "Alice aligned",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA" }],
      },
      {
        PullRequestId: 2,
        Title: "Bob unlinked",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "bob@test.com", UserEmail: "bob@test.com" },
        WorkItems: [],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    const body = await res.json();

    const memberTotals = body.members.reduce(
      (acc: { aligned: number; outOfScope: number; unlinked: number }, m: { alignment: { aligned: number; outOfScope: { count: number }; unlinked: number } }) => ({
        aligned: acc.aligned + m.alignment.aligned,
        outOfScope: acc.outOfScope + m.alignment.outOfScope.count,
        unlinked: acc.unlinked + m.alignment.unlinked,
      }),
      { aligned: 0, outOfScope: 0, unlinked: 0 }
    );

    expect(memberTotals.aligned).toBe(body.alignment.aligned);
    expect(memberTotals.outOfScope).toBe(body.alignment.outOfScope);
    expect(memberTotals.unlinked).toBe(body.alignment.unlinked);
  });

  it("falls back to REST when OData returns 401", async () => {
    const { AdoApiError } = require("@/lib/ado/client");
    mockGetPRsWithWorkItems.mockRejectedValueOnce(
      new AdoApiError("Unauthorized", 401, "https://analytics.dev.azure.com/...")
    );
    mockGetPRsWithWorkItemsREST.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "REST fallback PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.alignment.total).toBe(1);
    expect(body.alignment.aligned).toBe(1);
    expect(mockGetPRsWithWorkItemsREST).toHaveBeenCalledTimes(1);
  });

  it("falls back to REST when OData returns 410 (Analytics not installed)", async () => {
    const { AdoApiError } = require("@/lib/ado/client");
    mockGetPRsWithWorkItems.mockRejectedValueOnce(
      new AdoApiError("Gone", 410, "https://analytics.dev.azure.com/...")
    );
    mockGetPRsWithWorkItemsREST.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "REST fallback PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "bob@test.com", UserEmail: "bob@test.com" },
        WorkItems: [],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.alignment.total).toBe(1);
    expect(body.alignment.unlinked).toBe(1);
    expect(mockGetPRsWithWorkItemsREST).toHaveBeenCalledTimes(1);
  });

  it("does not call REST fallback when OData succeeds", async () => {
    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "OData PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);
    expect(mockGetPRsWithWorkItemsREST).not.toHaveBeenCalled();
  });

  it("propagates non-410/401 errors to outer handler", async () => {
    const { AdoApiError } = require("@/lib/ado/client");
    mockGetPRsWithWorkItems.mockRejectedValueOnce(
      new AdoApiError("Internal Server Error", 500, "https://analytics.dev.azure.com/...")
    );

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(500);
    expect(mockGetPRsWithWorkItemsREST).not.toHaveBeenCalled();
  });

  it("filters PRs to team members only (case-insensitive)", async () => {
    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "Team member PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "ALICE@TEST.COM", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA" }],
      },
      {
        PullRequestId: 2,
        Title: "External PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "external@other.com", UserEmail: "external@other.com" },
        WorkItems: [{ WorkItemId: 200, AreaPath: "Project\\TeamA" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    const body = await res.json();

    // Only 1 PR should be counted (external is filtered out)
    expect(body.alignment.total).toBe(1);
    expect(body.alignment.aligned).toBe(1);
  });

  it("falls back to REST when error has AdoApiError shape but fails instanceof (bundling edge case)", async () => {
    // Simulate a module bundling issue where instanceof fails
    // but the error has the correct name and status properties
    const error = new Error("ADO API error: 410 Gone");
    error.name = "AdoApiError";
    (error as Error & { status: number; url: string }).status = 410;
    (error as Error & { status: number; url: string }).url = "https://analytics.dev.azure.com/...";

    mockGetPRsWithWorkItems.mockRejectedValueOnce(error);
    mockGetPRsWithWorkItemsREST.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "REST fallback PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamA" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.alignment.total).toBe(1);
    expect(mockGetPRsWithWorkItemsREST).toHaveBeenCalledTimes(1);
  });

  it("returns categorizedPRs with correct shape, URL, and author display names", async () => {
    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "Aligned PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-10",
        RepositoryName: "my-repo",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [
          { WorkItemId: 100, AreaPath: "Project\\TeamA\\SubArea", Title: "My work item" },
        ],
      },
      {
        PullRequestId: 2,
        Title: "Out of scope PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-10",
        RepositoryName: "other-repo",
        CreatedBy: { UserName: "bob@test.com", UserEmail: "bob@test.com" },
        WorkItems: [
          { WorkItemId: 200, AreaPath: "Project\\TeamB", Title: "Other item" },
        ],
      },
      {
        PullRequestId: 3,
        Title: "Unlinked PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-10",
        RepositoryName: "unlinked-repo",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    const { categorizedPRs } = body;

    // Three arrays must be present
    expect(Array.isArray(categorizedPRs.aligned)).toBe(true);
    expect(Array.isArray(categorizedPRs.outOfScope)).toBe(true);
    expect(Array.isArray(categorizedPRs.unlinked)).toBe(true);

    // Correct distribution
    expect(categorizedPRs.aligned).toHaveLength(1);
    expect(categorizedPRs.outOfScope).toHaveLength(1);
    expect(categorizedPRs.unlinked).toHaveLength(1);

    // Aligned PR shape
    const alignedPR = categorizedPRs.aligned[0];
    expect(alignedPR.pullRequestId).toBe(1);
    expect(alignedPR.title).toBe("Aligned PR");
    expect(alignedPR.author).toBe("Alice");
    expect(alignedPR.repoName).toBe("my-repo");
    expect(alignedPR.mergedDate).toBe("2025-01-10");
    expect(alignedPR.workItem).toEqual({
      id: 100,
      title: "My work item",
      areaPath: "Project\\TeamA\\SubArea",
    });
    expect(alignedPR.url).toBe(
      "https://dev.azure.com/test-org/test-project/_git/my-repo/pullrequest/1"
    );

    // Out-of-scope PR shape
    const outOfScopePR = categorizedPRs.outOfScope[0];
    expect(outOfScopePR.pullRequestId).toBe(2);
    expect(outOfScopePR.title).toBe("Out of scope PR");
    expect(outOfScopePR.author).toBe("Bob");
    expect(outOfScopePR.repoName).toBe("other-repo");
    expect(outOfScopePR.workItem).toEqual({
      id: 200,
      title: "Other item",
      areaPath: "Project\\TeamB",
    });
    expect(outOfScopePR.url).toBe(
      "https://dev.azure.com/test-org/test-project/_git/other-repo/pullrequest/2"
    );

    // Unlinked PR shape — workItem must be null
    const unlinkedPR = categorizedPRs.unlinked[0];
    expect(unlinkedPR.pullRequestId).toBe(3);
    expect(unlinkedPR.title).toBe("Unlinked PR");
    expect(unlinkedPR.author).toBe("Alice");
    expect(unlinkedPR.repoName).toBe("unlinked-repo");
    expect(unlinkedPR.workItem).toBeNull();
    expect(unlinkedPR.url).toBe(
      "https://dev.azure.com/test-org/test-project/_git/unlinked-repo/pullrequest/3"
    );
  });

  it("does not match area path prefix without backslash boundary", async () => {
    const { getTeamAreaPath } = require("@/lib/ado/teams");
    getTeamAreaPath.mockResolvedValueOnce({
      defaultAreaPath: "Project\\TeamA",
      areaPaths: ["Project\\TeamA"],
    });

    mockGetPRsWithWorkItems.mockResolvedValueOnce([
      {
        PullRequestId: 1,
        Title: "False positive PR",
        CreatedDate: "2025-01-01",
        CompletedDate: "2025-01-02",
        CreatedBy: { UserName: "alice@test.com", UserEmail: "alice@test.com" },
        WorkItems: [{ WorkItemId: 100, AreaPath: "Project\\TeamAlpha" }],
      },
    ]);

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    const body = await res.json();

    // Should be out-of-scope, not aligned (TeamAlpha != TeamA)
    expect(body.alignment.aligned).toBe(0);
    expect(body.alignment.outOfScope).toBe(1);
  });
});
