/**
 * Return today's date as a UTC YYYY-MM-DD string.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return the date `days` ago as a YYYY-MM-DD string (UTC).
 */
export function dateDaysAgo(days: number): string {
  const d = new Date(today());
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a { from, to } date range looking back `days` from `now`.
 * `now` defaults to the current time but can be injected for testing.
 */
export function getLookbackDateRange(
  days: number,
  now: Date = new Date()
): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from, to };
}
