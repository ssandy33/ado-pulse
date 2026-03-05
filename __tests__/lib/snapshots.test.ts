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
  saveTeamSnapshot,
  saveTimeSnapshot,
  getTeamSnapshots,
  getTimeSnapshots,
  hasTeamSnapshotToday,
  hasTimeSnapshotToday,
  getTeamSnapshot,
  getTeamSnapshotRange,
  getTimeSnapshot,
  getTimeSnapshotRange,
  checkTeamCoverage,
} from "@/lib/snapshots";

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-02-25T12:00:00Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

afterEach(() => {
  closeDb();
});

// ── Team PR snapshots ───────────────────────────────────────────────

describe("team PR snapshots", () => {
  it("saveTeamSnapshot inserts a row", () => {
    saveTeamSnapshot({
      teamSlug: "alpha",
      org: "myorg",
      project: "myproject",
      metrics: { totalPRs: 5 },
    });

    const db = getDb();
    const rows = db.prepare("SELECT * FROM team_pr_snapshots").all() as Array<{
      snapshot_date: string;
      team_slug: string;
      org: string;
      project: string;
      metrics_json: string;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].snapshot_date).toBe("2026-02-25");
    expect(rows[0].team_slug).toBe("alpha");
    expect(rows[0].org).toBe("myorg");
    expect(rows[0].project).toBe("myproject");
    expect(JSON.parse(rows[0].metrics_json)).toEqual({ totalPRs: 5 });
  });

  it("duplicate insert for same date/team/org/project is ignored via UNIQUE constraint", () => {
    const params = {
      teamSlug: "alpha",
      org: "myorg",
      project: "myproject",
      metrics: { totalPRs: 5 },
    };
    saveTeamSnapshot(params);
    saveTeamSnapshot({ ...params, metrics: { totalPRs: 99 } });

    const db = getDb();
    const rows = db.prepare("SELECT * FROM team_pr_snapshots").all();
    expect(rows).toHaveLength(1);
  });

  it("different team creates a separate row", () => {
    saveTeamSnapshot({
      teamSlug: "alpha",
      org: "myorg",
      project: "myproject",
      metrics: { team: "alpha" },
    });
    saveTeamSnapshot({
      teamSlug: "beta",
      org: "myorg",
      project: "myproject",
      metrics: { team: "beta" },
    });

    const db = getDb();
    const rows = db.prepare("SELECT * FROM team_pr_snapshots").all();
    expect(rows).toHaveLength(2);
  });

  it("different org creates a separate row", () => {
    saveTeamSnapshot({
      teamSlug: "alpha",
      org: "org-a",
      project: "proj",
      metrics: {},
    });
    saveTeamSnapshot({
      teamSlug: "alpha",
      org: "org-b",
      project: "proj",
      metrics: {},
    });

    const db = getDb();
    const rows = db.prepare("SELECT * FROM team_pr_snapshots").all();
    expect(rows).toHaveLength(2);
  });
});

// ── Time tracking snapshots ─────────────────────────────────────────

describe("time tracking snapshots", () => {
  it("saveTimeSnapshot inserts a row", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: { totalHours: 6.5, features: [] },
      totalHours: 6.5,
    });

    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM time_tracking_snapshots")
      .all() as Array<{
      snapshot_date: string;
      member_id: string;
      member_name: string;
      org: string;
      hours_json: string;
      total_hours: number;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].snapshot_date).toBe("2026-02-25");
    expect(rows[0].member_id).toBe("alice@example.com");
    expect(rows[0].member_name).toBe("Alice");
    expect(rows[0].org).toBe("myorg");
    expect(rows[0].total_hours).toBe(6.5);
    expect(JSON.parse(rows[0].hours_json)).toEqual({
      totalHours: 6.5,
      features: [],
    });
  });

  it("duplicate insert for same date/member/org is ignored via UNIQUE constraint", () => {
    const params = {
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: { totalHours: 6.5 },
      totalHours: 6.5,
    };
    saveTimeSnapshot(params);
    saveTimeSnapshot({ ...params, totalHours: 99 });

    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM time_tracking_snapshots")
      .all();
    expect(rows).toHaveLength(1);
  });

  it("different member creates a separate row", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: {},
      totalHours: 5,
    });
    saveTimeSnapshot({
      memberId: "bob@example.com",
      memberName: "Bob",
      org: "myorg",
      hours: {},
      totalHours: 8,
    });

    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM time_tracking_snapshots")
      .all();
    expect(rows).toHaveLength(2);
  });

  it("different org creates a separate row for same member", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "org-a",
      hours: {},
      totalHours: 3,
    });
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "org-b",
      hours: {},
      totalHours: 4,
    });

    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM time_tracking_snapshots")
      .all();
    expect(rows).toHaveLength(2);
  });
});

