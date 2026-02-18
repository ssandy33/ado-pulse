import { adoFetch, orgUrl } from "./client";
import type { AdoListResponse, Team, TeamMember } from "./types";

interface AdoTeamMemberWrapper {
  identity: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
}

export async function getProjectTeams(): Promise<Team[]> {
  const org = process.env.ADO_ORG!;
  const project = process.env.ADO_PROJECT!;

  const url = orgUrl(
    `_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<Team>>(url);
  return data.value.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamMembers(
  teamName: string
): Promise<TeamMember[]> {
  const teams = await getProjectTeams();
  const team = teams.find(
    (t) => t.name.toLowerCase() === teamName.toLowerCase()
  );

  if (!team) {
    throw new Error(`Team "${teamName}" not found`);
  }

  const org = process.env.ADO_ORG!;
  const project = process.env.ADO_PROJECT!;

  const url = orgUrl(
    `_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team.id)}/members?api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<AdoTeamMemberWrapper>>(url);

  return data.value.map((m) => ({
    id: m.identity.id,
    displayName: m.identity.displayName,
    uniqueName: m.identity.uniqueName,
  }));
}
