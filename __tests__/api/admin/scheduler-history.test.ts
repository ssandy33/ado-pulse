jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockGetSchedulerHistory = jest.fn();
const mockGetLastSchedulerRun = jest.fn();

jest.mock("@/lib/schedulerLog", () => ({
  getSchedulerHistory: (...args: unknown[]) => mockGetSchedulerHistory(...args),
  getLastSchedulerRun: () => mockGetLastSchedulerRun(),
}));

import { GET } from "@/app/api/admin/scheduler/history/route";

describe("GET /api/admin/scheduler/history", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns history with limit", async () => {
    mockGetSchedulerHistory.mockReturnValue([
      {
        id: 1,
        snapshotDate: "2026-03-01",
        jobType: "nightly",
        status: "success",
        teamsSaved: 3,
        errorMsg: null,
        durationMs: 1200,
        createdAt: "2026-03-01 02:00:00",
      },
    ]);
    mockGetLastSchedulerRun.mockReturnValue({
      id: 1,
      snapshotDate: "2026-03-01",
      jobType: "nightly",
      status: "success",
      teamsSaved: 3,
      errorMsg: null,
      durationMs: 1200,
      createdAt: "2026-03-01 02:00:00",
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.lastRun).not.toBeNull();
    expect(body.lastRun.status).toBe("success");
  });

  it("returns empty when no history", async () => {
    mockGetSchedulerHistory.mockReturnValue([]);
    mockGetLastSchedulerRun.mockReturnValue(null);

    const res = await GET();
    const body = await res.json();
    expect(body.runs).toHaveLength(0);
    expect(body.lastRun).toBeNull();
  });
});
