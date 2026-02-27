import { NextRequest } from "next/server";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), flush: jest.fn() },
}));

const mockGetMemberProfiles = jest.fn();
const mockUpsertMemberProfile = jest.fn();

jest.mock("@/lib/settings", () => ({
  getMemberProfiles: (...args: unknown[]) => mockGetMemberProfiles(...args),
  upsertMemberProfile: (...args: unknown[]) => mockUpsertMemberProfile(...args),
}));

import { GET, POST } from "@/app/api/settings/members/route";

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/settings/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /api/settings/members ────────────────────────────────

describe("GET /api/settings/members", () => {
  it("returns { profiles: [] } when no profiles exist", async () => {
    mockGetMemberProfiles.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ profiles: [] });
  });

  it("returns stored profiles", async () => {
    const profiles = [
      {
        adoId: "abc123",
        displayName: "Shawn Sandy",
        email: "shawn@arrivia.com",
        employmentType: "fte",
        agency: "arrivia",
      },
    ];
    mockGetMemberProfiles.mockResolvedValue(profiles);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profiles).toHaveLength(1);
    expect(body.profiles[0].adoId).toBe("abc123");
  });

  it("returns 500 when storage read fails", async () => {
    mockGetMemberProfiles.mockRejectedValue(new Error("disk error"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ── POST /api/settings/members ───────────────────────────────

describe("POST /api/settings/members", () => {
  it("persists a valid profile and returns { ok: true }", async () => {
    mockUpsertMemberProfile.mockResolvedValue(undefined);
    const res = await POST(
      makePostRequest({
        adoId: "abc123",
        displayName: "Shawn Sandy",
        email: "shawn@arrivia.com",
        employmentType: "fte",
        agency: "arrivia",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    expect(mockUpsertMemberProfile).toHaveBeenCalledTimes(1);
    expect(mockUpsertMemberProfile).toHaveBeenCalledWith({
      adoId: "abc123",
      displayName: "Shawn Sandy",
      email: "shawn@arrivia.com",
      employmentType: "fte",
      agency: "arrivia",
    });
  });

  it("returns 400 when adoId is missing", async () => {
    const res = await POST(
      makePostRequest({
        displayName: "No Id",
        email: "no@id.com",
        employmentType: "fte",
        agency: "arrivia",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/adoId/);
  });

  it("returns 400 when agency is missing", async () => {
    const res = await POST(
      makePostRequest({
        adoId: "abc123",
        displayName: "No Agency",
        email: "no@agency.com",
        employmentType: "fte",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/agency/);
  });

  it("returns 400 when employmentType is missing", async () => {
    const res = await POST(
      makePostRequest({
        adoId: "abc123",
        displayName: "No Type",
        email: "no@type.com",
        agency: "arrivia",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/employmentType/);
  });

  it("returns 400 when employmentType is an invalid value", async () => {
    const res = await POST(
      makePostRequest({
        adoId: "abc123",
        displayName: "Bad Type",
        email: "bad@type.com",
        employmentType: "intern",
        agency: "arrivia",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/employmentType/);
  });

  it("returns 500 when storage write fails", async () => {
    mockUpsertMemberProfile.mockRejectedValue(new Error("disk error"));
    const res = await POST(
      makePostRequest({
        adoId: "abc123",
        displayName: "Shawn Sandy",
        email: "shawn@arrivia.com",
        employmentType: "fte",
        agency: "arrivia",
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/settings/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
