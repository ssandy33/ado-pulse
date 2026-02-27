import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockGetTeamSnapshots = jest.fn();
const mockGetTimeSnapshots = jest.fn();

jest.mock("@/lib/snapshots", () => ({
  getTeamSnapshots: (...args: unknown[]) => mockGetTeamSnapshots(...args),
  getTimeSnapshots: (...args: unknown[]) => mockGetTimeSnapshots(...args),
}));

import { GET } from "@/app/api/snapshots/route";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/snapshots");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("GET /api/snapshots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when org is missing from both query and headers", async () => {
    const res = await GET(makeRequest({ project: "myproject" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/org/);
  });

  it("returns 400 when project is missing from both query and headers", async () => {
    const res = await GET(makeRequest({ org: "myorg" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/project/);
  });

  it("returns PR snapshots by default", async () => {
    mockGetTeamSnapshots.mockReturnValue([
      {
        snapshotDate: "2026-02-25",
        teamSlug: "alpha",
        org: "myorg",
        project: "myproject",
        createdAt: "2026-02-25 14:30:00",
        metrics: { totalPRs: 5 },
      },
    ]);

    const res = await GET(makeRequest({ org: "myorg", project: "myproject" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("pr");
    expect(body.count).toBe(1);
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0].teamSlug).toBe("alpha");
    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("myorg", "myproject", null, 30);
  });

  it("returns time snapshots when type=time", async () => {
    mockGetTimeSnapshots.mockReturnValue([
      {
        snapshotDate: "2026-02-25",
        memberId: "alice@example.com",
        memberName: "Alice",
        org: "myorg",
        totalHours: 6.5,
        createdAt: "2026-02-25 14:30:00",
        hours: { totalHours: 6.5 },
      },
    ]);

    const res = await GET(
      makeRequest({ org: "myorg", project: "myproject", type: "time" })
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("time");
    expect(body.count).toBe(1);
    expect(body.snapshots[0].memberId).toBe("alice@example.com");
    expect(mockGetTimeSnapshots).toHaveBeenCalledWith("myorg", 30);
  });

  it("passes team filter to getTeamSnapshots", async () => {
    mockGetTeamSnapshots.mockReturnValue([]);

    await GET(
      makeRequest({ org: "myorg", project: "myproject", team: "alpha" })
    );

    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("myorg", "myproject", "alpha", 30);
  });

  it("respects days param", async () => {
    mockGetTeamSnapshots.mockReturnValue([]);

    await GET(
      makeRequest({ org: "myorg", project: "myproject", days: "7" })
    );

    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("myorg", "myproject", null, 7);
  });

  it("clamps days to valid range", async () => {
    mockGetTeamSnapshots.mockReturnValue([]);

    await GET(
      makeRequest({ org: "myorg", project: "myproject", days: "9999" })
    );
    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("myorg", "myproject", null, 365);

    mockGetTeamSnapshots.mockClear();

    await GET(
      makeRequest({ org: "myorg", project: "myproject", days: "0" })
    );
    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("myorg", "myproject", null, 1);
  });

  it("returns 500 with generic message when helper throws", async () => {
    mockGetTeamSnapshots.mockImplementation(() => {
      throw new Error("DB is locked");
    });

    const res = await GET(makeRequest({ org: "myorg", project: "myproject" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("falls back to x-ado-org/x-ado-project headers when query params absent", async () => {
    mockGetTeamSnapshots.mockReturnValue([]);

    const url = new URL("http://localhost:3000/api/snapshots");
    const req = new NextRequest(url, {
      headers: {
        "x-ado-org": "header-org",
        "x-ado-project": "header-proj",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("header-org", "header-proj", null, 30);
  });

  it("prefers query params over headers", async () => {
    mockGetTeamSnapshots.mockReturnValue([]);

    const url = new URL("http://localhost:3000/api/snapshots?org=query-org&project=query-proj");
    const req = new NextRequest(url, {
      headers: {
        "x-ado-org": "header-org",
        "x-ado-project": "header-proj",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetTeamSnapshots).toHaveBeenCalledWith("query-org", "query-proj", null, 30);
  });
});
