import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { GhostMembersResponse } from "@/lib/ado/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info("Request start", { route: "org-health/ghost-members" });
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  const response: GhostMembersResponse = {
    members: [
      {
        displayName: "Sam Chen",
        teamName: "Platform Team",
        lastPRDate: "2025-11-20T10:00:00Z",
      },
      {
        displayName: "Morgan Blake",
        teamName: "Platform Team",
        lastPRDate: null,
      },
      {
        displayName: "Casey Nguyen",
        teamName: "Frontend Team",
        lastPRDate: "2025-12-01T16:45:00Z",
      },
    ],
  };

  logger.info("Request complete", { route: "org-health/ghost-members" });
  return jsonWithCache(response);
}
