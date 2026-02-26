import { getDb } from "./db";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasTeamSnapshotToday(
  teamSlug: string,
  org: string,
  project: string
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM team_pr_snapshots
       WHERE snapshot_date = ? AND team_slug = ? AND org = ? AND project = ?
       LIMIT 1`
    )
    .get(today(), teamSlug, org, project);
  return row !== undefined;
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

export function hasTimeSnapshotToday(
  memberId: string,
  org: string
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM time_tracking_snapshots
       WHERE snapshot_date = ? AND member_id = ? AND org = ?
       LIMIT 1`
    )
    .get(today(), memberId, org);
  return row !== undefined;
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
