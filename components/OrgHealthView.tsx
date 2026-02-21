"use client";

import { useState, useEffect, useCallback } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type {
  UnmatchedAuthorsResponse,
  PolicyComplianceResponse,
  UsersNoTeamResponse,
  GhostMembersResponse,
} from "@/lib/ado/types";
import { KPICard } from "./KPICard";
import { UnmatchedAuthorsTable } from "./UnmatchedAuthorsTable";
import { PolicyComplianceTable } from "./PolicyComplianceTable";
import { UsersNoTeamTable } from "./UsersNoTeamTable";
import { GhostMembersTable } from "./GhostMembersTable";
import { TeamValidator } from "./TeamValidator";
import { SkeletonKPIRow, SkeletonTable } from "./SkeletonLoader";
import { StatusDot } from "./ui";

interface OrgHealthViewProps {
  adoHeaders: Record<string, string>;
  range: TimeRange;
  validatorTeam?: string;
}

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useOrgFetch<T>(
  url: string,
  adoHeaders: Record<string, string>,
  range: TimeRange
) {
  const [state, setState] = useState<SectionState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(() => {
    setState({ data: null, loading: true, error: null });
    fetch(`${url}?range=${range}`, { headers: adoHeaders })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json: T) => setState({ data: json, loading: false, error: null }))
      .catch((err) =>
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        })
      );
  }, [url, adoHeaders, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, retry: fetchData };
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 text-center">
      <p className="text-[13px] text-pulse-muted mb-2">{message}</p>
      <button
        onClick={onRetry}
        className="text-[12px] font-medium text-pulse-accent hover:underline cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

export function OrgHealthView({ adoHeaders, range, validatorTeam }: OrgHealthViewProps) {
  const unmatched = useOrgFetch<UnmatchedAuthorsResponse>(
    "/api/org-health/unmatched-authors",
    adoHeaders,
    range
  );
  const compliance = useOrgFetch<PolicyComplianceResponse>(
    "/api/org-health/policy-compliance",
    adoHeaders,
    range
  );
  const noTeam = useOrgFetch<UsersNoTeamResponse>(
    "/api/org-health/users-no-team",
    adoHeaders,
    range
  );
  const ghosts = useOrgFetch<GhostMembersResponse>(
    "/api/org-health/ghost-members",
    adoHeaders,
    range
  );

  const anyKPILoading =
    unmatched.loading || compliance.loading || noTeam.loading || ghosts.loading;

  return (
    <>
      {/* KPI Row */}
      {anyKPILoading && <SkeletonKPIRow />}
      {!anyKPILoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Unmatched Authors"
            value={unmatched.data?.authors.length ?? 0}
            subtitle={
              (unmatched.data?.authors.length ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="danger" />
                  <span>{unmatched.data!.authors.length} unresolved</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="success" />
                  <span>none</span>
                </span>
              )
            }
          />
          <KPICard
            title="Policy Coverage"
            value={
              compliance.data
                ? `${compliance.data.compliant} / ${compliance.data.total}`
                : "\u2014"
            }
            subtitle="repos compliant"
          />
          <KPICard
            title="Unassigned Users"
            value={noTeam.data?.users.length ?? 0}
            subtitle={
              (noTeam.data?.users.length ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="danger" />
                  <span>{noTeam.data!.users.length} without team</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="success" />
                  <span>all assigned</span>
                </span>
              )
            }
          />
          <KPICard
            title="Ghost Members"
            value={ghosts.data?.members.length ?? 0}
            subtitle={
              (ghosts.data?.members.length ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="warning" />
                  <span>{ghosts.data!.members.length} inactive</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot variant="success" />
                  <span>all active</span>
                </span>
              )
            }
          />
        </div>
      )}

      {/* Unmatched Authors */}
      <div className="mb-6">
        {unmatched.loading && <SkeletonTable rows={3} />}
        {unmatched.error && (
          <SectionError message={unmatched.error} onRetry={unmatched.retry} />
        )}
        {unmatched.data && <UnmatchedAuthorsTable data={unmatched.data} />}
      </div>

      {/* Policy Compliance */}
      <div className="mb-6">
        {compliance.loading && <SkeletonTable rows={3} />}
        {compliance.error && (
          <SectionError message={compliance.error} onRetry={compliance.retry} />
        )}
        {compliance.data && <PolicyComplianceTable data={compliance.data} />}
      </div>

      {/* Users No Team */}
      <div className="mb-6">
        {noTeam.loading && <SkeletonTable rows={3} />}
        {noTeam.error && (
          <SectionError message={noTeam.error} onRetry={noTeam.retry} />
        )}
        {noTeam.data && <UsersNoTeamTable data={noTeam.data} />}
      </div>

      {/* Ghost Members */}
      <div className="mb-6">
        {ghosts.loading && <SkeletonTable rows={3} />}
        {ghosts.error && (
          <SectionError message={ghosts.error} onRetry={ghosts.retry} />
        )}
        {ghosts.data && <GhostMembersTable data={ghosts.data} />}
      </div>

      {/* Team Validator */}
      <TeamValidator
        adoHeaders={adoHeaders}
        range={range}
        preSelectedTeam={validatorTeam}
      />
    </>
  );
}
