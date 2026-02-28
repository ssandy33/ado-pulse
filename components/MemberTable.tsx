"use client";

import { useState, useEffect, useMemo } from "react";
import type { MemberSummary, AlignmentApiResponse, MemberAlignmentDetail, ValidatorMemberPR, MemberProfile } from "@/lib/ado/types";
import { AgencyFilterDropdown } from "@/components/AgencyFilterDropdown";
import {
  StatusDot,
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "@/components/ui";
import { EmailTooltip } from "@/components/EmailTooltip";

interface MemberTableProps {
  members: MemberSummary[];
  teamName: string;
  alignmentData?: AlignmentApiResponse | null;
  agencyLookup?: Map<string, MemberProfile>;
  agencyFilter?: Set<string>;
  onAgencyFilterChange?: (filter: Set<string>) => void;
}

type StatusKind = "active" | "low-reviews" | "reviewing" | "inactive" | "non-contributor";

function getStatus(member: MemberSummary): StatusKind {
  if (member.isExcluded) return "non-contributor";
  if (member.prCount > 0 && !member.reviewFlagged) return "active";
  if (member.prCount > 0 && member.reviewFlagged) return "low-reviews";
  if (member.prCount === 0 && member.reviewsGiven > 0) return "reviewing";
  return "inactive";
}

const STATUS_VARIANT: Record<StatusKind, StatusVariant> = {
  active: "success",
  "low-reviews": "warning",
  reviewing: "info",
  inactive: "neutral",
  "non-contributor": "neutral",
};

const STATUS_LABEL: Record<StatusKind, string> = {
  active: "Active",
  "low-reviews": "Low reviews",
  reviewing: "Reviewing",
  inactive: "Inactive",
  "non-contributor": "Non-contributor",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncateRepos(repos: string[], max = 3): string {
  if (repos.length === 0) return "\u2014";
  const shown = repos.slice(0, max).join(", ");
  const remaining = repos.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

const COLUMNS: DataTableColumn[] = [
  { header: "Developer" },
  { header: "PRs", align: "right" },
  { header: "Repos Touched" },
  { header: "Last PR" },
  { header: "Reviews", align: "right" },
  { header: "Status" },
];

const ALL_STATUSES: StatusKind[] = ["active", "low-reviews", "reviewing", "inactive", "non-contributor"];

function AlignmentExpandedRow({ alignment }: { alignment: MemberAlignmentDetail }) {
  if (alignment.total === 0) return null;

  if (alignment.aligned === alignment.total) {
    return (
      <tr>
        <td colSpan={COLUMNS.length} className="px-0 py-0">
          <div className="bg-pulse-bg/50 px-8 py-3">
            <span className="text-[12px] text-emerald-600">
              All {alignment.total} PRs aligned to team area
            </span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={COLUMNS.length} className="px-0 py-0">
        <div className="bg-pulse-bg/50 px-8 py-2">
          <table className="w-full text-[11px]">
            <tbody>
              <tr className="border-b border-pulse-border/30">
                <td className="px-2 py-1.5 text-emerald-600 font-medium w-28">Aligned</td>
                <td className="px-2 py-1.5 text-pulse-text font-mono w-12 text-right">{alignment.aligned}</td>
                <td className="px-2 py-1.5 text-pulse-muted">team area path</td>
              </tr>
              {alignment.outOfScope.count > 0 && (
                <tr className="border-b border-pulse-border/30">
                  <td className="px-2 py-1.5 text-amber-600 font-medium">Out of scope</td>
                  <td className="px-2 py-1.5 text-pulse-text font-mono text-right">{alignment.outOfScope.count}</td>
                  <td className="px-2 py-1.5 text-pulse-muted">
                    {alignment.outOfScope.byAreaPath
                      .map((ap) => `${ap.areaPath} (${ap.count})`)
                      .join(", ")}
                  </td>
                </tr>
              )}
              {alignment.unlinked > 0 && (
                <tr>
                  <td className="px-2 py-1.5 text-pulse-dim font-medium">Unlinked</td>
                  <td className="px-2 py-1.5 text-pulse-text font-mono text-right">{alignment.unlinked}</td>
                  <td className="px-2 py-1.5 text-pulse-muted">no linked work item</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function PRListExpandedRow({ prs }: { prs: ValidatorMemberPR[] }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className="px-0 py-0">
        <div className="bg-pulse-bg/50 px-8 py-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-pulse-border/30">
                <th className="px-2 py-1.5 text-left text-pulse-dim font-medium">Title</th>
                <th className="px-2 py-1.5 text-left text-pulse-dim font-medium">Repo</th>
                <th className="px-2 py-1.5 text-left text-pulse-dim font-medium">Date</th>
                <th className="px-2 py-1.5 text-right text-pulse-dim font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {prs.map((pr) => (
                <tr key={pr.pullRequestId} className="border-b border-pulse-border/30 last:border-b-0">
                  <td className="px-2 py-1.5 text-pulse-text max-w-[300px] truncate">
                    {pr.title}
                  </td>
                  <td className="px-2 py-1.5 text-pulse-muted font-mono">
                    {pr.repoName}
                  </td>
                  <td className="px-2 py-1.5 text-pulse-muted font-mono tabular-nums">
                    {formatDate(pr.creationDate)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open pull request in new tab`}
                      className="text-pulse-muted hover:text-pulse-text"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export function MemberTable({ members, teamName, alignmentData, agencyLookup, agencyFilter: agencyFilterProp, onAgencyFilterChange }: MemberTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localAgencyFilter, setLocalAgencyFilter] = useState<Set<string>>(new Set());

  // Use prop-driven filter when available, fall back to local state
  const agencyFilter = agencyFilterProp ?? localAgencyFilter;
  const setAgencyFilter = onAgencyFilterChange ?? setLocalAgencyFilter;

  // Reset local filter when team changes (only for uncontrolled mode)
  useEffect(() => {
    if (!onAgencyFilterChange) {
      setLocalAgencyFilter(new Set());
    }
  }, [teamName, onAgencyFilterChange]);

  // Build alignment lookup by uniqueName (case-insensitive)
  const alignmentMap = new Map<string, MemberAlignmentDetail>();
  if (alignmentData) {
    for (const m of alignmentData.members) {
      alignmentMap.set(m.uniqueName.toLowerCase(), m.alignment);
    }
  }

  // Sort: non-excluded first, then excluded at bottom
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isExcluded !== b.isExcluded) return a.isExcluded ? 1 : -1;
    return 0; // preserve server sort within groups
  });

  const hasAnyProfiles = agencyLookup && agencyLookup.size > 0;

  const availableAgencies = useMemo(() => {
    if (!agencyLookup) return [];
    const map = new Map<string, { employmentType: "fte" | "contractor" | null; count: number }>();
    for (const member of sortedMembers) {
      const profile = agencyLookup.get(member.id);
      if (!profile) continue;
      const existing = map.get(profile.agency);
      if (existing) existing.count++;
      else map.set(profile.agency, { employmentType: profile.employmentType, count: 1 });
    }
    return [...map.entries()]
      .map(([label, { employmentType, count }]) => ({ label, employmentType, count }))
      .sort((a, b) => {
        if (a.employmentType === "fte" && b.employmentType !== "fte") return -1;
        if (b.employmentType === "fte" && a.employmentType !== "fte") return 1;
        return a.label.localeCompare(b.label);
      });
  }, [sortedMembers, agencyLookup]);

  const filteredMembers = useMemo(() => {
    if (agencyFilter.size === 0) return sortedMembers;
    return sortedMembers.filter((member) => {
      const profile = agencyLookup?.get(member.id);
      if (!profile) return false;
      return agencyFilter.has(profile.agency);
    });
  }, [sortedMembers, agencyLookup, agencyFilter]);

  function renderMemberRow(member: MemberSummary) {
    const status = getStatus(member);
    const memberAlignment = alignmentMap.get(member.uniqueName.toLowerCase());
    const hasAlignment = memberAlignment && memberAlignment.total > 0;
    const isExpanded = expandedId === member.id;

    return (
      <MemberRow
        key={member.id}
        member={member}
        status={status}
        alignment={hasAlignment ? memberAlignment : undefined}
        profile={agencyLookup?.get(member.id)}
        isExpanded={isExpanded}
        onToggle={() =>
          setExpandedId((prev) => (prev === member.id ? null : member.id))
        }
      />
    );
  }

  return (
    <SectionCard
      title="Developer Breakdown"
      headerRight={
        <div className="flex items-center gap-3 relative">
          <AgencyFilterDropdown
            agencies={availableAgencies}
            selected={agencyFilter}
            onChange={setAgencyFilter}
            disabled={!hasAnyProfiles}
          />
          <span className="text-[12px] text-pulse-dim">{teamName}</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-4">
          {ALL_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <StatusDot variant={STATUS_VARIANT[s]} />
              <span className="text-[11px] text-pulse-dim">
                {STATUS_LABEL[s]}
              </span>
            </div>
          ))}
        </div>
      }
    >
      <DataTable columns={COLUMNS}>
        {filteredMembers.map(renderMemberRow)}
      </DataTable>
    </SectionCard>
  );
}


function MemberRow({
  member,
  status,
  alignment,
  profile,
  isExpanded,
  onToggle,
}: {
  member: MemberSummary;
  status: StatusKind;
  alignment?: MemberAlignmentDetail;
  profile?: MemberProfile;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasExpandable = !!alignment || member.prs.length > 0;

  return (
    <>
      <tr
        className={`hover:bg-pulse-hover transition-colors ${
          member.isExcluded ? "opacity-50" : ""
        } ${hasExpandable ? "cursor-pointer" : ""}`}
        onClick={() => hasExpandable && onToggle()}
      >
        <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
          <div className="flex items-center gap-1.5">
            {hasExpandable && (
              <button
                type="button"
                className="p-0 bg-transparent border-0 flex-shrink-0"
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                aria-expanded={isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <svg
                  className={`w-3 h-3 text-pulse-muted transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <div>
              <EmailTooltip
                displayName={member.displayName}
                email={member.uniqueName}
              />
              {member.role && (
                <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 ring-1 ring-gray-200">
                  {member.role}
                </span>
              )}
              {profile && (
                <span
                  data-testid="agency-badge"
                  className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${
                    profile.employmentType === "fte"
                      ? "bg-blue-50 text-blue-600 ring-blue-200"
                      : "bg-amber-50 text-amber-600 ring-amber-200"
                  }`}
                >
                  {profile.agency}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
          {member.prCount}
        </td>
        <td className="px-5 py-3 text-[12px] text-pulse-muted">
          {truncateRepos(member.repos)}
        </td>
        <td className="px-5 py-3 font-mono text-[12px] text-pulse-muted tabular-nums">
          {formatDate(member.lastPRDate)}
        </td>
        <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
          {member.reviewsGiven}
          {member.reviewFlagged && (
            <StatusDot variant="warning" className="ml-1.5 align-middle" />
          )}
        </td>
        <td className="px-5 py-3">
          <StatusBadge
            variant={STATUS_VARIANT[status]}
            label={STATUS_LABEL[status]}
          />
        </td>
      </tr>
      {isExpanded && alignment && (
        <AlignmentExpandedRow alignment={alignment} />
      )}
      {isExpanded && member.prs.length > 0 && (
        <PRListExpandedRow prs={member.prs} />
      )}
    </>
  );
}
