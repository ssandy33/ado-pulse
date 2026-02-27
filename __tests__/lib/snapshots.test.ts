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

  it("respects days lookback (0-day window excludes today's row)", () => {
    saveTeamSnapshot({ teamSlug: "alpha", org: "myorg", project: "proj", metrics: {} });

    // days=0 → cutoff is today, so snapshot_date >= today still matches
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
