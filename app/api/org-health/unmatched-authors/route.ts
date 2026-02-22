import { NextRequest } from "next/server";
import { extractConfig, jsonWithCache } from "@/lib/ado/helpers";
import type { UnmatchedAuthorsResponse } from "@/lib/ado/types";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info("Request start", { route: "org-health/unmatched-authors" });
  const configOrError = await extractConfig(request);
  if ("status" in configOrError) return configOrError;

  const response: UnmatchedAuthorsResponse = {
    authors: [
      {
        uniqueName: "build-service@contoso.com",
        displayName: "Build Service",
        prCount: 12,
        repos: ["infra-deploy"],
        lastPRDate: "2025-12-01T10:30:00Z",
        likelyType: "service-account",
        prs: [
          {
            pullRequestId: 4501,
            title: "Auto-update deployment manifests",
            repoName: "infra-deploy",
            creationDate: "2025-12-01T10:30:00Z",
            url: "https://dev.azure.com/contoso/MyProject/_git/infra-deploy/pullrequest/4501",
          },
          {
            pullRequestId: 4480,
            title: "Bump Helm chart versions",
            repoName: "infra-deploy",
            creationDate: "2025-11-28T08:15:00Z",
            url: "https://dev.azure.com/contoso/MyProject/_git/infra-deploy/pullrequest/4480",
          },
        ],
      },
      {
        uniqueName: "contractor@partner.com",
        displayName: "Jane Contractor",
        prCount: 5,
        repos: ["web-app", "api-gw"],
        lastPRDate: "2025-11-20T14:00:00Z",
        likelyType: "external",
        prs: [
          {
            pullRequestId: 4412,
            title: "Add OAuth2 login flow",
            repoName: "web-app",
            creationDate: "2025-11-20T14:00:00Z",
            url: "https://dev.azure.com/contoso/MyProject/_git/web-app/pullrequest/4412",
          },
          {
            pullRequestId: 4390,
            title: "Fix CORS headers on gateway",
            repoName: "api-gw",
            creationDate: "2025-11-15T09:45:00Z",
            url: "https://dev.azure.com/contoso/MyProject/_git/api-gw/pullrequest/4390",
          },
        ],
      },
      {
        uniqueName: "unknown-user@domain.com",
        displayName: "unknown-user@domain.com",
        prCount: 2,
        repos: ["legacy-tools"],
        lastPRDate: "2025-10-05T16:20:00Z",
        likelyType: "unknown",
        prs: [
          {
            pullRequestId: 4200,
            title: "Patch legacy XML parser",
            repoName: "legacy-tools",
            creationDate: "2025-10-05T16:20:00Z",
            url: "https://dev.azure.com/contoso/MyProject/_git/legacy-tools/pullrequest/4200",
          },
        ],
      },
    ],
  };

  logger.info("Request complete", { route: "org-health/unmatched-authors" });
  return jsonWithCache(response);
}
