export interface Team {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  displayName: string;
  uniqueName: string;
}

export interface PullRequest {
  pullRequestId: number;
  title: string;
  createdBy: {
    id: string;
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate: string;
  repository: {
    id: string;
    name: string;
  };
  workItemRefs: { id: string; url: string }[];
}

export interface AdoListResponse<T> {
  count: number;
  value: T[];
}

export interface TeamsApiResponse {
  teams: Team[];
  default: string;
}

export interface MemberSummary {
  id: string;
  displayName: string;
  uniqueName: string;
  prCount: number;
  repos: string[];
  lastPRDate: string | null;
  isActive: boolean;
  reviewsGiven: number;
  reviewFlagged: boolean;
}

export interface RepoSummary {
  repoName: string;
  totalPRs: number;
  contributors: string[];
}

export interface TeamSummaryApiResponse {
  period: {
    days: number;
    from: string;
    to: string;
  };
  team: {
    name: string;
    totalPRs: number;
    activeContributors: number;
    totalMembers: number;
  };
  members: MemberSummary[];
  byRepo: RepoSummary[];
}
