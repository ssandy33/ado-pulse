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
  it("groups snapshots by day and uses latest per day", () => {
    insertPRSnapshot("2026-03-01", { team: { totalPRs: 5, activeContributors: 2 } });
    insertPRSnapshot("2026-03-02", { team: { totalPRs: 10, activeContributors: 3 } });

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    const mar1 = result.find((r) => r.date === "2026-03-01");
    const mar2 = result.find((r) => r.date === "2026-03-02");
    expect(mar1?.totalPRs).toBe(5);
    expect(mar2?.totalPRs).toBe(10);
  });

  it("zero-fills missing days", () => {
    insertPRSnapshot("2026-03-01", { team: { totalPRs: 5, activeContributors: 2 } });
    // No data for Mar 2

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    // Should have days: Feb 28, Mar 1, Mar 2, Mar 3
    expect(result.length).toBeGreaterThanOrEqual(3);
    const mar2 = result.find((r) => r.date === "2026-03-02");
    expect(mar2).toBeDefined();
    expect(mar2?.totalPRs).toBe(0);
    expect(mar2?.activeContributors).toBe(0);
    expect(mar2?.alignmentScore).toBeNull();
  });

  it("returns zero-filled array when no data", () => {
    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((r) => r.totalPRs === 0)).toBe(true);
  });

  it("includes dateLabel formatted like 'Mar 1'", () => {
    insertPRSnapshot("2026-03-01", { team: { totalPRs: 5, activeContributors: 2 } });

    const result = aggregateDailyPRTrends("myorg", "myproject", "alpha", 3);
    const mar1 = result.find((r) => r.date === "2026-03-01");
    expect(mar1?.dateLabel).toBe("Mar 1");
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
