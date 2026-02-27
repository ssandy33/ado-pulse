import type { SettingsData, MemberProfile } from "@/lib/ado/types";

// Mock fs/promises so we never touch disk
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();

jest.mock("fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

import {
  getMemberProfiles,
  upsertMemberProfile,
  buildAgencyLookup,
  buildAgencyLookupByEmail,
} from "@/lib/settings";

const fteProfile: MemberProfile = {
  adoId: "abc123",
  displayName: "Shawn Sandy",
  email: "shawn@arrivia.com",
  employmentType: "fte",
  agency: "arrivia",
};

const contractorProfile: MemberProfile = {
  adoId: "def456",
  displayName: "Contractor Name",
  email: "name@vendor.com",
  employmentType: "contractor",
  agency: "Apex Staffing",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

// ── getMemberProfiles ────────────────────────────────────────

describe("getMemberProfiles", () => {
  it("returns [] when no profiles exist (fresh install)", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({}));
    const profiles = await getMemberProfiles();
    expect(profiles).toEqual([]);
  });

  it("returns [] when settings file does not exist", async () => {
    const err = Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const profiles = await getMemberProfiles();
    expect(profiles).toEqual([]);
  });

  it("returns stored profiles when they exist", async () => {
    const settings: SettingsData = {
      memberProfiles: { profiles: [fteProfile, contractorProfile] },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(settings));
    const profiles = await getMemberProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].adoId).toBe("abc123");
    expect(profiles[1].adoId).toBe("def456");
  });
});

// ── upsertMemberProfile ─────────────────────────────────────

describe("upsertMemberProfile", () => {
  it("inserts a new profile when none exist", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({}));
    await upsertMemberProfile(fteProfile);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written: SettingsData = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(written.memberProfiles?.profiles).toHaveLength(1);
    expect(written.memberProfiles?.profiles[0]).toEqual(fteProfile);
  });

  it("inserts a second profile alongside existing ones", async () => {
    const existing: SettingsData = {
      memberProfiles: { profiles: [fteProfile] },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(existing));
    await upsertMemberProfile(contractorProfile);

    const written: SettingsData = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(written.memberProfiles?.profiles).toHaveLength(2);
    expect(written.memberProfiles?.profiles[1]).toEqual(contractorProfile);
  });

  it("updates an existing profile matched by adoId", async () => {
    const existing: SettingsData = {
      memberProfiles: { profiles: [fteProfile] },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(existing));

    const updated: MemberProfile = {
      ...fteProfile,
      employmentType: "contractor",
      agency: "New Agency",
    };
    await upsertMemberProfile(updated);

    const written: SettingsData = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(written.memberProfiles?.profiles).toHaveLength(1);
    expect(written.memberProfiles?.profiles[0].agency).toBe("New Agency");
    expect(written.memberProfiles?.profiles[0].employmentType).toBe("contractor");
  });

  it("preserves other settings keys when upserting", async () => {
    const existing: SettingsData = {
      memberRoles: { exclusions: [] },
      teamVisibility: { pinnedTeams: ["Team A"] },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(existing));
    await upsertMemberProfile(fteProfile);

    const written: SettingsData = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(written.memberRoles).toEqual({ exclusions: [] });
    expect(written.teamVisibility).toEqual({ pinnedTeams: ["Team A"] });
    expect(written.memberProfiles?.profiles).toHaveLength(1);
  });
});

// ── buildAgencyLookup ────────────────────────────────────────

describe("buildAgencyLookup", () => {
  it("returns an empty Map for empty profiles", () => {
    const lookup = buildAgencyLookup([]);
    expect(lookup.size).toBe(0);
  });

  it("creates a Map keyed by adoId", () => {
    const lookup = buildAgencyLookup([fteProfile, contractorProfile]);
    expect(lookup.size).toBe(2);
    expect(lookup.get("abc123")).toEqual(fteProfile);
    expect(lookup.get("def456")).toEqual(contractorProfile);
  });

  it("returns undefined for unknown adoIds (defensive join)", () => {
    const lookup = buildAgencyLookup([fteProfile]);
    expect(lookup.get("unknown-id")).toBeUndefined();
  });
});

// ── buildAgencyLookupByEmail ─────────────────────────────────

describe("buildAgencyLookupByEmail", () => {
  it("returns an empty Map for empty profiles", () => {
    const lookup = buildAgencyLookupByEmail([]);
    expect(lookup.size).toBe(0);
  });

  it("creates a Map keyed by lowercased email", () => {
    const lookup = buildAgencyLookupByEmail([fteProfile, contractorProfile]);
    expect(lookup.size).toBe(2);
    expect(lookup.get("shawn@arrivia.com")).toEqual(fteProfile);
    expect(lookup.get("name@vendor.com")).toEqual(contractorProfile);
  });

  it("matches case-insensitively", () => {
    const mixedCaseProfile: MemberProfile = {
      ...fteProfile,
      email: "Shawn@Arrivia.COM",
    };
    const lookup = buildAgencyLookupByEmail([mixedCaseProfile]);
    expect(lookup.get("shawn@arrivia.com")).toEqual(mixedCaseProfile);
  });

  it("returns undefined for unknown emails", () => {
    const lookup = buildAgencyLookupByEmail([fteProfile]);
    expect(lookup.get("unknown@example.com")).toBeUndefined();
  });
});
