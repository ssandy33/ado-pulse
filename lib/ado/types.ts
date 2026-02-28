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
  isExcluded: boolean;
  role: string | null;
  prs: ValidatorMemberPR[];
}

// ── Settings types ──────────────────────────────────────────────

export interface MemberRoleExclusion {
  uniqueName: string;
  displayName: string;
  role: string;
  excludeFromMetrics: boolean;
  addedAt: string;
}

export interface MemberProfile {
  adoId: string;
  displayName: string;
  email: string;
  employmentType: 'fte' | 'contractor';
  agency: string;
}

export interface SevenPaceIntegration {
  apiToken: string;
  baseUrl: string;
}

export interface AdoIntegration {
  pat: string;
  orgUrl: string;
}

export interface SettingsData {
  memberRoles?: { exclusions: MemberRoleExclusion[] };
  memberProfiles?: { profiles: MemberProfile[] };
  teamVisibility?: { pinnedTeams: string[] };
  integrations?: { sevenPace?: SevenPaceIntegration; ado?: AdoIntegration };
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
  authorUniqueName: string;
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

export interface DiagnosticRosterMember {
  uniqueName: string;
  displayName: string;
  matchedPRCount: number;
  foundInProjectPRs: boolean;
}

export interface DataDiagnostics {
  period: { days: number; from: string; to: string; label: string };
  apiLimitHit: boolean;
  totalProjectPRs: number;
  rosterMembers: DiagnosticRosterMember[];
  summary: {
    totalRosterMembers: number;
    membersWithPRs: number;
    membersNotFound: number;
    membersFoundButZero: number;
  };
  confidence: "high" | "medium" | "low" | "zero";
}

export interface TeamSummaryApiResponse {
  period: {
    days: number;
    from: string;
    to: string;
    label: string;
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

export interface ValidatorMemberPR {
  pullRequestId: number;
  title: string;
  repoName: string;
  creationDate: string;
  url: string;
}

export interface ValidatorRosterMember {
  uniqueName: string;
  displayName: string;
  foundInProjectPRs: boolean;
  matchedPRCount: number;
  prs: ValidatorMemberPR[];
}

export interface TeamValidatorResponse {
  period: { days: number; from: string; to: string; label: string };
  team: { name: string; totalMembers: number };
  apiLimitHit: boolean;
  totalProjectPRs: number;
  rosterMembers: ValidatorRosterMember[];
}

// ── PR Alignment types ────────────────────────────────────────
export interface AlignmentPR {
  pullRequestId: number;
  title: string;
  author: string;
  authorUniqueName: string;
  repoName: string;
  mergedDate: string;
  workItem: { id: number; title: string; areaPath: string } | null;
  url: string;
}

export interface TeamAlignment {
  total: number;
  aligned: number;
  outOfScope: number;
  unlinked: number;
  alignedPct: number;
  teamAreaPath: string;
}

export interface MemberAlignmentDetail {
  aligned: number;
  outOfScope: {
    count: number;
    byAreaPath: { areaPath: string; count: number }[];
  };
  unlinked: number;
  total: number;
}

export interface AlignmentApiResponse {
  period: { days: number; from: string; to: string; label: string };
  teamAreaPath: string;
  alignment: TeamAlignment;
  members: {
    uniqueName: string;
    displayName: string;
    alignment: MemberAlignmentDetail;
  }[];
  categorizedPRs: {
    aligned: AlignmentPR[];
    outOfScope: AlignmentPR[];
    unlinked: AlignmentPR[];
  };
}

// ── Time Tracking types ───────────────────────────────────────

export type ExpenseType = "CapEx" | "OpEx" | "Unclassified";

export interface FeatureTimeBreakdown {
  featureId: number | null;
  featureTitle: string;
  expenseType: ExpenseType;
  hours: number;
  loggedAtWrongLevel: boolean;
  originalWorkItemId?: number;
  originalWorkItemType?: string;
}

export interface MemberTimeEntry {
  displayName: string;
  uniqueName: string;
  totalHours: number;
  capExHours: number;
  opExHours: number;
  unclassifiedHours: number;
  wrongLevelHours: number;
  wrongLevelCount: number;
  isExcluded: boolean;
  role: string | null;
  features: FeatureTimeBreakdown[];
}

export interface WrongLevelEntry {
  workItemId: number;
  title: string;
  workItemType: string;
  memberName: string;
  hours: number;
  resolvedFeatureId?: number;
  resolvedFeatureTitle?: string;
}

export interface TimeTrackingDiagnostics {
  sevenPaceUsersTotal: number;
  sevenPaceUsers: { id: string; uniqueName: string }[];
  fetchMode: string;
  fetchApi: "odata" | "rest";
  membersFetched: number;
  membersWithNoSpId: string[];
  totalWorklogsFromSevenPace: number;
  worklogsMatchedToTeam: number;
  rosterUniqueNames: string[];
  sampleWorklogs: {
    userId: string;
    resolvedUniqueName: string | null;
    workItemId: number;
    hours: number;
  }[];
  pagination?: {
    totalPagesFetched: number;
    totalRecordsFetched: number;
    anyMemberHitCap: boolean;
  };
}

export interface GovernanceData {
  expectedHours: number;
  businessDays: number;
  hoursPerDay: number;
  activeMembers: number;
  compliancePct: number;
  isCompliant: boolean;
}

export interface TeamTimeData {
  period: { days: number; from: string; to: string; label: string };
  team: { name: string; totalMembers: number };
  summary: {
    totalHours: number;
    capExHours: number;
    opExHours: number;
    unclassifiedHours: number;
    membersLogging: number;
    membersNotLogging: number;
    wrongLevelCount: number;
  };
  members: MemberTimeEntry[];
  wrongLevelEntries: WrongLevelEntry[];
  sevenPaceConnected: boolean;
  governance?: GovernanceData;
  diagnostics?: TimeTrackingDiagnostics;
}
