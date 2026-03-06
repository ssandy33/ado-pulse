import { buildPerPersonBuckets } from "@/lib/trends";

describe("buildPerPersonBuckets", () => {
  const members = [
    { uniqueName: "alice@example.com", displayName: "Alice" },
    { uniqueName: "bob@example.com", displayName: "Bob" },
  ];

  it("groups PRs by date and member with zero-fill", () => {
    const prs = [
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
      { closedDate: "2026-03-01T14:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
      { closedDate: "2026-03-02T08:00:00Z", createdBy: { uniqueName: "bob@example.com", displayName: "Bob" } },
    ];

    const result = buildPerPersonBuckets(prs, members, "2026-03-01", "2026-03-03");

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      date: "2026-03-01",
      dateLabel: expect.any(String),
      Alice: 2,
      Bob: 0,
    });
    expect(result[1]).toEqual({
      date: "2026-03-02",
      dateLabel: expect.any(String),
      Alice: 0,
      Bob: 1,
    });
    expect(result[2]).toEqual({
      date: "2026-03-03",
      dateLabel: expect.any(String),
      Alice: 0,
      Bob: 0,
    });
  });

  it("handles empty PR list with zero-filled dates", () => {
    const result = buildPerPersonBuckets([], members, "2026-03-01", "2026-03-02");

    expect(result).toHaveLength(2);
    expect(result[0].Alice).toBe(0);
    expect(result[0].Bob).toBe(0);
  });

  it("handles case-insensitive uniqueName matching", () => {
    const prs = [
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "ALICE@EXAMPLE.COM", displayName: "Alice" } },
    ];

    const result = buildPerPersonBuckets(prs, members, "2026-03-01", "2026-03-01");

    expect(result[0].Alice).toBe(1);
  });

  it("excludes PRs outside the date range", () => {
    const prs = [
      { closedDate: "2026-02-28T10:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
      { closedDate: "2026-03-04T10:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
    ];

    const result = buildPerPersonBuckets(prs, members, "2026-03-01", "2026-03-02");

    expect(result).toHaveLength(2);
    expect(result[0].Alice).toBe(1);
    expect(result[1].Alice).toBe(0);
  });

  it("ignores PRs from non-team-members", () => {
    const prs = [
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "charlie@example.com", displayName: "Charlie" } },
    ];

    const result = buildPerPersonBuckets(prs, members, "2026-03-01", "2026-03-01");

    expect(result[0].Alice).toBe(0);
    expect(result[0].Bob).toBe(0);
    expect(result[0]).not.toHaveProperty("Charlie");
  });

  it("uses displayName as data keys", () => {
    const prs = [
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "alice@example.com", displayName: "Alice" } },
    ];

    const result = buildPerPersonBuckets(prs, members, "2026-03-01", "2026-03-01");

    expect(Object.keys(result[0])).toContain("Alice");
    expect(Object.keys(result[0])).toContain("Bob");
    expect(Object.keys(result[0])).not.toContain("alice@example.com");
  });

  it("handles members with same displayName but different uniqueName via first-seen", () => {
    const dupeMembers = [
      { uniqueName: "alice1@example.com", displayName: "Alice" },
      { uniqueName: "alice2@example.com", displayName: "Alice" },
    ];
    const prs = [
      { closedDate: "2026-03-01T10:00:00Z", createdBy: { uniqueName: "alice1@example.com", displayName: "Alice" } },
      { closedDate: "2026-03-01T14:00:00Z", createdBy: { uniqueName: "alice2@example.com", displayName: "Alice" } },
    ];

    // Both map to the same displayName key — counts combine
    const result = buildPerPersonBuckets(prs, dupeMembers, "2026-03-01", "2026-03-01");
    expect(result[0].Alice).toBe(2);
  });

  it("includes dateLabel on each point", () => {
    const result = buildPerPersonBuckets([], members, "2026-03-01", "2026-03-01");

    expect(result[0].dateLabel).toBe("Mar 1");
  });
});
