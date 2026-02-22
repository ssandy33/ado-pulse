import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { PolicyComplianceResponse } from "@/lib/ado/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info("Request start", { route: "org-health/policy-compliance" });
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  const response: PolicyComplianceResponse = {
    compliant: 2,
    total: 3,
    repos: [
      {
        repoName: "web-app",
        status: "compliant",
        activePolicies: ["Minimum reviewers", "Build validation"],
      },
      {
        repoName: "api-gw",
        status: "compliant",
        activePolicies: ["Minimum reviewers", "Build validation", "Work item linking"],
      },
      {
        repoName: "legacy-tools",
        status: "non_compliant",
        activePolicies: [],
      },
    ],
  };

  logger.info("Request complete", { route: "org-health/policy-compliance" });
  return jsonWithCache(response);
}
