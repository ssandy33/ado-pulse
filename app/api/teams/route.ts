import { NextRequest, NextResponse } from "next/server";
import { getProjectTeams } from "@/lib/ado/teams";
import { extractConfig, jsonWithCache, handleApiError, withLogging } from "@/lib/ado/helpers";
import { readSettings } from "@/lib/settings";

/**
 * Handles GET requests for the project teams list, returning all teams or only configured pinned teams when requested.
 *
 * If the query parameter `pinnedOnly` equals `"true"` and pinned teams are configured, the response contains only those teams sorted by name. Otherwise the response contains all teams. On configuration extraction failure or internal error an appropriate response is returned.
 *
 * @returns A NextResponse whose JSON body includes `teams` (array of team objects), `default` (string), `org` (organization name), and `project` (project name).
 */
async function handler(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const teams = await getProjectTeams(configOrError);

    const pinnedOnly = request.nextUrl.searchParams.get("pinnedOnly") === "true";
    if (pinnedOnly) {
      const settings = await readSettings();
      const pinned = settings.teamVisibility?.pinnedTeams ?? [];
      if (pinned.length > 0) {
        const pinnedSet = new Set(pinned);
        const filtered = teams
          .filter((t) => pinnedSet.has(t.name))
          .sort((a, b) => a.name.localeCompare(b.name));
        return jsonWithCache({
          teams: filtered,
          default: "",
          org: configOrError.org,
          project: configOrError.project,
        });
      }
    }

    return jsonWithCache({
      teams,
      default: "",
      org: configOrError.org,
      project: configOrError.project,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging("teams", handler);