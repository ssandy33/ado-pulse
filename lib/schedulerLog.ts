import { getDb } from "@/lib/db";

export interface SchedulerLogRow {
  id: number;
  snapshotDate: string;
  jobType: string;
  status: string;
  teamsSaved: number | null;
  errorMsg: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface LogSchedulerRunParams {
  snapshotDate: string;
  jobType: string;
  status: string;
  teamsSaved?: number;
  errorMsg?: string;
  durationMs?: number;
}

export function logSchedulerRun(params: LogSchedulerRunParams): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO scheduler_log (snapshot_date, job_type, status, teams_saved, error_msg, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    params.snapshotDate,
    params.jobType,
    params.status,
    params.teamsSaved ?? null,
    params.errorMsg ?? null,
    params.durationMs ?? null
  );
}

export function getSchedulerHistory(limit = 30): SchedulerLogRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, snapshot_date, job_type, status, teams_saved, error_msg, duration_ms, created_at
       FROM scheduler_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    snapshot_date: string;
    job_type: string;
    status: string;
    teams_saved: number | null;
    error_msg: string | null;
    duration_ms: number | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    snapshotDate: r.snapshot_date,
    jobType: r.job_type,
    status: r.status,
    teamsSaved: r.teams_saved,
    errorMsg: r.error_msg,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));
}

export function getLastSchedulerRun(): SchedulerLogRow | null {
  const rows = getSchedulerHistory(1);
  return rows.length > 0 ? rows[0] : null;
}
