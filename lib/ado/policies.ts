import { adoFetch, projectUrl } from "./client";
import type { AdoConfig, PolicyStatus, RepoPolicyStatus } from "./types";

// Well-known ADO policy type IDs
const POLICY_TYPE_IDS: Record<string, keyof RepoPolicyStatus["policies"]> = {
  "fa4e907d-c16b-4a4c-9dfa-4906e5d171dd": "minReviewers",
  "0609b952-1397-4640-95ec-e00a01b2c241": "buildValidation",
  "40e92b44-2fe1-4dd6-b3d8-74a9c21d0c6e": "workItemLinking",
  "c6a1889d-b943-4856-b76f-9e46bb6b0df2": "commentResolution",
  "fa4e907d-c16b-4a4c-9dfa-4916e5d171cb": "mergeStrategy",
};

interface PolicyScope {
  repositoryId: string | null;
  refName: string | null;
  matchKind: string;
}

interface PolicyConfiguration {
  id: number;
  isEnabled: boolean;
  isBlocking: boolean;
  type: { id: string };
  settings: {
    scope: PolicyScope[];
    [key: string]: unknown;
  };
}

interface PolicyListResponse {
  count: number;
  value: PolicyConfiguration[];
}

export async function getPolicyConfigurations(
  config: AdoConfig
): Promise<PolicyConfiguration[]> {
  const url = projectUrl(config, "_apis/policy/configurations?api-version=7.1");
  const res = await adoFetch<PolicyListResponse>(config, url);
  return res.value;
}

export function buildRepoPolicyStatuses(
  policies: PolicyConfiguration[],
  repos: { repoId: string; repoName: string }[]
): RepoPolicyStatus[] {
  // Initialize each repo with not_configured for all policies
  const repoStatusMap = new Map<
    string,
    { repoName: string; policies: Record<keyof RepoPolicyStatus["policies"], PolicyStatus> }
  >();

  for (const repo of repos) {
    repoStatusMap.set(repo.repoId, {
      repoName: repo.repoName,
      policies: {
        minReviewers: "not_configured",
        buildValidation: "not_configured",
        workItemLinking: "not_configured",
        commentResolution: "not_configured",
        mergeStrategy: "not_configured",
      },
    });
  }

  const repoIdSet = new Set(repos.map((r) => r.repoId));

  for (const policy of policies) {
    const policyKey = POLICY_TYPE_IDS[policy.type.id];
    if (!policyKey) continue;

    const scopes = policy.settings.scope || [];
    const status: PolicyStatus = policy.isEnabled ? "enabled" : "disabled";

    for (const scope of scopes) {
      if (scope.repositoryId === null) {
        // Project-wide policy — applies to all tracked repos
        for (const [repoId, entry] of repoStatusMap) {
          if (entry.policies[policyKey] === "not_configured") {
            entry.policies[policyKey] = status;
          }
        }
      } else if (repoIdSet.has(scope.repositoryId)) {
        const entry = repoStatusMap.get(scope.repositoryId);
        if (entry) {
          // Repo-specific policy overrides project-wide
          entry.policies[policyKey] = status;
        }
      }
    }
  }

  return repos.map((repo) => {
    const entry = repoStatusMap.get(repo.repoId)!;
    const values = Object.values(entry.policies);
    const enabledCount = values.filter((v) => v === "enabled").length;
    const compliance: RepoPolicyStatus["compliance"] =
      enabledCount === values.length
        ? "full"
        : enabledCount > 0
          ? "partial"
          : "none";

    return {
      repoId: repo.repoId,
      repoName: entry.repoName,
      policies: entry.policies,
      compliance,
    };
  });
}
