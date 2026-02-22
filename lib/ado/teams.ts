import { adoFetch, orgUrl, projectUrl } from "./client";
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

/**
 * Retrieve members of a team in the configured project.
 *
 * @param config - ADO connection and project configuration
 * @param teamName - The team name to resolve when `teamId` is not provided
 * @param teamId - Optional team id; when provided, skips resolving the team by name
 * @returns An array of TeamMember objects, each containing `id`, `displayName`, and `uniqueName`
 * @throws Error if no team with the given `teamName` is found and `teamId` is not provided
 */
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

interface TeamFieldValue {
  value: string;
  includeChildren: boolean;
}

interface TeamFieldValuesResponse {
  defaultValue: string;
  values: TeamFieldValue[];
}

/**
 * Retrieve a team's default area path and all configured area paths.
 *
 * @param teamName - Name of the team to look up; matching is case-insensitive.
 * @returns An object containing `defaultAreaPath` (the team's default area path) and `areaPaths` (an array of all configured area path strings).
 * @throws Error if a team with the given `teamName` is not found.
 */
export async function getTeamAreaPath(
  config: AdoConfig,
  teamName: string
): Promise<{ defaultAreaPath: string; areaPaths: string[] }> {
  const teams = await getProjectTeams(config);
  const team = teams.find(
    (t) => t.name.toLowerCase() === teamName.toLowerCase()
  );

  if (!team) {
    throw new Error(`Team "${teamName}" not found`);
  }

  const url = projectUrl(
    config,
    `${encodeURIComponent(team.id)}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`
  );
  const data = await adoFetch<TeamFieldValuesResponse>(config, url);

  return {
    defaultAreaPath: data.defaultValue,
    areaPaths: data.values.map((v) => v.value),
  };
}