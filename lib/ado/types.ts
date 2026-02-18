export interface AdoConfig {
  org: string;
  project: string;
  pat: string;
}

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
  repoId: string;
  repoName: string;
  totalPRs: number;
  contributors: string[];
}

export type PolicyStatus = "enabled" | "disabled" | "not_configured";

export interface RepoPolicyStatus {
  repoName: string;
  repoId: string;
  policies: {
    minReviewers: PolicyStatus;
    buildValidation: PolicyStatus;
    workItemLinking: PolicyStatus;
    commentResolution: PolicyStatus;
    mergeStrategy: PolicyStatus;
  };
  compliance: "full" | "partial" | "none";
}

export interface PolicyAuditResponse {
  coverage: { compliant: number; total: number };
  repos: RepoPolicyStatus[];
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
