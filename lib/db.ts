import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

/**
 * Return the module-level SQLite singleton, creating it on first call.
 * DB file lives at `data/ado-pulse.db` relative to cwd (Docker bind-mount friendly).
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), "data", "ado-pulse.db");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(conn: Database.Database): void {
  conn.transaction(() => {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS team_pr_snapshots (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT    NOT NULL,
        team_slug     TEXT    NOT NULL,
        org           TEXT    NOT NULL,
        project       TEXT    NOT NULL,
        metrics_json  TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(snapshot_date, team_slug, org, project)
      )
    `);

    conn.exec(`
      CREATE TABLE IF NOT EXISTS time_tracking_snapshots (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT    NOT NULL,
        member_id     TEXT    NOT NULL,
        member_name   TEXT    NOT NULL,
        org           TEXT    NOT NULL,
        hours_json    TEXT    NOT NULL,
        total_hours   REAL    NOT NULL DEFAULT 0,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(snapshot_date, member_id, org)
      )
    `);

    conn.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        run_date   TEXT    NOT NULL,
        run_type   TEXT    NOT NULL,
        status     TEXT    NOT NULL,
        detail     TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);
  })();
}
