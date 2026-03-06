import { getDb } from "@/lib/db";
import { dateDaysAgo } from "@/lib/dateUtils";

// ── Types ────────────────────────────────────────────────────────

export interface WeeklyPRTrend {
  weekStart: string; // ISO Monday YYYY-MM-DD
  weekLabel: string; // e.g. "Feb 17"
  totalPRs: number;
  activeContributors: number;
  alignmentScore: number | null;
}

export interface DailyPRTrend {
  date: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Feb 17"
  totalPRs: number;
  activeContributors: number;
  alignmentScore: number | null;
}

export interface SprintComparison {
  current: SprintMetrics;
  previous: SprintMetrics;
  delta: SprintDelta;
}

export interface SprintMetrics {
  totalPRs: number;
  avgPRAgeDays: number;
  alignmentScore: number | null;
  days: number;
}

export interface SprintDelta {
  totalPRs: number;
  avgPRAgeDays: number;
  alignmentScore: number | null;
}

export interface WeeklyHoursTrend {
  weekStart: string;
  weekLabel: string;
  totalHours: number;
  capExHours: number;
  opExHours: number;
}

// ── Helpers ──────────────────────────────────────────────────────

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Get the ISO Monday for a given date string */
function getISOMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── PR Trends ────────────────────────────────────────────────────

export function aggregateWeeklyPRTrends(
  org: string,
  project: string,
  team: string,
  weeks = 4
): WeeklyPRTrend[] {
  const db = getDb();
  const cutoff = dateDaysAgo(weeks * 7);

  const rows = db
    .prepare(
      `SELECT snapshot_date, metrics_json
       FROM team_pr_snapshots
       WHERE org = ? AND project = ? AND team_slug = ? AND snapshot_date >= ?
       ORDER BY snapshot_date ASC`
    )
    .all(org, project, team, cutoff) as Array<{
    snapshot_date: string;
    metrics_json: string;
  }>;

  // Group by ISO week
  const weekMap = new Map<
    string,
    { totalPRs: number[]; contributors: number[]; alignment: number[] }
  >();

  for (const row of rows) {
    const monday = getISOMonday(row.snapshot_date);
    if (!weekMap.has(monday)) {
      weekMap.set(monday, { totalPRs: [], contributors: [], alignment: [] });
    }
    const bucket = weekMap.get(monday)!;
    const metrics = safeJsonParse(row.metrics_json) as Record<string, unknown> | null;
    if (!metrics) continue;

    // Look for metrics at top level or nested under .team
    const team = (metrics.team as Record<string, unknown>) ?? metrics;
    if (typeof team.totalPRs === "number") bucket.totalPRs.push(team.totalPRs);
    if (typeof team.activeContributors === "number")
      bucket.contributors.push(team.activeContributors);

    // Alignment score may be at top level or nested
    const alignmentScore =
      typeof metrics.alignmentScore === "number"
        ? metrics.alignmentScore
        : typeof team.alignmentScore === "number"
          ? team.alignmentScore
          : null;
    if (alignmentScore !== null) bucket.alignment.push(alignmentScore);
  }

  // Convert to sorted array, using the latest value per week (most recent snapshot)
  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, data]) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      totalPRs: data.totalPRs.length > 0 ? data.totalPRs[data.totalPRs.length - 1] : 0,
      activeContributors:
        data.contributors.length > 0
          ? data.contributors[data.contributors.length - 1]
          : 0,
      alignmentScore:
        data.alignment.length > 0
          ? data.alignment[data.alignment.length - 1]
          : null,
    }));
}

// ── Daily PR Trends ─────────────────────────────────────────────

export function aggregateDailyPRTrends(
  org: string,
  project: string,
  team: string,
  days = 14
): DailyPRTrend[] {
  const db = getDb();
  const cutoff = dateDaysAgo(days);

  const rows = db
    .prepare(
      `SELECT snapshot_date, metrics_json
       FROM team_pr_snapshots
       WHERE org = ? AND project = ? AND team_slug = ? AND snapshot_date >= ?
       ORDER BY snapshot_date ASC`
    )
    .all(org, project, team, cutoff) as Array<{
    snapshot_date: string;
    metrics_json: string;
  }>;

  // Group by calendar date, keep latest snapshot per day
  const dayMap = new Map<
    string,
    { totalPRs: number; activeContributors: number; alignmentScore: number | null }
  >();

  for (const row of rows) {
    const date = row.snapshot_date;
    const metrics = safeJsonParse(row.metrics_json) as Record<string, unknown> | null;
    if (!metrics) continue;

    const teamData = (metrics.team as Record<string, unknown>) ?? metrics;
    const totalPRs = typeof teamData.totalPRs === "number" ? teamData.totalPRs : 0;
    const activeContributors =
      typeof teamData.activeContributors === "number" ? teamData.activeContributors : 0;
    const alignmentScore =
      typeof metrics.alignmentScore === "number"
        ? metrics.alignmentScore
        : typeof teamData.alignmentScore === "number"
          ? teamData.alignmentScore
          : null;

    // Overwrite — rows are ordered ASC, so last write = latest snapshot
    dayMap.set(date, { totalPRs, activeContributors, alignmentScore });
  }

  // Zero-fill all dates in the range
  const result: DailyPRTrend[] = [];
  const startDate = new Date(cutoff + "T00:00:00Z");
  const endDate = new Date(dateDaysAgo(0) + "T00:00:00Z");

  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const existing = dayMap.get(dateStr);
    result.push({
      date: dateStr,
      dateLabel: formatWeekLabel(dateStr),
      totalPRs: existing?.totalPRs ?? 0,
      activeContributors: existing?.activeContributors ?? 0,
      alignmentScore: existing?.alignmentScore ?? null,
    });
  }

  return result;
}

