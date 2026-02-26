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

import { getDb, closeDb } from "@/lib/db";

afterEach(() => {
  closeDb();
});

describe("getDb", () => {
  it("returns a working database instance", () => {
    const db = getDb();
    expect(db).toBeDefined();
    // Smoke-test: a simple query should not throw
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    expect(row.ok).toBe(1);
  });

  it("creates the team_pr_snapshots table", () => {
    const db = getDb();
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='team_pr_snapshots'"
      )
      .get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe("team_pr_snapshots");
  });

  it("creates the time_tracking_snapshots table", () => {
    const db = getDb();
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='time_tracking_snapshots'"
      )
      .get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe("time_tracking_snapshots");
  });

  it("creates the scheduler_log table", () => {
    const db = getDb();
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='scheduler_log'"
      )
      .get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe("scheduler_log");
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("returns a fresh instance after closeDb()", () => {
    const db1 = getDb();
    closeDb();
    const db2 = getDb();
    expect(db2).toBeDefined();
    expect(db2).not.toBe(db1);
  });
});
