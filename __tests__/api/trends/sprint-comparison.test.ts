import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockAggregateSprintComparison = jest.fn();

jest.mock("@/lib/trends", () => ({
  aggregateSprintComparison: (...args: unknown[]) => mockAggregateSprintComparison(...args),
}));

jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/trends/sprint-comparison/route";

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
) {
  const url = new URL("http://localhost:3000/api/trends/sprint-comparison");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers });
}

const validHeaders = {
  "x-ado-org": "myorg",
  "x-ado-project": "myproject",
  "x-ado-pat": "faketoken",
};

describe("GET /api/trends/sprint-comparison", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without credentials", async () => {
    const res = await GET(makeRequest({ team: "alpha" }));
    expect(res.status).toBe(401);
  });

  it("returns comparison when data exists", async () => {
    mockAggregateSprintComparison.mockReturnValue({
      current: { totalPRs: 12, avgPRAgeDays: 2.0, alignmentScore: 75, days: 14 },
      previous: { totalPRs: 8, avgPRAgeDays: 3.5, alignmentScore: 60, days: 14 },
      delta: { totalPRs: 4, avgPRAgeDays: -1.5, alignmentScore: 15 },
    });

    const res = await GET(makeRequest({ team: "alpha" }, validHeaders));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current.totalPRs).toBe(12);
    expect(body.delta.totalPRs).toBe(4);
  });

  it("returns insufficient_data error when no data", async () => {
    mockAggregateSprintComparison.mockReturnValue(null);

    const res = await GET(makeRequest({ team: "alpha" }, validHeaders));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe("insufficient_data");
  });
});
