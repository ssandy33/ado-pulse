import { adoFetch, projectUrl } from "./client";
import type { AdoConfig, AdoListResponse, PullRequest } from "./types";
import type { ODataPullRequest } from "./odata";
import { getWorkItems } from "./workItems";

export async function getPullRequests(
  config: AdoConfig,
  from: Date
): Promise<PullRequest[]> {
  const minTime = from.toISOString();

  const url = projectUrl(
    config,
    `_apis/git/pullrequests?searchCriteria.status=completed&searchCriteria.minTime=${encodeURIComponent(minTime)}&$top=500&api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<PullRequest>>(config, url);
  return data.value;
}

export async function getOpenPullRequests(
  config: AdoConfig
): Promise<PullRequest[]> {
  const url = projectUrl(
    config,
    `_apis/git/pullrequests?searchCriteria.status=active&$top=500&api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<PullRequest>>(config, url);
  return data.value;
}

export async function getReviewsGivenByMember(
  config: AdoConfig,
  memberId: string,
  from: Date
): Promise<number> {
  const minTime = from.toISOString();

  const url = projectUrl(
    config,
    `_apis/git/pullrequests?searchCriteria.reviewerId=${encodeURIComponent(memberId)}&searchCriteria.status=completed&searchCriteria.minTime=${encodeURIComponent(minTime)}&$top=500&api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<PullRequest>>(config, url);

  // Filter out self-reviews
  const reviews = data.value.filter((pr) => pr.createdBy.id !== memberId);
  return reviews.length;
}

export async function getPRsWithWorkItemsREST(
  config: AdoConfig,
  from: string,
  to: string
): Promise<ODataPullRequest[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const prs = await getPullRequests(config, fromDate);

  // REST only supports minTime, so filter closedDate <= to
  const filtered = prs.filter((pr) => {
    if (!pr.closedDate) return false;
    return new Date(pr.closedDate) <= toDate;
  });

  // Collect all work item IDs
  const allWorkItemIds: number[] = [];
  for (const pr of filtered) {
    if (pr.workItemRefs) {
      for (const ref of pr.workItemRefs) {
        allWorkItemIds.push(Number(ref.id));
      }
    }
  }

  // Batch-fetch work items (includes AreaPath)
  const workItemMap = await getWorkItems(config, allWorkItemIds);

  // Map to ODataPullRequest shape
  return filtered.map((pr) => ({
    PullRequestId: pr.pullRequestId,
    Title: pr.title,
    CreatedDate: pr.creationDate,
    CompletedDate: pr.closedDate,
    CreatedBy: {
      UserName: pr.createdBy.uniqueName,
      UserEmail: pr.createdBy.uniqueName,
    },
    WorkItems: (pr.workItemRefs || []).map((ref) => {
      const wi = workItemMap.get(Number(ref.id));
      return {
        WorkItemId: Number(ref.id),
        AreaPath: wi?.fields["System.AreaPath"] || "",
      };
    }),
  }));
}
