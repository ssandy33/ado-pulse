import fs from "fs/promises";
import path from "path";
import type { SettingsData, MemberRoleExclusion, MemberProfile } from "@/lib/ado/types";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export async function readSettings(): Promise<SettingsData> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as SettingsData;
  } catch {
    return {};
  }
}

export async function writeSettings(data: SettingsData): Promise<void> {
  const dir = path.dirname(SETTINGS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getExclusions(): Promise<MemberRoleExclusion[]> {
  const settings = await readSettings();
  return settings.memberRoles?.exclusions ?? [];
}

export async function getMemberProfiles(): Promise<MemberProfile[]> {
  const settings = await readSettings();
  return settings.memberProfiles?.profiles ?? [];
}

export async function upsertMemberProfile(profile: MemberProfile): Promise<void> {
  const settings = await readSettings();
  const profiles = settings.memberProfiles?.profiles ?? [];
  const idx = profiles.findIndex(p => p.adoId === profile.adoId);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await writeSettings({
    ...settings,
    memberProfiles: { profiles },
  });
}

export function buildAgencyLookup(profiles: MemberProfile[]): Map<string, MemberProfile> {
  return new Map(profiles.map(p => [p.adoId, p]));
}

export function buildAgencyLookupByEmail(profiles: MemberProfile[]): Map<string, MemberProfile> {
  return new Map(profiles.map(p => [p.email.toLowerCase(), p]));
}
