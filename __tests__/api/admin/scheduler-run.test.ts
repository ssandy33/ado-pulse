import { NextRequest } from "next/server";

const mockRunSchedulerNow = jest.fn();

jest.mock("@/lib/scheduler", () => ({
  runSchedulerNow: (...args: unknown[]) => mockRunSchedulerNow(...args),
}));

import { POST } from "@/app/api/admin/scheduler/run/route";

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, ADMIN_SECRET: "test-secret-123" };
});

afterEach(() => {
  process.env = originalEnv;
});

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/admin/scheduler/run", {
    method: "POST",
    headers,
  });
}

describe("POST /api/admin/scheduler/run", () => {
  it("rejects without admin secret", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects with wrong admin secret", async () => {
    const res = await POST(makeRequest({ "x-admin-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("triggers scheduler with valid admin secret", async () => {
    mockRunSchedulerNow.mockResolvedValue({
      teams: ["alpha"],
      results: [{ team: "alpha", prStatus: "saved", timeStatus: "saved" }],
      durationMs: 500,
    });

    const res = await POST(makeRequest({ "x-admin-secret": "test-secret-123" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.teams).toEqual(["alpha"]);
    expect(body.durationMs).toBe(500);
    expect(mockRunSchedulerNow).toHaveBeenCalled();
  });

  it("returns 500 when scheduler throws", async () => {
    mockRunSchedulerNow.mockRejectedValue(new Error("Scheduler crashed"));

    const res = await POST(makeRequest({ "x-admin-secret": "test-secret-123" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Scheduler crashed");
  });
});
