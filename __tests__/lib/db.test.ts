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

  it("adds source column to team_pr_snapshots with default 'on-fetch'", () => {
    const db = getDb();
    const cols = db
      .prepare("SELECT name, dflt_value FROM pragma_table_info('team_pr_snapshots')")
      .all() as Array<{ name: string; dflt_value: string | null }>;
    const sourceCol = cols.find((c) => c.name === "source");
    expect(sourceCol).toBeDefined();
    expect(sourceCol!.dflt_value).toBe("'on-fetch'");
  });

  it("adds source column to time_tracking_snapshots with default 'on-fetch'", () => {
    const db = getDb();
    const cols = db
      .prepare("SELECT name, dflt_value FROM pragma_table_info('time_tracking_snapshots')")
      .all() as Array<{ name: string; dflt_value: string | null }>;
    const sourceCol = cols.find((c) => c.name === "source");
    expect(sourceCol).toBeDefined();
    expect(sourceCol!.dflt_value).toBe("'on-fetch'");
  });

  it("scheduler_log has correct columns (snapshot_date, job_type, teams_saved, error_msg, duration_ms)", () => {
    const db = getDb();
    const cols = db
      .prepare("SELECT name FROM pragma_table_info('scheduler_log')")
      .all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("snapshot_date");
    expect(colNames).toContain("job_type");
    expect(colNames).toContain("teams_saved");
    expect(colNames).toContain("error_msg");
    expect(colNames).toContain("duration_ms");
    // Old column names should not be present
    expect(colNames).not.toContain("run_date");
    expect(colNames).not.toContain("run_type");
    expect(colNames).not.toContain("detail");
  });
});
