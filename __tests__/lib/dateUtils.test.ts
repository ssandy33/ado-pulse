import { getLookbackDateRange, today, dateDaysAgo } from "@/lib/dateUtils";

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

describe("today", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-25T18:30:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("returns a YYYY-MM-DD string for the current UTC date", () => {
    expect(today()).toBe("2026-02-25");
  });

  it("returns a 10-character string", () => {
    expect(today()).toHaveLength(10);
  });
});

describe("dateDaysAgo", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-25T18:30:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("returns a YYYY-MM-DD string N days before today", () => {
    expect(dateDaysAgo(7)).toBe("2026-02-18");
  });

  it("returns today's date when days is 0", () => {
    expect(dateDaysAgo(0)).toBe("2026-02-25");
  });
});
