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
import {
  aggregateWeeklyPRTrends,
  aggregateDailyPRTrends,
  aggregateSprintComparison,
  aggregateWeeklyHoursTrends,
} from "@/lib/trends";

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-03-03T12:00:00Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

afterEach(() => {
  closeDb();
});

function insertPRSnapshot(date: string, metrics: unknown) {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO team_pr_snapshots
       (snapshot_date, team_slug, org, project, metrics_json, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(date, "alpha", "myorg", "myproject", JSON.stringify(metrics), "on-fetch");
}

function insertTimeSnapshot(date: string, hours: unknown) {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO time_tracking_snapshots
       (snapshot_date, member_id, member_name, org, hours_json, total_hours, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(date, "_team_response_", "Team", "myorg", JSON.stringify(hours), 0, "on-fetch");
}

describe("aggregateWeeklyPRTrends", () => {
  it("groups snapshots by ISO week", () => {
    // Week of Feb 23 (Monday)
    insertPRSnapshot("2026-02-23", { team: { totalPRs: 10, activeContributors: 3 } });
    insertPRSnapshot("2026-02-24", { team: { totalPRs: 12, activeContributors: 4 } });
    // Week of Mar 2 (Monday)
    insertPRSnapshot("2026-03-02", { team: { totalPRs: 15, activeContributors: 5 } });

    const result = aggregateWeeklyPRTrends("myorg", "myproject", "alpha", 4);
    expect(result).toHaveLength(2);
    // Uses latest value per week
    expect(result[0].weekStart).toBe("2026-02-23");
    expect(result[0].totalPRs).toBe(12);
    expect(result[0].activeContributors).toBe(4);
    expect(result[1].weekStart).toBe("2026-03-02");
    expect(result[1].totalPRs).toBe(15);
  });

  it("returns empty array when no data", () => {
    const result = aggregateWeeklyPRTrends("myorg", "myproject", "alpha", 4);
    expect(result).toEqual([]);
  });

  it("includes alignment score when present", () => {
    insertPRSnapshot("2026-03-02", {
      team: { totalPRs: 5, activeContributors: 2 },
      alignmentScore: 72,
    });

    const result = aggregateWeeklyPRTrends("myorg", "myproject", "alpha", 4);
    expect(result).toHaveLength(1);
    expect(result[0].alignmentScore).toBe(72);
  });

  it("sets alignmentScore to null when not present", () => {
    insertPRSnapshot("2026-03-02", {
      team: { totalPRs: 5, activeContributors: 2 },
    });

    const result = aggregateWeeklyPRTrends("myorg", "myproject", "alpha", 4);
    expect(result).toHaveLength(1);
    expect(result[0].alignmentScore).toBeNull();
  });
});

describe("aggregateDailyPRTrends", () => {
  // System time is 2026-03-03T12:00:00Z, so dateDaysAgo(0) = "2026-03-03"
  // Requesting 3 days → Mar 1, Mar 2, Mar 3

  it("returns exactly N points for N days", () => {
    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("groups snapshots by day and uses latest per day", () => {
    // Insert two snapshots for Mar 1 — only the latest (last inserted) should be used
    // SQLite UNIQUE on (snapshot_date, team_slug, org, project) means we use a
    // different approach: insert via metrics_json that the first call sets, then
    // the second overwrites because of INSERT OR REPLACE
    const db = getDb();
    db.prepare(
      `INSERT OR REPLACE INTO team_pr_snapshots
         (snapshot_date, team_slug, org, project, metrics_json, source)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("2026-03-01", "alpha", "myorg", "myproject",
      JSON.stringify({ team: { totalPRs: 3, activeContributors: 1 } }), "on-fetch");
    db.prepare(
      `INSERT OR REPLACE INTO team_pr_snapshots
         (snapshot_date, team_slug, org, project, metrics_json, source)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("2026-03-01", "alpha", "myorg", "myproject",
      JSON.stringify({ team: { totalPRs: 7, activeContributors: 4 } }), "on-fetch");
    insertPRSnapshot("2026-03-02", { team: { totalPRs: 10, activeContributors: 3 } });

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result).toHaveLength(3);
    // Mar 1 should reflect the latest INSERT OR REPLACE value
    expect(result[0]).toEqual(expect.objectContaining({ date: "2026-03-01", totalPRs: 7, activeContributors: 4 }));
    expect(result[1]).toEqual(expect.objectContaining({ date: "2026-03-02", totalPRs: 10 }));
    expect(result[2]).toEqual(expect.objectContaining({ date: "2026-03-03", totalPRs: 0 }));
  });

  it("zero-fills missing days with correct count", () => {
    insertPRSnapshot("2026-03-01", { team: { totalPRs: 5, activeContributors: 2 } });
    // No data for Mar 2 or Mar 3

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(result[0].totalPRs).toBe(5);
    expect(result[1].totalPRs).toBe(0);
    expect(result[1].activeContributors).toBe(0);
    expect(result[1].alignmentScore).toBeNull();
    expect(result[2].totalPRs).toBe(0);
  });

  it("returns zero-filled array when no data", () => {
    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.totalPRs === 0)).toBe(true);
  });

  it("includes dateLabel formatted like 'Mar 1'", () => {
    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result[0].dateLabel).toBe("Mar 1");
  });

  it("supports explicit startDate/endDate for calendar windows", () => {
    insertPRSnapshot("2026-02-01", { team: { totalPRs: 8, activeContributors: 3 } });
    insertPRSnapshot("2026-02-28", { team: { totalPRs: 12, activeContributors: 5 } });

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 14, {
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
    expect(result).toHaveLength(28);
    expect(result[0].date).toBe("2026-02-01");
    expect(result[0].totalPRs).toBe(8);
    expect(result[27].date).toBe("2026-02-28");
    expect(result[27].totalPRs).toBe(12);
    // Mid-month zero-filled
    expect(result[14].totalPRs).toBe(0);
  });
});

describe("aggregateSprintComparison", () => {
  it("computes delta between current and previous sprint", () => {
    // Previous sprint (15-28 days ago) — Feb 3 to Feb 16
    insertPRSnapshot("2026-02-10", {
      team: { totalPRs: 8, avgPRAgeDays: 3.5 },
      alignmentScore: 60,
    });
    // Current sprint (0-14 days ago) — Feb 17 to Mar 3
    insertPRSnapshot("2026-02-25", {
      team: { totalPRs: 12, avgPRAgeDays: 2.0 },
      alignmentScore: 75,
    });

    const result = aggregateSprintComparison("myorg", "myproject", "alpha", 14);
    expect(result).not.toBeNull();
    expect(result!.current.totalPRs).toBe(12);
    expect(result!.previous.totalPRs).toBe(8);
    expect(result!.delta.totalPRs).toBe(4);
    expect(result!.delta.avgPRAgeDays).toBeCloseTo(-1.5);
    expect(result!.delta.alignmentScore).toBe(15);
  });

  it("returns null when no data exists", () => {
    const result = aggregateSprintComparison("myorg", "myproject", "alpha", 14);
    expect(result).toBeNull();
  });
});

describe("aggregateWeeklyHoursTrends", () => {
  it("groups time snapshots by week", () => {
    insertTimeSnapshot("2026-02-23", {
      summary: { totalHours: 100, capExHours: 60, opExHours: 40 },
    });
    insertTimeSnapshot("2026-03-02", {
      summary: { totalHours: 120, capExHours: 80, opExHours: 40 },
    });

    const result = aggregateWeeklyHoursTrends("myorg", 4);
    expect(result).toHaveLength(2);
    expect(result[0].totalHours).toBe(100);
    expect(result[0].capExHours).toBe(60);
    expect(result[1].totalHours).toBe(120);
    expect(result[1].capExHours).toBe(80);
  });

  it("returns empty array when no data", () => {
    const result = aggregateWeeklyHoursTrends("myorg", 4);
    expect(result).toEqual([]);
  });
});
