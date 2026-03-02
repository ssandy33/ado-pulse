import { getDb } from "@/lib/db";
import { today, dateDaysAgo } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";

// ── Row types returned by read helpers ────────────────────────────────

export interface TeamSnapshotRow {
  snapshotDate: string;
  teamSlug: string;
  org: string;
  project: string;
  createdAt: string;
  metrics: unknown;
}

export interface TimeSnapshotRow {
  snapshotDate: string;
  memberId: string;
  memberName: string;
  org: string;
  totalHours: number;
  createdAt: string;
  hours: unknown;
}

// ── Read helpers ──────────────────────────────────────────────────────

export function getTeamSnapshots(
  org: string,
  project: string,
  team: string | null,
  days: number
): TeamSnapshotRow[] {
  const db = getDb();
  const cutoff = dateDaysAgo(days);

  let sql = `SELECT snapshot_date, team_slug, org, project, created_at, metrics_json
     FROM team_pr_snapshots
     WHERE snapshot_date >= ? AND org = ? AND project = ?`;
  const params: unknown[] = [cutoff, org, project];

  if (team) {
    sql += " AND team_slug = ?";
    params.push(team);
  }

  sql += " ORDER BY snapshot_date DESC LIMIT 100";

  const rows = db.prepare(sql).all(...params) as Array<{
    snapshot_date: string;
    team_slug: string;
    org: string;
    project: string;
    created_at: string;
    metrics_json: string;
  }>;

  return rows.map((r) => ({
    snapshotDate: r.snapshot_date,
    teamSlug: r.team_slug,
    org: r.org,
    project: r.project,
    createdAt: r.created_at,
    metrics: safeJsonParse(r.metrics_json, {
      teamSlug: r.team_slug,
      org: r.org,
      project: r.project,
    }),
  }));
}

export function getTimeSnapshots(
  org: string,
  days: number
): TimeSnapshotRow[] {
  const db = getDb();
  const cutoff = dateDaysAgo(days);

  const rows = db
    .prepare(
      `SELECT snapshot_date, member_id, member_name, org, total_hours, created_at, hours_json
       FROM time_tracking_snapshots
       WHERE snapshot_date >= ? AND org = ?
       ORDER BY snapshot_date DESC LIMIT 100`
    )
    .all(cutoff, org) as Array<{
    snapshot_date: string;
    member_id: string;
    member_name: string;
    org: string;
    total_hours: number;
    created_at: string;
    hours_json: string;
  }>;

  return rows.map((r) => ({
    snapshotDate: r.snapshot_date,
    memberId: r.member_id,
    memberName: r.member_name,
    org: r.org,
    totalHours: r.total_hours,
    createdAt: r.created_at,
    hours: safeJsonParse(r.hours_json, {
      memberId: r.member_id,
      org: r.org,
    }),
  }));
}

function safeJsonParse(json: string, context: Record<string, unknown>): unknown {
  try {
    return JSON.parse(json);
  } catch {
    logger.warn("[snapshot] Corrupt JSON in snapshot row", context);
    return null;
  }
}

