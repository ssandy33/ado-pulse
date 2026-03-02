import { isSnapshotFresh, buildDateRange, findMissingDates } from "@/lib/cache-utils";

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-02-25T12:00:00Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

// ── isSnapshotFresh ──────────────────────────────────────────────────

describe("isSnapshotFresh", () => {
  it("returns true when snapshotDate matches today", () => {
    expect(isSnapshotFresh("2026-02-25")).toBe(true);
  });

  it("returns false when snapshotDate is yesterday", () => {
    expect(isSnapshotFresh("2026-02-24")).toBe(false);
  });

  it("returns false when snapshotDate is a future date", () => {
    expect(isSnapshotFresh("2026-02-26")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSnapshotFresh("")).toBe(false);
  });
});

// ── buildDateRange ───────────────────────────────────────────────────

describe("buildDateRange", () => {
  it("converts Date objects to YYYY-MM-DD pair", () => {
    const from = new Date("2026-02-01T00:00:00Z");
    const to = new Date("2026-02-25T23:59:59Z");
    expect(buildDateRange(from, to)).toEqual({
      from: "2026-02-01",
      to: "2026-02-25",
    });
  });

  it("handles same-day range", () => {
    const d = new Date("2026-02-25T12:00:00Z");
    expect(buildDateRange(d, d)).toEqual({
      from: "2026-02-25",
      to: "2026-02-25",
    });
  });

  it("handles cross-month range", () => {
    const from = new Date("2026-01-28T00:00:00Z");
    const to = new Date("2026-02-03T00:00:00Z");
    expect(buildDateRange(from, to)).toEqual({
      from: "2026-01-28",
      to: "2026-02-03",
    });
  });
});

// ── findMissingDates ─────────────────────────────────────────────────

describe("findMissingDates", () => {
  it("returns dates in expected but not in existing", () => {
    const expected = ["2026-02-23", "2026-02-24", "2026-02-25"];
    const existing = ["2026-02-24"];
    expect(findMissingDates(expected, existing)).toEqual([
      "2026-02-23",
      "2026-02-25",
    ]);
  });

  it("returns empty array when all dates exist", () => {
    const dates = ["2026-02-24", "2026-02-25"];
    expect(findMissingDates(dates, dates)).toEqual([]);
  });

  it("returns all dates when existing is empty", () => {
    const expected = ["2026-02-23", "2026-02-24"];
    expect(findMissingDates(expected, [])).toEqual(expected);
  });

  it("returns empty array when expected is empty", () => {
    expect(findMissingDates([], ["2026-02-24"])).toEqual([]);
  });
});
