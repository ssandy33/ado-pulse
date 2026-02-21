import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { UsersNoTeamResponse } from "@/lib/ado/types";

export async function GET(request: NextRequest) {
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

  return jsonWithCache(response);
}
