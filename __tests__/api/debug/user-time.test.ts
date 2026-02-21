import { GET } from "@/app/api/debug/user-time/route";
import { NextRequest } from "next/server";

// Mock extractConfig to return valid ADO config
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

// Mock ADO client (used by fetchWorkItemsWithState in the route)
jest.mock("@/lib/ado/client", () => ({
  adoFetch: jest.fn().mockResolvedValue({
    count: 1,
    value: [
      {
        id: 12345,
        fields: {
          "System.Title": "Test Story",
          "System.WorkItemType": "User Story",
          "System.State": "Active",
          "System.Parent": 99999,
          "Custom.FeatureExpense": undefined,
        },
      },
    ],
  }),
  projectUrl: jest.fn(
    (_config: unknown, path: string) =>
      `https://dev.azure.com/test-org/test-project/${path}`
  ),
  batchAsync: jest.fn(async (tasks: (() => Promise<unknown>)[]) => {
    const results = [];
    for (const task of tasks) {
      results.push(await task());
    }
    return results;
  }),
}));

// Mock 7pace — now uses getWorklogsForUser (OData) instead of sevenPaceFetch (REST)
jest.mock("@/lib/sevenPace", () => ({
  getSevenPaceConfig: jest.fn().mockResolvedValue({
    apiToken: "test-token",
    baseUrl: "https://test.timehub.7pace.com/api/rest",
  }),
  getWorklogsForUser: jest.fn().mockResolvedValue({
    worklogs: [
      {
        id: "wl-1",
        userId: "user-1",
        uniqueName: "test@arrivia.com",
        displayName: "Test User",
        workItemId: 12345,
        hours: 2,
        date: "2026-02-15T10:00:00",
        activityType: "Development",
      },
    ],
    rawResponseKeys: ["@odata.context", "value"],
    rawCount: 1,
    requestUrl: "https://test.timehub.7pace.com/api/odata/v3.2/workLogsOnly?...",
    fetchApi: "odata",
    pagination: { pagesFetched: 1, totalRecords: 1, hitSafetyCap: false },
  }),
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

// Mock resolveFeature from workItems
jest.mock("@/lib/ado/workItems", () => ({
  resolveFeature: jest.fn().mockResolvedValue({
    featureId: 99999,
    featureTitle: "Test Feature",
    expenseType: "CapEx",
  }),
}));

// Mock settings reader
jest.mock("@/lib/settings", () => ({
  readSettings: jest.fn().mockResolvedValue({}),
}));

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/debug/user-time");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    headers: {
      "x-ado-org": "test-org",
      "x-ado-project": "test-project",
      "x-ado-pat": "test-pat",
    },
  });
}

function daysDiff(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
}

const EXPECTED_DAYS = 30;
const TOLERANCE = 1;

describe("GET /api/debug/user-time — date window", () => {
  it("returns a ~30-day window when no time param is provided", async () => {
    const res = await GET(makeRequest({ email: "test@arrivia.com" }));
    const body = await res.json();
    expect(body.summary.period.days).toBe(EXPECTED_DAYS);
    const diff = daysDiff(body.summary.period.from, body.summary.period.to);
    expect(diff).toBeGreaterThanOrEqual(EXPECTED_DAYS - TOLERANCE);
    expect(diff).toBeLessThanOrEqual(EXPECTED_DAYS + TOLERANCE);
  });

  it("returns a ~30-day window even when days=7 is passed", async () => {
    const res = await GET(
      makeRequest({ email: "test@arrivia.com", days: "7" })
    );
    const body = await res.json();
    expect(body.summary.period.days).toBe(EXPECTED_DAYS);
    const diff = daysDiff(body.summary.period.from, body.summary.period.to);
    expect(diff).toBeGreaterThanOrEqual(EXPECTED_DAYS - TOLERANCE);
  });

  it("returns a ~30-day window even when days=14 is passed", async () => {
    const res = await GET(
      makeRequest({ email: "test@arrivia.com", days: "14" })
    );
    const body = await res.json();
    expect(body.summary.period.days).toBe(EXPECTED_DAYS);
    const diff = daysDiff(body.summary.period.from, body.summary.period.to);
    expect(diff).toBeGreaterThanOrEqual(EXPECTED_DAYS - TOLERANCE);
  });

  it("ignores a range=mtd param if passed", async () => {
    const res = await GET(
      makeRequest({ email: "test@arrivia.com", range: "mtd" })
    );
    const body = await res.json();
    expect(body.summary.period.days).toBe(EXPECTED_DAYS);
    const diff = daysDiff(body.summary.period.from, body.summary.period.to);
    expect(diff).toBeGreaterThanOrEqual(EXPECTED_DAYS - TOLERANCE);
  });

  it("returns 400 when email is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("includes feature and classification in work items", async () => {
    const res = await GET(makeRequest({ email: "test@arrivia.com" }));
    const body = await res.json();
    expect(body.workItems).toHaveLength(1);
    expect(body.workItems[0].featureId).toBe(99999);
    expect(body.workItems[0].featureTitle).toBe("Test Feature");
    expect(body.workItems[0].classification).toBe("CapEx");
    expect(body.workItems[0].state).toBe("Active");
  });

  it("includes uniqueName in entry response for user verification", async () => {
    const res = await GET(makeRequest({ email: "test@arrivia.com" }));
    const body = await res.json();
    expect(body.workItems[0].entries[0].uniqueName).toBe("test@arrivia.com");
  });

  it("includes OData fetch info in debug block", async () => {
    const res = await GET(makeRequest({ email: "test@arrivia.com" }));
    const body = await res.json();
    expect(body._debug.fetchApi).toBe("odata");
    expect(body._debug.pagination).toBeDefined();
  });
});
