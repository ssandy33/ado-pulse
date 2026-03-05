jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  mkdirSync: jest.fn(),
}));

jest.mock("better-sqlite3", () => {
  const Actual = jest.requireActual("better-sqlite3");
  return function () {
    return new Actual(":memory:");
  };
});

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

jest.mock("node-cron", () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

import cron from "node-cron";
import { closeDb } from "@/lib/db";
import { startScheduler, stopScheduler, runSchedulerNow } from "@/lib/scheduler";

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  closeDb();
});

describe("scheduler", () => {
  it("startScheduler no-ops without SCHEDULED_TEAMS", () => {
    process.env.SCHEDULED_TEAMS = "";
    startScheduler();
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it("startScheduler creates cron task when SCHEDULED_TEAMS is set", () => {
    process.env.SCHEDULED_TEAMS = "team-alpha,team-beta";
    startScheduler();
    expect(cron.schedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function));
  });

  it("runSchedulerNow returns empty results when ADO credentials missing", async () => {
    process.env.SCHEDULED_TEAMS = "team-alpha";
    process.env.ADO_ORG = "";
    process.env.ADO_PROJECT = "";
    process.env.ADO_PAT = "";

    const result = await runSchedulerNow();
    expect(result.results).toHaveLength(0);
    expect(result.teams).toEqual(["team-alpha"]);
  });

  it("runSchedulerNow processes each team independently", async () => {
    process.env.SCHEDULED_TEAMS = "team-alpha,team-beta";
    process.env.ADO_ORG = "myorg";
    process.env.ADO_PROJECT = "myproject";
    process.env.ADO_PAT = "faketoken";
    process.env.PORT = "3000";

    const mockFetch = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    global.fetch = mockFetch;

    const result = await runSchedulerNow();

    expect(result.teams).toEqual(["team-alpha", "team-beta"]);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].team).toBe("team-alpha");
    expect(result.results[1].team).toBe("team-beta");
    expect(result.results[0].prStatus).toBe("error");
    expect(result.results[1].prStatus).toBe("error");
  });

  it("stopScheduler stops the cron task", () => {
    const mockStop = jest.fn();
    (cron.schedule as jest.Mock).mockReturnValue({ stop: mockStop });
    process.env.SCHEDULED_TEAMS = "team-alpha";

    startScheduler();
    stopScheduler();
    expect(mockStop).toHaveBeenCalled();
  });
});
