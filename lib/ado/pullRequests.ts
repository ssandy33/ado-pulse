import { adoFetch, projectUrl } from "./client";
import type { AdoListResponse, PullRequest } from "./types";

export async function getPullRequests(days: number): Promise<PullRequest[]> {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - days);
  const minTime = minDate.toISOString();

  const url = projectUrl(
    `_apis/git/pullrequests?searchCriteria.status=completed&searchCriteria.minTime=${encodeURIComponent(minTime)}&$top=500&api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<PullRequest>>(url);
  return data.value;
}

export async function getReviewsGivenByMember(
  memberId: string,
  days: number
): Promise<number> {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - days);
  const minTime = minDate.toISOString();

  const url = projectUrl(
    `_apis/git/pullrequests?searchCriteria.reviewerId=${encodeURIComponent(memberId)}&searchCriteria.status=completed&searchCriteria.minTime=${encodeURIComponent(minTime)}&$top=500&api-version=7.1`
  );
  const data = await adoFetch<AdoListResponse<PullRequest>>(url);

  // Filter out self-reviews
  const reviews = data.value.filter((pr) => pr.createdBy.id !== memberId);
  return reviews.length;
}
