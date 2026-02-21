"use client";

import type { MemberSummary } from "@/lib/ado/types";
import {
  StatusDot,
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";
import { EmailTooltip } from "./EmailTooltip";

interface MemberTableProps {
  members: MemberSummary[];
  teamName: string;
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

export function MemberTable({ members, teamName }: MemberTableProps) {
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
          return (
            <tr
              key={member.id}
              className={`hover:bg-pulse-hover transition-colors ${member.isExcluded ? "opacity-50" : ""}`}
            >
              <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
                <EmailTooltip
                  displayName={member.displayName}
                  email={member.uniqueName}
                />
                {member.role && (
                  <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 ring-1 ring-gray-200">
                    {member.role}
                  </span>
                )}
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
          );
        })}
      </DataTable>
    </SectionCard>
  );
}
