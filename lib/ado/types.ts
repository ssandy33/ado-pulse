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
  reviewers: { id: string; displayName: string; uniqueName: string }[];
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

export type Staleness = "fresh" | "aging" | "stale";

export interface OpenPR {
  id: number;
  title: string;
  author: string;
  repoName: string;
  createdDate: string;
  ageInDays: number;
  reviewerCount: number;
  staleness: Staleness;
}

export interface StalePRResponse {
  summary: { fresh: number; aging: number; stale: number; total: number };
  prs: OpenPR[];
}

export interface UnmatchedInTeamRepo {
  uniqueName: string;
  displayName: string;
  prCount: number;
  possibleMatch: boolean;
  possibleMatchName: string | null;
}

export interface DataDiagnostics {
  totalProjectPRs: number;
  teamMatchedPRs: number;
  gapPRs: number;
  matchRate: number;
  teamRepos: string[];
  PRsInTeamRepos: number;
  apiLimitHit: boolean;
  rosterIdentities: string[];
  unmatchedInTeamRepos: UnmatchedInTeamRepo[];
  zeroActivityWarning: boolean;
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
  diagnostics: DataDiagnostics;
}

// ── Org Health types ──────────────────────────────────────────────

export interface UnmatchedAuthorPR {
  pullRequestId: number;
  title: string;
  repoName: string;
  creationDate: string;
  url: string;
}

export interface UnmatchedAuthor {
  uniqueName: string;
  displayName: string;
  prCount: number;
  repos: string[];
  lastPRDate: string;
  likelyType: "service-account" | "external" | "unknown";
  prs: UnmatchedAuthorPR[];
}

export interface UnmatchedAuthorsResponse {
  authors: UnmatchedAuthor[];
}

export interface PolicyComplianceRepo {
  repoName: string;
  status: "compliant" | "non_compliant";
  activePolicies: string[];
}
export interface PolicyComplianceResponse {
  compliant: number;
  total: number;
  repos: PolicyComplianceRepo[];
}

export interface UserNoTeam {
  displayName: string;
  prCount: number;
  repos: string[];
  lastPRDate: string | null;
}
export interface UsersNoTeamResponse {
  users: UserNoTeam[];
}

export interface GhostMember {
  displayName: string;
  teamName: string;
  lastPRDate: string | null;
}
export interface GhostMembersResponse {
  members: GhostMember[];
}

// ── Team Validator types ────────────────────────────────────────

export interface RosterMemberResult {
  displayName: string;
  uniqueName: string;
  foundInPRData: boolean;
  prCount: number;
}

export interface GapAuthorPR {
  pullRequestId: number;
  title: string;
  repoName: string;
  creationDate: string;
}

export interface GapAuthor {
  uniqueName: string;
  displayName: string;
  prCount: number;
  possibleMatch: boolean;
  possibleMatchName: string | null;
  prs: GapAuthorPR[];
}

export interface TeamValidatorResponse {
  rosterMembers: RosterMemberResult[];
  gapAuthors: GapAuthor[];
  summary: {
    rosterSize: number;
    matchedInPRData: number;
    gapAuthorCount: number;
    possibleMismatches: number;
  };
  teamRepos: string[];
}
