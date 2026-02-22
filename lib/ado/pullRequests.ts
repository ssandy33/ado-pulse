import { adoFetch, projectUrl } from "./client";
import type { AdoConfig, AdoListResponse, PullRequest } from "./types";
import type { ODataPullRequest } from "./odata";
import { getWorkItems } from "./workItems";

/**
 * Retrieve pull requests that were completed on or after the specified date.
 *
 * @param from - Start date; only pull requests with a completion time on or after this date are included
 * @returns An array of pull requests completed on or after `from`
 */
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

/**
 * Count completed reviews a member provided since a given date, excluding reviews on their own pull requests.
 *
 * @param memberId - The ID of the reviewer to count reviews for
 * @param from - The earliest date (inclusive) to consider for completed reviews
 * @returns The number of completed reviews the member gave since `from`, excluding reviews of PRs they created
 */
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

/**
 * Retrieve pull requests that were completed within the specified date range and return them in ODataPullRequest shape with resolved work item area paths.
 *
 * Filters pull requests fetched since `from` to include only those with a `closedDate` on or before `to`. Each returned object contains PullRequestId, Title, CreatedDate, CompletedDate, CreatedBy (UserName and UserEmail from the PR's `uniqueName`), and WorkItems with `WorkItemId` and `AreaPath` (empty string when unavailable).
 *
 * @param from - ISO date string (inclusive) that specifies the earliest creation/completion date to consider
 * @param to - ISO date string (inclusive) that specifies the latest closed date to include
 * @returns An array of ODataPullRequest objects for PRs closed between `from` and `to`, with associated work items and their AreaPath values
 */
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