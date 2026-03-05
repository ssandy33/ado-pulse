import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockAggregateWeeklyHoursTrends = jest.fn();

jest.mock("@/lib/trends", () => ({
  aggregateWeeklyHoursTrends: (...args: unknown[]) => mockAggregateWeeklyHoursTrends(...args),
}));

jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
}));

import { GET } from "@/app/api/trends/time-hours/route";

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
) {
  const url = new URL("http://localhost:3000/api/trends/time-hours");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { headers });
}

const validHeaders = {
  "x-ado-org": "myorg",
  "x-ado-project": "myproject",
  "x-ado-pat": "faketoken",
};

describe("GET /api/trends/time-hours", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without credentials", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns weekly hours trends", async () => {
    mockAggregateWeeklyHoursTrends.mockReturnValue([
      { weekStart: "2026-02-17", weekLabel: "Feb 17", totalHours: 100, capExHours: 60, opExHours: 40 },
      { weekStart: "2026-02-24", weekLabel: "Feb 24", totalHours: 120, capExHours: 80, opExHours: 40 },
      { weekStart: "2026-03-03", weekLabel: "Mar 3", totalHours: 130, capExHours: 85, opExHours: 45 },
    ]);

    const res = await GET(makeRequest({}, validHeaders));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.weeks).toHaveLength(3);
    expect(body.hasEnoughData).toBe(true);
  });

  it("returns hasEnoughData:false with few weeks", async () => {
    mockAggregateWeeklyHoursTrends.mockReturnValue([
      { weekStart: "2026-03-03", weekLabel: "Mar 3", totalHours: 50, capExHours: 30, opExHours: 20 },
    ]);

    const res = await GET(makeRequest({}, validHeaders));
    const body = await res.json();
    expect(body.hasEnoughData).toBe(false);
  });
});
