import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache, handleApiError } from "@/lib/ado/helpers";
import { getPolicyConfigurations, buildRepoPolicyStatuses } from "@/lib/ado/policies";
import type { PolicyAuditResponse } from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  try {
    const reposParam = request.nextUrl.searchParams.get("repos");
    if (!reposParam) {
      return jsonWithCache({ error: "Missing repos parameter" });
    }

    let repos: { repoId: string; repoName: string }[];
    try {
      repos = JSON.parse(reposParam);
    } catch {
      return jsonWithCache({ error: "Invalid repos JSON" });
    }

    // Truncate to top 20 repos for URL length safety
    repos = repos.slice(0, 20);

    const policies = await getPolicyConfigurations(configOrError);
    const repoStatuses = buildRepoPolicyStatuses(policies, repos);

    const compliant = repoStatuses.filter((r) => r.compliance === "full").length;

    const response: PolicyAuditResponse = {
      coverage: { compliant, total: repoStatuses.length },
      repos: repoStatuses,
    };

    return jsonWithCache(response);
  } catch (error) {
    return handleApiError(error);
  }
}
