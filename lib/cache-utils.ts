import { today } from "@/lib/dateUtils";

/**
 * Returns true if snapshotDate equals today (YYYY-MM-DD).
 */
export function isSnapshotFresh(snapshotDate: string): boolean {
  return snapshotDate === today();
}

/**
 * Converts two Date objects to a { from, to } pair of YYYY-MM-DD strings.
 */
export function buildDateRange(from: Date, to: Date): { from: string; to: string } {
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/**
 * Returns the set difference: dates in `expected` that are not in `existing`.
 */
export function findMissingDates(expected: string[], existing: string[]): string[] {
  const existingSet = new Set(existing);
  return expected.filter((d) => !existingSet.has(d));
}
