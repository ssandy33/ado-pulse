"use client";

import type { MemberSummary } from "@/lib/ado/types";

interface MemberTableProps {
  members: MemberSummary[];
  teamName: string;
}

function getStatusIcon(member: MemberSummary): { icon: string; label: string } {
  if (member.prCount > 0 && !member.reviewFlagged) {
    return { icon: "✅", label: "active" };
  }
  if (member.prCount > 0 && member.reviewFlagged) {
    return { icon: "🟡", label: "low reviews" };
  }
  if (member.prCount === 0 && member.reviewsGiven > 0) {
    return { icon: "👁️", label: "reviewing only" };
  }
  return { icon: "👻", label: "no activity" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncateRepos(repos: string[], max = 3): string {
  if (repos.length === 0) return "—";
  const shown = repos.slice(0, max).join(", ");
  const remaining = repos.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

export function MemberTable({ members, teamName }: MemberTableProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-pulse-border flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-pulse-muted">
          Developer Breakdown
        </h2>
        <span className="text-xs font-mono text-pulse-muted">{teamName}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pulse-border text-left">
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium">
                Dev
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium text-right">
                PRs
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium">
                Repos Touched
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium">
                Last PR
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium text-right">
                Reviews
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pulse-border">
            {members.map((member) => {
              const status = getStatusIcon(member);
              return (
                <tr key={member.id} className="hover:bg-pulse-border/20">
                  <td className="px-4 py-2 text-pulse-text">
                    {member.displayName}
                  </td>
                  <td className="px-4 py-2 font-mono text-pulse-text text-right">
                    {member.prCount}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-pulse-muted">
                    {truncateRepos(member.repos)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-pulse-muted">
                    {formatDate(member.lastPRDate)}
                  </td>
                  <td className="px-4 py-2 font-mono text-pulse-text text-right">
                    {member.reviewsGiven}
                    {member.reviewFlagged && " ⚠️"}
                  </td>
                  <td className="px-4 py-2 text-center" title={status.label}>
                    {status.icon}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-pulse-border text-xs text-pulse-muted font-mono">
        ✅ active &nbsp; 🟡 low reviews &nbsp; 👁️ reviewing only &nbsp; 👻 no
        activity
      </div>
    </div>
  );
}
