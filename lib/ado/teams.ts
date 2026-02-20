import { adoFetch, orgUrl } from "./client";
import type { AdoConfig, AdoListResponse, Team, TeamMember } from "./types";

interface AdoTeamMemberWrapper {
  identity: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
}

export async function getProjectTeams(config: AdoConfig): Promise<Team[]> {
  const url = orgUrl(
    config,
    `_apis/projects/${encodeURIComponent(config.project)}/teams?api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<Team>>(config, url);
  return data.value.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamMembers(
  config: AdoConfig,
  teamName: string,
  teamId?: string
): Promise<TeamMember[]> {
  let resolvedId = teamId;

  if (!resolvedId) {
    const teams = await getProjectTeams(config);
    const team = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    resolvedId = team.id;
  }

  const url = orgUrl(
    config,
    `_apis/projects/${encodeURIComponent(config.project)}/teams/${encodeURIComponent(resolvedId)}/members?api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<AdoTeamMemberWrapper>>(config, url);

  return data.value.map((m) => ({
    id: m.identity.id,
    displayName: m.identity.displayName,
    uniqueName: m.identity.uniqueName,
  }));
}
