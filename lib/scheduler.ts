import cron, { type ScheduledTask } from "node-cron";
import { today } from "@/lib/dateUtils";
import { logSchedulerRun } from "@/lib/schedulerLog";
import { hasTeamSnapshotToday, hasTimeSnapshotToday } from "@/lib/snapshots";
import { logger } from "@/lib/logger";

let task: ScheduledTask | null = null;

function getScheduledTeams(): string[] {
  const raw = process.env.SCHEDULED_TEAMS || "";
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getBaseUrl(): string {
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

function getAdoHeaders(): Record<string, string> {
  return {
    "x-ado-org": process.env.ADO_ORG || "",
    "x-ado-project": process.env.ADO_PROJECT || "",
    "x-ado-pat": process.env.ADO_PAT || "",
  };
}

export interface SchedulerResult {
  teams: string[];
  results: Array<{
    team: string;
    prStatus: "saved" | "skipped" | "error";
    timeStatus: "saved" | "skipped" | "error";
    error?: string;
  }>;
  durationMs: number;
}

export async function runSchedulerNow(): Promise<SchedulerResult> {
  const teams = getScheduledTeams();
  const start = Date.now();
  const baseUrl = getBaseUrl();
  const headers = getAdoHeaders();
  const snapshotDate = today();

  if (!headers["x-ado-org"] || !headers["x-ado-project"] || !headers["x-ado-pat"]) {
    logger.warn("[scheduler] Missing ADO credentials in env vars");
    logSchedulerRun({
      snapshotDate,
      jobType: "nightly",
      status: "error",
      errorMsg: "Missing ADO_ORG, ADO_PROJECT, or ADO_PAT env vars",
      durationMs: Date.now() - start,
    });
    return { teams, results: [], durationMs: Date.now() - start };
  }

  const results: SchedulerResult["results"] = [];

  for (const team of teams) {
    const teamResult: SchedulerResult["results"][0] = {
      team,
      prStatus: "skipped",
      timeStatus: "skipped",
    };

    // ── PR snapshot ──
    try {
      const org = headers["x-ado-org"];
      const project = headers["x-ado-project"];
      if (hasTeamSnapshotToday(org, project, team)) {
        teamResult.prStatus = "skipped";
      } else {
        const res = await fetch(
          `${baseUrl}/api/prs/team-summary?team=${encodeURIComponent(team)}`,
          { headers }
        );
        if (res.ok) {
          teamResult.prStatus = "saved";
        } else {
          teamResult.prStatus = "error";
          teamResult.error = `PR fetch failed: ${res.status}`;
        }
      }
    } catch (err) {
      teamResult.prStatus = "error";
      teamResult.error = err instanceof Error ? err.message : String(err);
    }

    // ── Time tracking snapshot ──
    try {
      const org = headers["x-ado-org"];
      if (hasTimeSnapshotToday(org, "_team_response_")) {
        teamResult.timeStatus = "skipped";
      } else {
        const res = await fetch(
          `${baseUrl}/api/timetracking/team-summary?team=${encodeURIComponent(team)}`,
          { headers }
        );
        if (res.ok) {
          teamResult.timeStatus = "saved";
        } else {
          teamResult.timeStatus = "error";
          const errText = teamResult.error || "";
          teamResult.error = errText
            ? `${errText}; Time fetch failed: ${res.status}`
            : `Time fetch failed: ${res.status}`;
        }
      }
    } catch (err) {
      teamResult.timeStatus = "error";
      const msg = err instanceof Error ? err.message : String(err);
      const errText = teamResult.error || "";
      teamResult.error = errText ? `${errText}; ${msg}` : msg;
    }

    results.push(teamResult);
  }

  const durationMs = Date.now() - start;
  const teamsSaved = results.filter(
    (r) => r.prStatus === "saved" || r.timeStatus === "saved"
  ).length;
  const hasErrors = results.some(
    (r) => r.prStatus === "error" || r.timeStatus === "error"
  );

  logSchedulerRun({
    snapshotDate,
    jobType: "nightly",
    status: hasErrors ? "partial" : "success",
    teamsSaved,
    errorMsg: hasErrors
      ? results
          .filter((r) => r.error)
          .map((r) => `${r.team}: ${r.error}`)
          .join("; ")
      : undefined,
    durationMs,
  });

  return { teams, results, durationMs };
}

export function startScheduler(): void {
  const teams = getScheduledTeams();
  if (teams.length === 0) {
    logger.info("[scheduler] No SCHEDULED_TEAMS configured, scheduler disabled");
    return;
  }

  // Run at 2 AM UTC daily
  task = cron.schedule("0 2 * * *", async () => {
    logger.info("[scheduler] Nightly snapshot job started", { teams });
    try {
      const result = await runSchedulerNow();
      logger.info("[scheduler] Nightly snapshot job complete", {
        durationMs: result.durationMs,
        teams: result.teams,
        results: result.results,
      });
    } catch (err) {
      logger.error("[scheduler] Nightly snapshot job failed", {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info("[scheduler] Scheduler started — runs daily at 2:00 AM UTC", { teams });
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info("[scheduler] Scheduler stopped");
  }
}