// ── Read helpers: getTeamSnapshots ────────────────────────────────────

describe("getTeamSnapshots", () => {
  it("returns rows filtered by org and project with parsed metrics", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: { totalPRs: 5 } });
    saveTeamSnapshot({ teamSlug: "beta", org: "myorg", project: "proj", metrics: { totalPRs: 3 } });

    const rows = getTeamSnapshots("myorg", "proj", null, 30);
    expect(rows).toHaveLength(2);

    const alpha = rows.find((r) => r.teamSlug === "alpha")!;
    expect(alpha.snapshotDate).toBe("2026-02-25");
    expect(alpha.org).toBe("myorg");
    expect(alpha.project).toBe("proj");
    expect(alpha.metrics).toEqual({ totalPRs: 5 });

    const beta = rows.find((r) => r.teamSlug === "beta")!;
    expect(beta.metrics).toEqual({ totalPRs: 3 });
  });

  it("filters by team when provided", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });
    saveTeamSnapshot({ teamSlug: "beta", org: "myorg", project: "proj", metrics: {} });

    const rows = getTeamSnapshots("myorg", "proj", "alpha", 30);
    expect(rows).toHaveLength(1);
    expect(rows[0].teamSlug).toBe("alpha");
  });

  it("excludes rows from different org", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "org-a", project: "proj", metrics: {} });
    saveTeamSnapshot({ teamSlug: "alpha", org: "org-b", project: "proj", metrics: {} });

    const rows = getTeamSnapshots("org-a", "proj", null, 30);
    expect(rows).toHaveLength(1);
    expect(rows[0].org).toBe("org-a");
  });

  it("returns empty array when no rows match", () => {
    const rows = getTeamSnapshots("nonexistent", "proj", null, 30);
    expect(rows).toEqual([]);
  });

  it("respects days lookback (0-day window includes today's row)", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    // days=0 → cutoff equals today, so snapshot_date >= today includes today's row
    const rows = getTeamSnapshots("myorg", "proj", null, 0);
    expect(rows).toHaveLength(1);
  });
});

// ── Read helpers: getTimeSnapshots ────────────────────────────────────

describe("getTimeSnapshots", () => {
  it("returns rows filtered by org with parsed hours", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: { features: ["A"] },
      totalHours: 6.5,
    });

    const rows = getTimeSnapshots("myorg", 30);
    expect(rows).toHaveLength(1);
    expect(rows[0].snapshotDate).toBe("2026-02-25");
    expect(rows[0].memberId).toBe("alice@example.com");
    expect(rows[0].memberName).toBe("Alice");
    expect(rows[0].totalHours).toBe(6.5);
    expect(rows[0].hours).toEqual({ features: ["A"] });
  });

  it("excludes rows from different org", () => {
    saveTimeSnapshot({ memberId: "a@b.com", memberName: "A", org: "org-a", hours: {}, totalHours: 1 });
    saveTimeSnapshot({ memberId: "a@b.com", memberName: "A", org: "org-b", hours: {}, totalHours: 2 });

    const rows = getTimeSnapshots("org-a", 30);
    expect(rows).toHaveLength(1);
    expect(rows[0].org).toBe("org-a");
  });

  it("returns empty array when no rows match", () => {
    const rows = getTimeSnapshots("nonexistent", 30);
    expect(rows).toEqual([]);
  });
});

// ── Source parameter ──────────────────────────────────────────────────

describe("source parameter", () => {
  it("saveTeamSnapshot defaults source to 'on-fetch'", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    const db = getDb();
    const row = db
      .prepare("SELECT source FROM team_pr_snapshots WHERE team_slug = 'alpha'")
      .get() as { source: string };
    expect(row.source).toBe("on-fetch");
  });

  it("saveTeamSnapshot stores explicit source value", () => {
    saveTeamSnapshot({ teamSlug: "beta", org: "myorg", project: "proj", metrics: {}, source: "scheduler" });

    const db = getDb();
    const row = db
      .prepare("SELECT source FROM team_pr_snapshots WHERE team_slug = 'beta'")
      .get() as { source: string };
    expect(row.source).toBe("scheduler");
  });

  it("saveTimeSnapshot defaults source to 'on-fetch'", () => {
    saveTimeSnapshot({ memberId: "alice@example.com", memberName: "Alice", org: "myorg", hours: {}, totalHours: 5 });

    const db = getDb();
    const row = db
      .prepare("SELECT source FROM time_tracking_snapshots WHERE member_id = 'alice@example.com'")
      .get() as { source: string };
    expect(row.source).toBe("on-fetch");
  });

  it("saveTimeSnapshot stores explicit source value", () => {
    saveTimeSnapshot({ memberId: "bob@example.com", memberName: "Bob", org: "myorg", hours: {}, totalHours: 8, source: "scheduler" });

    const db = getDb();
    const row = db
      .prepare("SELECT source FROM time_tracking_snapshots WHERE member_id = 'bob@example.com'")
      .get() as { source: string };
    expect(row.source).toBe("scheduler");
  });
});

