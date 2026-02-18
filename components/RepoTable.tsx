"use client";

import type { RepoSummary } from "@/lib/ado/types";

interface RepoTableProps {
  repos: RepoSummary[];
}

function truncateContributors(contributors: string[], max = 3): string {
  const shown = contributors.slice(0, max).join(", ");
  const remaining = contributors.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

export function RepoTable({ repos }: RepoTableProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-pulse-border">
        <h2 className="text-[13px] font-semibold text-pulse-text">
          PRs by Repository
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pulse-border bg-pulse-bg/50">
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Repository
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                PRs Merged
              </th>
              <th className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                Contributors
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pulse-border">
            {repos.map((repo) => (
              <tr
                key={repo.repoName}
                className="hover:bg-pulse-hover transition-colors"
              >
                <td className="px-5 py-3 font-mono text-[13px] font-medium text-pulse-text">
                  {repo.repoName}
                </td>
                <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
                  {repo.totalPRs}
                </td>
                <td className="px-5 py-3 text-[12px] text-pulse-muted">
                  {truncateContributors(repo.contributors)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
