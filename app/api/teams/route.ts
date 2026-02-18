import { NextRequest, NextResponse } from "next/server";
import { getProjectTeams } from "@/lib/ado/teams";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";

export async function GET(request: NextRequest) {
  const configOrError = extractConfig(request);
  if (configOrError instanceof NextResponse) return configOrError;

  try {
    const teams = await getProjectTeams(configOrError);

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
