import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { UsersNoTeamResponse } from "@/lib/ado/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info("Request start", { route: "org-health/users-no-team" });
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  const response: UsersNoTeamResponse = {
    users: [
      {
        displayName: "Alex Rivera",
        prCount: 8,
        repos: ["web-app", "shared-lib"],
        lastPRDate: "2026-02-10T14:30:00Z",
      },
      {
        displayName: "Jordan Lee",
        prCount: 3,
        repos: ["api-gw"],
        lastPRDate: "2026-02-05T09:15:00Z",
      },
    ],
  };

  logger.info("Request complete", { route: "org-health/users-no-team" });
  return jsonWithCache(response);
}
