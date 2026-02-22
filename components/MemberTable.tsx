"use client";

import { useState } from "react";
import type { MemberSummary, AlignmentApiResponse, MemberAlignmentDetail } from "@/lib/ado/types";
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

export function MemberTable({ members, teamName, alignmentData }: MemberTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <SectionCard
      title="Developer Breakdown"
      headerRight={
        <span className="text-[12px] text-pulse-dim">{teamName}</span>
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
        {sortedMembers.map((member) => {
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
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedId((prev) => (prev === member.id ? null : member.id))
              }
            />
          );
        })}
      </DataTable>
    </SectionCard>
  );
}

function MemberRow({
  member,
  status,
  alignment,
  isExpanded,
  onToggle,
}: {
  member: MemberSummary;
  status: StatusKind;
  alignment?: MemberAlignmentDetail;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`hover:bg-pulse-hover transition-colors ${
          member.isExcluded ? "opacity-50" : ""
        } ${alignment ? "cursor-pointer" : ""}`}
        onClick={() => alignment && onToggle()}
      >
        <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
          <div className="flex items-center gap-1.5">
            {alignment && (
              <button
                type="button"
                className="p-0 bg-transparent border-0 flex-shrink-0"
                aria-label={isExpanded ? "Collapse alignment details" : "Expand alignment details"}
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
    </>
  );
}
