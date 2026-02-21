export type TimeRange = "7" | "14" | "mtd";

export interface ResolvedRange {
  from: Date;
  to: Date;
  label: string;
  days: number;
}

export function resolveRange(range: TimeRange): ResolvedRange {
  const to = new Date();

  if (range === "mtd") {
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    const days = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { from, to, label: "month to date", days: Math.max(days, 1) };
  }

  const numDays = parseInt(range, 10);
  const from = new Date();
  from.setDate(from.getDate() - numDays);
  return { from, to, label: `last ${numDays} days`, days: numDays };
}

export function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  while (d < to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function parseRange(param: string | null): TimeRange {
  if (param === "7" || param === "14" || param === "mtd") return param;
  return "14";
}
