import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockGetTeamMembers = jest.fn();
const mockGetPullRequests = jest.fn();
const mockBuildPerPersonBuckets = jest.fn();

jest.mock("@/lib/ado/teams", () => ({
  getTeamMembers: (...args: unknown[]) => mockGetTeamMembers(...args),
}));

jest.mock("@/lib/ado/pullRequests", () => ({
  getPullRequests: (...args: unknown[]) => mockGetPullRequests(...args),
}));

jest.mock("@/lib/trends", () => ({
  buildPerPersonBuckets: (...args: unknown[]) => mockBuildPerPersonBuckets(...args),
}));

jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/trends/team-pr-by-member/route";

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
) {
  const url = new URL("http://localhost:3000/api/trends/team-pr-by-member");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers });
}

const validHeaders = {
  "x-ado-org": "myorg",
  "x-ado-project": "myproject",
  "x-ado-pat": "faketoken",
};

const mockMembers = [
  { id: "1", uniqueName: "alice@example.com", displayName: "Alice" },
  { id: "2", uniqueName: "bob@example.com", displayName: "Bob" },
];

const mockPRs = [
  {
    pullRequestId: 1,
    closedDate: "2026-03-01T10:00:00Z",
    createdBy: { id: "1", uniqueName: "alice@example.com", displayName: "Alice" },
    repository: { id: "r1", name: "repo1" },
  },
  {
    pullRequestId: 2,
    closedDate: "2026-03-02T08:00:00Z",
    createdBy: { id: "2", uniqueName: "bob@example.com", displayName: "Bob" },
    repository: { id: "r1", name: "repo1" },
  },
  {
    pullRequestId: 3,
    closedDate: "2026-03-01T12:00:00Z",
    createdBy: { id: "99", uniqueName: "external@example.com", displayName: "External" },
    repository: { id: "r1", name: "repo1" },
  },
];

describe("GET /api/trends/team-pr-by-member", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without credentials", async () => {
    const res = await GET(makeRequest({ team: "alpha" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 without team parameter", async () => {
    const res = await GET(makeRequest({}, validHeaders));
    expect(res.status).toBe(400);
  });

  it("returns members and points for valid request", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue(mockPRs);
    mockBuildPerPersonBuckets.mockReturnValue([
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 1, Bob: 0 },
    ]);

    const res = await GET(makeRequest({ team: "alpha", days: "7" }, validHeaders));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.members).toEqual([
      { uniqueName: "alice@example.com", displayName: "Alice" },
      { uniqueName: "bob@example.com", displayName: "Bob" },
    ]);
    expect(body.points).toHaveLength(1);
  });

  it("filters PRs to team members only", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue(mockPRs);
    mockBuildPerPersonBuckets.mockReturnValue([]);

    await GET(makeRequest({ team: "alpha" }, validHeaders));

    // The PRs passed to buildPerPersonBuckets should exclude the external user
    const passedPRs = mockBuildPerPersonBuckets.mock.calls[0][0];
    expect(passedPRs).toHaveLength(2);
    expect(passedPRs.every((pr: { createdBy: { uniqueName: string } }) =>
      ["alice@example.com", "bob@example.com"].includes(pr.createdBy.uniqueName)
    )).toBe(true);
  });

  it("supports explicit date range params", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue([]);
    mockBuildPerPersonBuckets.mockReturnValue([]);

    const res = await GET(
      makeRequest(
        { team: "alpha", startDate: "2026-03-01", endDate: "2026-03-07" },
        validHeaders
      )
    );
    expect(res.status).toBe(200);

    // Verify date range passed to buildPerPersonBuckets
    expect(mockBuildPerPersonBuckets).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      "2026-03-01",
      "2026-03-07"
    );
  });

  it("returns 400 when startDate is after endDate", async () => {
    const res = await GET(
      makeRequest(
        { team: "alpha", startDate: "2026-03-10", endDate: "2026-03-01" },
        validHeaders
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when date range exceeds 90 days", async () => {
    const res = await GET(
      makeRequest(
        { team: "alpha", startDate: "2026-01-01", endDate: "2026-06-01" },
        validHeaders
      )
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid calendar date (rollover)", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue([]);
    mockBuildPerPersonBuckets.mockReturnValue([]);

    const res = await GET(
      makeRequest(
        { team: "alpha", startDate: "2026-02-30", endDate: "2026-03-01" },
        validHeaders
      )
    );
    // Invalid date falls back to days-based range (not treated as explicit range)
    expect(res.status).toBe(200);
    expect(mockBuildPerPersonBuckets).toHaveBeenCalled();
  });

  it("falls back to days when only startDate provided", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue([]);
    mockBuildPerPersonBuckets.mockReturnValue([]);

    const res = await GET(
      makeRequest(
        { team: "alpha", startDate: "2026-03-01" },
        validHeaders
      )
    );
    // Missing endDate — falls back to days-based range
    expect(res.status).toBe(200);
  });

  it("falls back to days when only endDate provided", async () => {
    mockGetTeamMembers.mockResolvedValue(mockMembers);
    mockGetPullRequests.mockResolvedValue([]);
    mockBuildPerPersonBuckets.mockReturnValue([]);

    const res = await GET(
      makeRequest(
        { team: "alpha", endDate: "2026-03-01" },
        validHeaders
      )
    );
    // Missing startDate — falls back to days-based range
    expect(res.status).toBe(200);
  });
});
