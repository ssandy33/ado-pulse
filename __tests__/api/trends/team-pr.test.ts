import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockAggregateWeeklyPRTrends = jest.fn();
const mockAggregateDailyPRTrends = jest.fn();

jest.mock("@/lib/trends", () => ({
  aggregateWeeklyPRTrends: (...args: unknown[]) => mockAggregateWeeklyPRTrends(...args),
  aggregateDailyPRTrends: (...args: unknown[]) => mockAggregateDailyPRTrends(...args),
}));

jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/trends/team-pr/route";

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
) {
  const url = new URL("http://localhost:3000/api/trends/team-pr");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers });
}

const validHeaders = {
  "x-ado-org": "myorg",
  "x-ado-project": "myproject",
  "x-ado-pat": "faketoken",
};

describe("GET /api/trends/team-pr", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without credentials", async () => {
    const res = await GET(makeRequest({ team: "alpha" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 without team parameter", async () => {
    const res = await GET(makeRequest({}, validHeaders));
    expect(res.status).toBe(400);
  });

  it("defaults to daily granularity", async () => {
    mockAggregateDailyPRTrends.mockReturnValue([
      { date: "2026-03-01", dateLabel: "Mar 1", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
      { date: "2026-03-02", dateLabel: "Mar 2", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
      { date: "2026-03-03", dateLabel: "Mar 3", totalPRs: 15, activeContributors: 5, alignmentScore: 80 },
    ]);

    const res = await GET(makeRequest({ team: "alpha" }, validHeaders));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.granularity).toBe("daily");
    expect(body.points).toHaveLength(3);
    expect(body.hasEnoughData).toBe(true);
    expect(body.data_source).toBe("cache");
    expect(mockAggregateDailyPRTrends).toHaveBeenCalledWith("myorg", "myproject", "alpha", 14);
  });

  it("returns daily points with days param", async () => {
    mockAggregateDailyPRTrends.mockReturnValue([
      { date: "2026-02-26", dateLabel: "Feb 26", totalPRs: 5, activeContributors: 2, alignmentScore: null },
    ]);

    const res = await GET(makeRequest({ team: "alpha", granularity: "daily", days: "7" }, validHeaders));
    const body = await res.json();
    expect(body.granularity).toBe("daily");
    expect(mockAggregateDailyPRTrends).toHaveBeenCalledWith("myorg", "myproject", "alpha", 7);
  });

  it("returns weekly points with granularity=weekly (backward compat)", async () => {
    mockAggregateWeeklyPRTrends.mockReturnValue([
      { weekStart: "2026-02-17", weekLabel: "Feb 17", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
      { weekStart: "2026-02-24", weekLabel: "Feb 24", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
      { weekStart: "2026-03-03", weekLabel: "Mar 3", totalPRs: 15, activeContributors: 5, alignmentScore: 80 },
    ]);

    const res = await GET(makeRequest({ team: "alpha", granularity: "weekly" }, validHeaders));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.granularity).toBe("weekly");
    expect(body.weeks).toHaveLength(3);
    expect(body.points).toHaveLength(3);
    expect(body.hasEnoughData).toBe(true);
    expect(body.data_source).toBe("cache");
  });

  it("returns hasEnoughData:false with insufficient data", async () => {
    mockAggregateDailyPRTrends.mockReturnValue([
      { date: "2026-03-03", dateLabel: "Mar 3", totalPRs: 5, activeContributors: 2, alignmentScore: null },
    ]);

    const res = await GET(makeRequest({ team: "alpha" }, validHeaders));
    const body = await res.json();
    expect(body.hasEnoughData).toBe(false);
  });
});
