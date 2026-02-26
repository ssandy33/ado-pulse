import { getDb } from "@/lib/db";
import { today } from "@/lib/dateUtils";

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
