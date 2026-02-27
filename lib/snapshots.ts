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
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO team_pr_snapshots
       (snapshot_date, team_slug, org, project, metrics_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    today(),
    params.teamSlug,
    params.org,
    params.project,
    JSON.stringify(params.metrics)
  );
}

export function saveTimeSnapshot(params: {
  memberId: string;
  memberName: string;
  org: string;
  hours: unknown;
  totalHours: number;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO time_tracking_snapshots
       (snapshot_date, member_id, member_name, org, hours_json, total_hours)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    today(),
    params.memberId,
    params.memberName,
    params.org,
    JSON.stringify(params.hours),
    params.totalHours
  );
}
