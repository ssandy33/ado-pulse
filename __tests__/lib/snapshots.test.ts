jest.mock("better-sqlite3", () => {
  const Actual = jest.requireActual("better-sqlite3");
  return function () {
    return new Actual(":memory:");
  };
});

import { getDb, closeDb } from "@/lib/db";
import {
  hasTeamSnapshotToday,
  saveTeamSnapshot,
  hasTimeSnapshotToday,
  saveTimeSnapshot,
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
  it("hasTeamSnapshotToday returns false when no snapshot exists", () => {
    expect(hasTeamSnapshotToday("alpha", "myorg", "myproject")).toBe(false);
  });

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

  it("hasTeamSnapshotToday returns true after insert", () => {
    saveTeamSnapshot({
      teamSlug: "alpha",
      org: "myorg",
      project: "myproject",
      metrics: { totalPRs: 5 },
    });

    expect(hasTeamSnapshotToday("alpha", "myorg", "myproject")).toBe(true);
  });

  it("duplicate insert for same date/team/org/project is ignored", () => {
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
  it("hasTimeSnapshotToday returns false when no snapshot exists", () => {
    expect(hasTimeSnapshotToday("alice@example.com", "myorg")).toBe(false);
  });

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

  it("hasTimeSnapshotToday returns true after insert", () => {
    saveTimeSnapshot({
      memberId: "alice@example.com",
      memberName: "Alice",
      org: "myorg",
      hours: {},
      totalHours: 6.5,
    });

    expect(hasTimeSnapshotToday("alice@example.com", "myorg")).toBe(true);
  });

  it("duplicate insert for same date/member/org is ignored", () => {
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
