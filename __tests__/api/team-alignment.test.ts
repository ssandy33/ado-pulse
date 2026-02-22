import { GET } from "@/app/api/prs/team-alignment/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/ado/helpers", () => ({
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
}));

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

jest.mock("@/lib/ado/odata", () => ({
  getPRsWithWorkItems: (...args: unknown[]) =>
    mockGetPRsWithWorkItems(...args),
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

  it("returns 403 with scopeError when Analytics scope missing (401)", async () => {
    const { AdoApiError } = require("@/lib/ado/client");
    mockGetPRsWithWorkItems.mockRejectedValueOnce(
      new AdoApiError("Unauthorized", 401, "https://analytics.dev.azure.com/...")
    );

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.scopeError).toBe(true);
    expect(body.error).toMatch(/Analytics:Read/);
  });

  it("returns 403 with scopeError when Analytics extension not installed (410)", async () => {
    const { AdoApiError } = require("@/lib/ado/client");
    mockGetPRsWithWorkItems.mockRejectedValueOnce(
      new AdoApiError("Gone", 410, "https://analytics.dev.azure.com/...")
    );

    const res = await GET(makeRequest({ team: "TeamA", range: "14" }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.scopeError).toBe(true);
    expect(body.error).toMatch(/Analytics extension/);
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
