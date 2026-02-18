import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { UnmatchedAuthorsResponse } from "@/lib/ado/types";

export async function GET(request: NextRequest) {
  const configOrError = extractConfig(request);
  if ("status" in configOrError) return configOrError;

  const response: UnmatchedAuthorsResponse = {
    authors: [
      {
        identity: "build-service@contoso.com",
        prCount: 12,
        repos: ["infra-deploy"],
        type: "service",
      },
      {
        identity: "contractor@partner.com",
        prCount: 5,
        repos: ["web-app", "api-gw"],
        type: "external",
      },
      {
        identity: "unknown-user@domain.com",
        prCount: 2,
        repos: ["legacy-tools"],
        type: "unknown",
      },
    ],
  };

  return jsonWithCache(response);
}