// ── has*Today() guards ───────────────────────────────────────────────

describe("hasTeamSnapshotToday", () => {
  it("returns false when no snapshot exists", () => {
    expect(hasTeamSnapshotToday("myorg", "proj", "alpha")).toBe(false);
  });

  it("returns true after a snapshot is saved for today", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });
    expect(hasTeamSnapshotToday("myorg", "proj", "alpha")).toBe(true);
  });

  it("returns false for a different team", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });
    expect(hasTeamSnapshotToday("myorg", "proj", "beta")).toBe(false);
  });

  it("returns false for a different org", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "org-a", project: "proj", metrics: {} });
    expect(hasTeamSnapshotToday("org-b", "proj", "alpha")).toBe(false);
  });
});

describe("hasTimeSnapshotToday", () => {
  it("returns false when no snapshot exists", () => {
    expect(hasTimeSnapshotToday("myorg", "alice@example.com")).toBe(false);
  });

  it("returns true after a snapshot is saved for today", () => {
    saveTimeSnapshot({ memberId: "alice@example.com", memberName: "Alice", org: "myorg", hours: {}, totalHours: 5 });
    expect(hasTimeSnapshotToday("myorg", "alice@example.com")).toBe(true);
  });

  it("returns false for a different member", () => {
    saveTimeSnapshot({ memberId: "alice@example.com", memberName: "Alice", org: "myorg", hours: {}, totalHours: 5 });
    expect(hasTimeSnapshotToday("myorg", "bob@example.com")).toBe(false);
  });

  it("returns false for a different org", () => {
    saveTimeSnapshot({ memberId: "alice@example.com", memberName: "Alice", org: "org-a", hours: {}, totalHours: 5 });
    expect(hasTimeSnapshotToday("org-b", "alice@example.com")).toBe(false);
  });
});

// ── getTeamSnapshot (single date lookup) ──────────────────────────────

describe("getTeamSnapshot", () => {
  it("returns metrics and createdAt for an existing snapshot", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: { totalPRs: 5 } });

    const result = getTeamSnapshot("myorg", "proj", "alpha", "2026-02-25");
    expect(result).not.toBeNull();
    expect(result!.metrics).toEqual({ totalPRs: 5 });
    expect(result!.createdAt).toBeDefined();
  });

  it("returns null when no snapshot exists for the date", () => {
    const result = getTeamSnapshot("myorg", "proj", "alpha", "2026-02-25");
    expect(result).toBeNull();
  });

  it("returns null for wrong org/project/team", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    expect(getTeamSnapshot("other-org", "proj", "alpha", "2026-02-25")).toBeNull();
    expect(getTeamSnapshot("myorg", "other-proj", "alpha", "2026-02-25")).toBeNull();
    expect(getTeamSnapshot("myorg", "proj", "beta", "2026-02-25")).toBeNull();
  });
});

// ── getTeamSnapshotRange (most recent within N days) ──────────────────

describe("getTeamSnapshotRange", () => {
  it("returns the most recent snapshot within lookback window", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: { totalPRs: 10 } });

    const result = getTeamSnapshotRange("myorg", "proj", "alpha", 7);
    expect(result).not.toBeNull();
    expect(result!.metrics).toEqual({ totalPRs: 10 });
    expect(result!.snapshotDate).toBe("2026-02-25");
  });

  it("returns null when no snapshots exist in range", () => {
    const result = getTeamSnapshotRange("myorg", "proj", "alpha", 7);
    expect(result).toBeNull();
  });

  it("returns null for wrong org", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });
    expect(getTeamSnapshotRange("other-org", "proj", "alpha", 7)).toBeNull();
  });
});

// ── getTimeSnapshot (_team_response_ sentinel) ────────────────────────

