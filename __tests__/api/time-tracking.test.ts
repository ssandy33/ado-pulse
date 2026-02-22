import { GET } from "@/app/api/timetracking/team-summary/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

// Mock extractConfig
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

// Mock ADO client (batchAsync used for per-member fetches)
jest.mock("@/lib/ado/client", () => ({
  batchAsync: jest.fn(async (fns: (() => Promise<unknown>)[]) => {
    const results = [];
    for (const fn of fns) results.push(await fn());
    return results;
  }),
}));

// Mock 7pace — now uses getWorklogsForUser (OData) instead of getSevenPaceWorklogs (REST)
const mockGetWorklogsForUser = jest.fn().mockResolvedValue({
  worklogs: [],
  rawResponseKeys: ["@odata.context", "value"],
  rawCount: 0,
  requestUrl: "",
  fetchApi: "odata",
  pagination: { pagesFetched: 1, totalRecords: 0, hitSafetyCap: false },
});

jest.mock("@/lib/sevenPace", () => ({
  getSevenPaceConfig: jest.fn().mockResolvedValue({
    apiToken: "test-token",
    baseUrl: "https://test.timehub.7pace.com/api/rest",
  }),
  getSevenPaceUsers: jest.fn().mockResolvedValue(
    new Map([["sp-user-1", "dev@test.com"]])
  ),
  getWorklogsForUser: (...args: unknown[]) => mockGetWorklogsForUser(...args),
  SevenPaceApiError: class extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

// Mock ADO teams — return one member that maps to the 7pace user
jest.mock("@/lib/ado/teams", () => ({
  getTeamMembers: jest.fn().mockResolvedValue([
    { id: "m1", displayName: "Dev One", uniqueName: "dev@test.com" },
  ]),
}));

// Mock ADO work items
jest.mock("@/lib/ado/workItems", () => ({
  getWorkItems: jest.fn().mockResolvedValue(new Map()),
  resolveFeature: jest.fn().mockResolvedValue({
    featureId: null,
    featureTitle: "No Feature",
    expenseType: "Unclassified",
  }),
}));

// Mock settings
jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
  getExclusions: jest.fn().mockResolvedValue([]),
}));

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/timetracking/team-summary");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    headers: {
      "x-ado-org": "test-org",
      "x-ado-project": "test-project",
      "x-ado-pat": "test-pat",
    },
  });
}

function daysDiff(from: string | Date, to: string | Date): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
}

describe("GET /api/timetracking/team-summary — date window changes with range param", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes a ~7-day window to getWorklogsForUser when range=7", async () => {
    await GET(makeRequest({ range: "7", team: "Partner" }));

    // Per-member OData fetch: called once for the one team member
    expect(mockGetWorklogsForUser).toHaveBeenCalledTimes(1);
    const [, email, fromArg, toArg] = mockGetWorklogsForUser.mock.calls[0];
    expect(email).toBe("dev@test.com");
    const diff = daysDiff(fromArg, toArg);
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThanOrEqual(8);
  });

  it("passes a ~14-day window to getWorklogsForUser when range=14", async () => {
    await GET(makeRequest({ range: "14", team: "Partner" }));

    expect(mockGetWorklogsForUser).toHaveBeenCalledTimes(1);
    const [, email, fromArg, toArg] = mockGetWorklogsForUser.mock.calls[0];
    expect(email).toBe("dev@test.com");
    const diff = daysDiff(fromArg, toArg);
    expect(diff).toBeGreaterThanOrEqual(13);
    expect(diff).toBeLessThanOrEqual(15);
  });

  it("passes from-1st-of-month when range=mtd", async () => {
    await GET(makeRequest({ range: "mtd", team: "Partner" }));

    expect(mockGetWorklogsForUser).toHaveBeenCalledTimes(1);
    const [, , fromArg] = mockGetWorklogsForUser.mock.calls[0];
    expect(new Date(fromArg).getDate()).toBe(1);
  });

  it("7 and 14 produce different from dates", async () => {
    await GET(makeRequest({ range: "7", team: "Partner" }));
    const from7 = mockGetWorklogsForUser.mock.calls[0][2] as Date;

    jest.clearAllMocks();

    await GET(makeRequest({ range: "14", team: "Partner" }));
    const from14 = mockGetWorklogsForUser.mock.calls[0][2] as Date;

    expect(from7.getTime()).not.toBe(from14.getTime());
  });

  it("includes range in the response period", async () => {
    const res = await GET(makeRequest({ range: "7", team: "Partner" }));
    const body = await res.json();
    expect(body.period.days).toBe(7);
  });

  it("passes email to getWorklogsForUser for per-member OData filtering", async () => {
    await GET(makeRequest({ range: "7", team: "Partner" }));

    expect(mockGetWorklogsForUser).toHaveBeenCalledTimes(1);
    const [, email] = mockGetWorklogsForUser.mock.calls[0];
    expect(email).toBe("dev@test.com");
  });
});