export function saveTeamSnapshot(params: {
  teamSlug: string;
  org: string;
  project: string;
  metrics: unknown;
  source?: "on-fetch" | "scheduler";
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO team_pr_snapshots
       (snapshot_date, team_slug, org, project, metrics_json, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    today(),
    params.teamSlug,
    params.org,
    params.project,
    JSON.stringify(params.metrics),
    params.source ?? "on-fetch"
  );
}

export function saveTimeSnapshot(params: {
  memberId: string;
  memberName: string;
  org: string;
  hours: unknown;
  totalHours: number;
  source?: "on-fetch" | "scheduler";
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO time_tracking_snapshots
       (snapshot_date, member_id, member_name, org, hours_json, total_hours, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    today(),
    params.memberId,
    params.memberName,
    params.org,
    JSON.stringify(params.hours),
    params.totalHours,
    params.source ?? "on-fetch"
  );
}

// ── Single-row cache reads ──────────────────────────────────────────

/**
 * Get a single team PR snapshot for a specific date.
 * Returns the parsed metrics blob or null if not found.
 */
export function getTeamSnapshot(
  org: string,
  project: string,
  teamSlug: string,
  date: string
): { metrics: unknown; createdAt: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT metrics_json, created_at FROM team_pr_snapshots
       WHERE snapshot_date = ? AND org = ? AND project = ? AND team_slug = ?
       LIMIT 1`
    )
    .get(date, org, project, teamSlug) as
    | { metrics_json: string; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    metrics: safeJsonParse(row.metrics_json, { org, project, teamSlug, date }),
    createdAt: row.created_at,
  };
}

/**
 * Get the most recent team PR snapshot within `lookbackDays`.
 * Used for stale fallback when live fetch fails.
 */
export function getTeamSnapshotRange(
  org: string,
  project: string,
  teamSlug: string,
  lookbackDays: number
): { metrics: unknown; snapshotDate: string; createdAt: string } | null {
  const db = getDb();
  const cutoff = dateDaysAgo(lookbackDays);
  const row = db
    .prepare(
      `SELECT metrics_json, snapshot_date, created_at FROM team_pr_snapshots
       WHERE snapshot_date >= ? AND org = ? AND project = ? AND team_slug = ?
       ORDER BY snapshot_date DESC
       LIMIT 1`
    )
    .get(cutoff, org, project, teamSlug) as
    | { metrics_json: string; snapshot_date: string; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    metrics: safeJsonParse(row.metrics_json, { org, project, teamSlug }),
    snapshotDate: row.snapshot_date,
    createdAt: row.created_at,
  };
}

/**
 * Get the full _team_response_ time snapshot for a specific date.
 * Returns the parsed TeamTimeData blob or null if not found.
 */
export function getTimeSnapshot(
  org: string,
  date: string
): { hours: unknown; createdAt: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT hours_json, created_at FROM time_tracking_snapshots
       WHERE snapshot_date = ? AND org = ? AND member_id = '_team_response_'
       LIMIT 1`
    )
    .get(date, org) as
    | { hours_json: string; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    hours: safeJsonParse(row.hours_json, { org, date, memberId: "_team_response_" }),
    createdAt: row.created_at,
  };
}

/**
 * Get the most recent _team_response_ time snapshot within `lookbackDays`.
 * Used for stale fallback when live fetch fails.
 */
export function getTimeSnapshotRange(
  org: string,
  lookbackDays: number
): { hours: unknown; snapshotDate: string; createdAt: string } | null {
  const db = getDb();
  const cutoff = dateDaysAgo(lookbackDays);
  const row = db
    .prepare(
      `SELECT hours_json, snapshot_date, created_at FROM time_tracking_snapshots
       WHERE snapshot_date >= ? AND org = ? AND member_id = '_team_response_'
       ORDER BY snapshot_date DESC
       LIMIT 1`
    )
    .get(cutoff, org) as
    | { hours_json: string; snapshot_date: string; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    hours: safeJsonParse(row.hours_json, { org, memberId: "_team_response_" }),
    snapshotDate: row.snapshot_date,
    createdAt: row.created_at,
  };
}

/**
 * List dates that have team PR snapshots within a range.
 * Useful for checking coverage / identifying gaps.
 */
export function checkTeamCoverage(
  org: string,
  project: string,
  teamSlug: string,
  days: number
): string[] {
  const db = getDb();
  const cutoff = dateDaysAgo(days);
  const rows = db
    .prepare(
      `SELECT DISTINCT snapshot_date FROM team_pr_snapshots
       WHERE snapshot_date >= ? AND org = ? AND project = ? AND team_slug = ?
       ORDER BY snapshot_date DESC`
    )
    .all(cutoff, org, project, teamSlug) as Array<{ snapshot_date: string }>;

  return rows.map((r) => r.snapshot_date);
}

// ── Dedup guards ─────────────────────────────────────────────────────

export function hasTeamSnapshotToday(
  org: string,
  project: string,
  teamSlug: string
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM team_pr_snapshots
       WHERE snapshot_date = ? AND org = ? AND project = ? AND team_slug = ?
       LIMIT 1`
    )
    .get(today(), org, project, teamSlug);
  return row !== undefined;
}

export function hasTimeSnapshotToday(
  org: string,
  memberId: string
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM time_tracking_snapshots
       WHERE snapshot_date = ? AND org = ? AND member_id = ?
       LIMIT 1`
    )
    .get(today(), org, memberId);
  return row !== undefined;
}
