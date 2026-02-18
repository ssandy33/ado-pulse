"use client";

import type { MemberSummary } from "@/lib/ado/types";

interface MemberTableProps {
  members: MemberSummary[];
  teamName: string;
}

type StatusKind = "active" | "low-reviews" | "reviewing" | "inactive";

function getStatus(member: MemberSummary): StatusKind {
  if (member.prCount > 0 && !member.reviewFlagged) return "active";
  if (member.prCount > 0 && member.reviewFlagged) return "low-reviews";
  if (member.prCount === 0 && member.reviewsGiven > 0) return "reviewing";
  return "inactive";
}

const STATUS_CONFIG: Record<
  StatusKind,
  { label: string; dot: string; text: string; bg: string; ring: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-500/20",
  },
  "low-reviews": {
    label: "Low reviews",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-500/20",
  },
  reviewing: {
    label: "Reviewing",
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-500/20",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-gray-400",
    text: "text-gray-500",
    bg: "bg-gray-50",
    ring: "ring-gray-400/20",
  },
};

function StatusBadge({ status }: { status: StatusKind }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

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

export function MemberTable({ members, teamName }: MemberTableProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-pulse-border flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-pulse-text">
          Developer Breakdown
        </h2>
        <span className="text-[12px] text-pulse-dim">{teamName}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pulse-border bg-pulse-bg/50">
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Developer
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                PRs
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Repos Touched
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Last PR
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Reviews
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pulse-border">
            {members.map((member) => {
              const status = getStatus(member);
              return (
                <tr
                  key={member.id}
                  className="hover:bg-pulse-hover transition-colors"
                >
                  <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
                    {member.displayName}
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
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-pulse-border flex items-center gap-4">
        {(["active", "low-reviews", "reviewing", "inactive"] as StatusKind[]).map(
          (s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dot}`}
              />
              <span className="text-[11px] text-pulse-dim">
                {STATUS_CONFIG[s].label}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
