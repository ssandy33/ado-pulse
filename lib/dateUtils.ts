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