describe("getTimeSnapshot", () => {
  it("returns the _team_response_ row for a given date", () => {
    const teamData = { team: { name: "alpha" }, summary: { totalHours: 40 } };
    saveTimeSnapshot({
      memberId: "_team_response_",
      memberName: "_team_response_",
      org: "myorg",
      hours: teamData,
      totalHours: 0,
    });

    const result = getTimeSnapshot("myorg", "2026-02-25");
    expect(result).not.toBeNull();
    expect(result!.hours).toEqual(teamData);
    expect(result!.createdAt).toBeDefined();
  });

  it("returns null when no _team_response_ row exists", () => {
    // Save a regular member row — should not match
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: {},
      totalHours: 5,
    });

    const result = getTimeSnapshot("myorg", "2026-02-25");
    expect(result).toBeNull();
  });

  it("returns null for wrong org", () => {
    saveTimeSnapshot({
      memberId: "_team_response_",
      memberName: "_team_response_",
      org: "myorg",
      hours: {},
      totalHours: 0,
    });

    expect(getTimeSnapshot("other-org", "2026-02-25")).toBeNull();
  });
});

// ── getTimeSnapshotRange (_team_response_ within N days) ──────────────

describe("getTimeSnapshotRange", () => {
  it("returns most recent _team_response_ within lookback", () => {
    const teamData = { team: { name: "alpha" }, summary: { totalHours: 32 } };
    saveTimeSnapshot({
      memberId: "_team_response_",
      memberName: "_team_response_",
      org: "myorg",
      hours: teamData,
      totalHours: 0,
    });

    const result = getTimeSnapshotRange("myorg", 7);
    expect(result).not.toBeNull();
    expect(result!.hours).toEqual(teamData);
    expect(result!.snapshotDate).toBe("2026-02-25");
  });

  it("returns null when no _team_response_ exists", () => {
    expect(getTimeSnapshotRange("myorg", 7)).toBeNull();
  });

  it("ignores regular member rows", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: {},
      totalHours: 5,
    });

    expect(getTimeSnapshotRange("myorg", 7)).toBeNull();
  });
});

// ── checkTeamCoverage ─────────────────────────────────────────────────

describe("checkTeamCoverage", () => {
  it("returns coverage object with covered dates, total, and complete flag", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    const result = checkTeamCoverage("myorg", "proj", "alpha", 30);
    expect(result.covered).toEqual(["2026-02-25"]);
    expect(result.total).toBe(30);
    expect(result.complete).toBe(false);
  });

  it("returns empty covered array when no snapshots exist", () => {
    const result = checkTeamCoverage("myorg", "proj", "alpha", 30);
    expect(result.covered).toEqual([]);
    expect(result.total).toBe(30);
    expect(result.complete).toBe(false);
  });

  it("excludes snapshots from different teams", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });
    saveTeamSnapshot({ teamSlug: "beta", org: "myorg", project: "proj", metrics: {} });

    const result = checkTeamCoverage("myorg", "proj", "alpha", 30);
    expect(result.covered).toEqual(["2026-02-25"]);
  });

  it("reports complete when covered >= total", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    // days=1, 1 snapshot today → complete
    const result = checkTeamCoverage("myorg", "proj", "alpha", 1);
    expect(result.complete).toBe(true);
  });
});

// ── Malformed JSON handling ───────────────────────────────────────────

describe("malformed JSON in snapshots", () => {
  function insertCorruptTeamRow(teamSlug: string, org: string, project: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO team_pr_snapshots (snapshot_date, team_slug, org, project, metrics_json, source)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("2026-02-25", teamSlug, org, project, "NOT_VALID_JSON{{{", "on-fetch");
  }

  function insertCorruptTimeRow(memberId: string, org: string) {
    const db = getDb();
    db.prepare(
      `INSERT INTO time_tracking_snapshots (snapshot_date, member_id, member_name, org, hours_json, total_hours, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("2026-02-25", memberId, memberId, org, "CORRUPT!!!", 0, "on-fetch");
  }

  it("getTeamSnapshot returns null for corrupt metrics_json", () => {
    insertCorruptTeamRow("alpha", "myorg", "proj");
    expect(getTeamSnapshot("myorg", "proj", "alpha", "2026-02-25")).toBeNull();
  });

  it("getTeamSnapshotRange skips corrupt row and returns null when no valid rows", () => {
    insertCorruptTeamRow("alpha", "myorg", "proj");
    expect(getTeamSnapshotRange("myorg", "proj", "alpha", 7)).toBeNull();
  });

  it("getTimeSnapshot returns null for corrupt hours_json", () => {
    insertCorruptTimeRow("_team_response_", "myorg");
    expect(getTimeSnapshot("myorg", "2026-02-25")).toBeNull();
  });

  it("getTimeSnapshotRange skips corrupt row and returns null when no valid rows", () => {
    insertCorruptTimeRow("_team_response_", "myorg");
    expect(getTimeSnapshotRange("myorg", 7)).toBeNull();
  });
});
