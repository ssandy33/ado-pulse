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

import { closeDb } from "@/lib/db";
import {
  logSchedulerRun,
  getSchedulerHistory,
  getLastSchedulerRun,
} from "@/lib/schedulerLog";

afterEach(() => {
  closeDb();
});

describe("schedulerLog", () => {
  it("logSchedulerRun inserts a row", () => {
    logSchedulerRun({
      snapshotDate: "2026-03-01",
      jobType: "nightly",
      status: "success",
      teamsSaved: 3,
      durationMs: 1200,
    });

    const history = getSchedulerHistory();
    expect(history).toHaveLength(1);
    expect(history[0].snapshotDate).toBe("2026-03-01");
    expect(history[0].jobType).toBe("nightly");
    expect(history[0].status).toBe("success");
    expect(history[0].teamsSaved).toBe(3);
    expect(history[0].durationMs).toBe(1200);
    expect(history[0].errorMsg).toBeNull();
  });

  it("logSchedulerRun stores error message", () => {
    logSchedulerRun({
      snapshotDate: "2026-03-01",
      jobType: "nightly",
      status: "error",
      errorMsg: "Connection refused",
    });

    const history = getSchedulerHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("error");
    expect(history[0].errorMsg).toBe("Connection refused");
  });

  it("getSchedulerHistory returns DESC order with limit", () => {
    logSchedulerRun({ snapshotDate: "2026-03-01", jobType: "nightly", status: "success" });
    logSchedulerRun({ snapshotDate: "2026-03-02", jobType: "nightly", status: "partial" });
    logSchedulerRun({ snapshotDate: "2026-03-03", jobType: "nightly", status: "error" });

    const history = getSchedulerHistory(2);
    expect(history).toHaveLength(2);
    // Most recent (by id DESC) first — IDs are auto-increment
    expect(history[0].status).toBe("error");
    expect(history[1].status).toBe("partial");
  });

  it("getLastSchedulerRun returns most recent row", () => {
    logSchedulerRun({ snapshotDate: "2026-03-01", jobType: "nightly", status: "success" });
    logSchedulerRun({ snapshotDate: "2026-03-02", jobType: "nightly", status: "partial" });

    const last = getLastSchedulerRun();
    expect(last).not.toBeNull();
    expect(last!.status).toBe("partial");
  });

  it("getLastSchedulerRun returns null when no runs exist", () => {
    const last = getLastSchedulerRun();
    expect(last).toBeNull();
  });
});
