import { NextRequest, NextResponse } from "next/server";
import { getProjectTeams } from "@/lib/ado/teams";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { logger } from "@/lib/logger";
import { readSettings } from "@/lib/settings";

/**
 * Handles GET requests for the project teams list, returning all teams or only configured pinned teams when requested.
 *
 * If the query parameter `pinnedOnly` equals `"true"` and pinned teams are configured, the response contains only those teams sorted by name. Otherwise the response contains all teams. On configuration extraction failure or internal error an appropriate response is returned.
 *
 * @returns A NextResponse whose JSON body includes `teams` (array of team objects), `default` (string), `org` (organization name), and `project` (project name).
 */
export async function GET(request: NextRequest) {
  const start = Date.now();
  const configOrError = await extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const pinnedOnly = request.nextUrl.searchParams.get("pinnedOnly") === "true";
    logger.info("Request start", { route: "teams", pinnedOnly });

    const teams = await getProjectTeams(configOrError);
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

    logger.info("Request complete", { route: "teams", durationMs: Date.now() - start });
    return jsonWithCache({
      teams,
      default: "",
      org: configOrError.org,
      project: configOrError.project,
    });
  } catch (error) {
    logger.error("Request error", { route: "teams", durationMs: Date.now() - start, stack_trace: error instanceof Error ? error.stack : undefined });
    return handleApiError(error);
  }
}