import { resolveRange, parseRange } from "@/lib/dateRange";

describe("resolveRange", () => {
  describe("pm (previous month)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns 1st to last day of the previous month", () => {
      jest.setSystemTime(new Date(2026, 2, 15)); // March 15
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2026, 1, 1)); // Feb 1
      expect(result.to).toEqual(new Date(2026, 1, 28)); // Feb 28
      expect(result.label).toBe("previous month");
    });

    it("returns correct days for a 31-day month", () => {
      jest.setSystemTime(new Date(2026, 1, 10)); // Feb 10
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2026, 0, 1)); // Jan 1
      expect(result.to).toEqual(new Date(2026, 0, 31)); // Jan 31
      expect(result.days).toBe(31);
    });

    it("returns correct days for a 30-day month", () => {
      jest.setSystemTime(new Date(2026, 4, 5)); // May 5
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2026, 3, 1)); // Apr 1
      expect(result.to).toEqual(new Date(2026, 3, 30)); // Apr 30
      expect(result.days).toBe(30);
    });

    it("returns correct days for February (28 days)", () => {
      jest.setSystemTime(new Date(2026, 2, 1)); // March 1
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2026, 1, 1)); // Feb 1
      expect(result.to).toEqual(new Date(2026, 1, 28)); // Feb 28
      expect(result.days).toBe(28);
    });

    it("handles leap year February (29 days)", () => {
      jest.setSystemTime(new Date(2028, 2, 1)); // March 1, 2028 (leap year)
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2028, 1, 1)); // Feb 1
      expect(result.to).toEqual(new Date(2028, 1, 29)); // Feb 29
      expect(result.days).toBe(29);
    });

    it("handles January — wraps to December of prior year", () => {
      jest.setSystemTime(new Date(2026, 0, 15)); // Jan 15, 2026
      const result = resolveRange("pm");
      expect(result.from).toEqual(new Date(2025, 11, 1)); // Dec 1, 2025
      expect(result.to).toEqual(new Date(2025, 11, 31)); // Dec 31, 2025
      expect(result.days).toBe(31);
    });
  });
});

describe("parseRange", () => {
  it('returns "pm" for "pm" input', () => {
    expect(parseRange("pm")).toBe("pm");
  });

  it('returns "14" for unknown input', () => {
    expect(parseRange("unknown")).toBe("14");
    expect(parseRange(null)).toBe("14");
  });

  it("accepts existing valid ranges", () => {
    expect(parseRange("7")).toBe("7");
    expect(parseRange("14")).toBe("14");
    expect(parseRange("mtd")).toBe("mtd");
  });
});