// ── Sprint Comparison ────────────────────────────────────────────

export function aggregateSprintComparison(
  org: string,
  project: string,
  team: string,
  sprintDays = 14
): SprintComparison | null {
  const db = getDb();
  const currentCutoff = dateDaysAgo(sprintDays);
  const previousCutoff = dateDaysAgo(sprintDays * 2);

  const rows = db
    .prepare(
      `SELECT snapshot_date, metrics_json
       FROM team_pr_snapshots
       WHERE org = ? AND project = ? AND team_slug = ? AND snapshot_date >= ?
       ORDER BY snapshot_date ASC`
    )
    .all(org, project, team, previousCutoff) as Array<{
    snapshot_date: string;
    metrics_json: string;
  }>;

  if (rows.length === 0) return null;

  const currentRows = rows.filter((r) => r.snapshot_date >= currentCutoff);
  const previousRows = rows.filter(
    (r) => r.snapshot_date < currentCutoff && r.snapshot_date >= previousCutoff
  );

  if (currentRows.length === 0 && previousRows.length === 0) return null;

  function extractSprintMetrics(
    sprintRows: typeof rows,
    days: number
  ): SprintMetrics {
    if (sprintRows.length === 0) {
      return { totalPRs: 0, avgPRAgeDays: 0, alignmentScore: null, days };
    }
    // Use the latest snapshot in the sprint
    const latest = sprintRows[sprintRows.length - 1];
    const metrics = safeJsonParse(latest.metrics_json) as Record<string, unknown> | null;
    if (!metrics) {
      return { totalPRs: 0, avgPRAgeDays: 0, alignmentScore: null, days };
    }

    const teamData = (metrics.team as Record<string, unknown>) ?? metrics;
    const totalPRs = typeof teamData.totalPRs === "number" ? teamData.totalPRs : 0;
    const avgPRAgeDays =
      typeof teamData.avgPRAgeDays === "number" ? teamData.avgPRAgeDays : 0;
    const alignmentScore =
      typeof metrics.alignmentScore === "number"
        ? metrics.alignmentScore
        : typeof teamData.alignmentScore === "number"
          ? teamData.alignmentScore
          : null;

    return { totalPRs, avgPRAgeDays, alignmentScore, days };
  }

  const current = extractSprintMetrics(currentRows, sprintDays);
  const previous = extractSprintMetrics(previousRows, sprintDays);

  return {
    current,
    previous,
    delta: {
      totalPRs: current.totalPRs - previous.totalPRs,
      avgPRAgeDays: current.avgPRAgeDays - previous.avgPRAgeDays,
      alignmentScore:
        current.alignmentScore !== null && previous.alignmentScore !== null
          ? current.alignmentScore - previous.alignmentScore
          : null,
    },
  };
}

// ── Weekly Hours Trends ──────────────────────────────────────────

export function aggregateWeeklyHoursTrends(
  org: string,
  weeks = 4
): WeeklyHoursTrend[] {
  const db = getDb();
  const cutoff = dateDaysAgo(weeks * 7);

  const rows = db
    .prepare(
      `SELECT snapshot_date, hours_json
       FROM time_tracking_snapshots
       WHERE org = ? AND member_id = '_team_response_' AND snapshot_date >= ?
       ORDER BY snapshot_date ASC`
    )
    .all(org, cutoff) as Array<{
    snapshot_date: string;
    hours_json: string;
  }>;

  // Group by ISO week
  const weekMap = new Map<
    string,
    { totalHours: number[]; capEx: number[]; opEx: number[] }
  >();

  for (const row of rows) {
    const monday = getISOMonday(row.snapshot_date);
    if (!weekMap.has(monday)) {
      weekMap.set(monday, { totalHours: [], capEx: [], opEx: [] });
    }
    const bucket = weekMap.get(monday)!;
    const hours = safeJsonParse(row.hours_json) as Record<string, unknown> | null;
    if (!hours) continue;

    // Look in summary or top-level
    const summary = (hours.summary as Record<string, unknown>) ?? hours;
    if (typeof summary.totalHours === "number")
      bucket.totalHours.push(summary.totalHours);
    if (typeof summary.capExHours === "number") bucket.capEx.push(summary.capExHours);
    if (typeof summary.opExHours === "number") bucket.opEx.push(summary.opExHours);
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, data]) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      totalHours:
        data.totalHours.length > 0
          ? data.totalHours[data.totalHours.length - 1]
          : 0,
      capExHours:
        data.capEx.length > 0 ? data.capEx[data.capEx.length - 1] : 0,
      opExHours: data.opEx.length > 0 ? data.opEx[data.opEx.length - 1] : 0,
    }));
}
