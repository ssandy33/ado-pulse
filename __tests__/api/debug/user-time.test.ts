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

// Mock 7pace modules
jest.mock("@/lib/sevenPace", () => ({
  getSevenPaceConfig: jest.fn().mockResolvedValue({
    apiToken: "test-token",
    baseUrl: "https://test.timehub.7pace.com/api/rest",
  }),
  sevenPaceFetch: jest.fn().mockImplementation((_config, path) => {
    if (path === "users") {
      return Promise.resolve({
        data: [
          {
            id: "user-1",
            email: "test@arrivia.com",
            uniqueName: "test@arrivia.com",
            displayName: "Test User",
          },
        ],
      });
    }
    // workLogs/all
    return Promise.resolve({
      data: [
        {
          id: "wl-1",
          user: { id: "user-1", uniqueName: "test@arrivia.com" },
          workItemId: 12345,
          length: 7200,
          timestamp: "2026-02-15T10:00:00",
          activityType: { name: "Development" },
        },
      ],
    });
  }),
}));

// Mock ADO work items
jest.mock("@/lib/ado/workItems", () => ({
  getWorkItems: jest.fn().mockResolvedValue(
    new Map([
      [
        12345,
        {
          id: 12345,
          fields: {
            "System.Title": "Test Story",
            "System.WorkItemType": "User Story",
          },
        },
      ],
    ])
  ),
}));

// Mock settings reader (used by extractConfig fallback)
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
});
