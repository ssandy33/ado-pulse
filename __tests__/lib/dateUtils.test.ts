import { getLookbackDateRange } from "@/lib/dateUtils";

describe("getLookbackDateRange", () => {
  const fixedNow = new Date("2026-02-20T00:00:00.000Z");

  it("returns a range exactly N days back from the given date", () => {
    const { from, to } = getLookbackDateRange(30, fixedNow);
    expect(to.toISOString().startsWith("2026-02-20")).toBe(true);
    expect(from.toISOString().startsWith("2026-01-21")).toBe(true);
  });

  it("does not mutate the input date", () => {
    const original = new Date("2026-02-20T00:00:00.000Z");
    const originalTime = original.getTime();
    getLookbackDateRange(30, original);
    expect(original.getTime()).toBe(originalTime);
  });

  it("defaults to current time when no date is provided", () => {
    const before = Date.now();
    const { to } = getLookbackDateRange(30);
    const after = Date.now();
    expect(to.getTime()).toBeGreaterThanOrEqual(before);
    expect(to.getTime()).toBeLessThanOrEqual(after);
  });

  it("handles 0-day lookback", () => {
    const { from, to } = getLookbackDateRange(0, fixedNow);
    expect(from.toISOString()).toBe(to.toISOString());
  });
});
