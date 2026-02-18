import { getProjectTeams } from "@/lib/ado/teams";
import { jsonWithCache, handleApiError } from "@/lib/ado/helpers";

export async function GET() {
  try {
    const teams = await getProjectTeams();
    const defaultTeam = process.env.ADO_DEFAULT_TEAM || "";

    return jsonWithCache({
      teams,
      default: defaultTeam,
      org: process.env.ADO_ORG || "",
      project: process.env.ADO_PROJECT || "",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
