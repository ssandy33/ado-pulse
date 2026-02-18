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
    <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-pulse-border">
        <h2 className="text-xs font-mono uppercase tracking-wider text-pulse-muted">
          PRs by Repository
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pulse-border text-left">
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium">
                Repository
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium text-right">
                PRs Merged
              </th>
              <th className="px-4 py-2 font-mono text-xs text-pulse-muted font-medium">
                Contributors
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pulse-border">
            {repos.map((repo) => (
              <tr key={repo.repoName} className="hover:bg-pulse-border/20">
                <td className="px-4 py-2 font-mono text-pulse-text">
                  {repo.repoName}
                </td>
                <td className="px-4 py-2 font-mono text-pulse-text text-right">
                  {repo.totalPRs}
                </td>
                <td className="px-4 py-2 text-xs text-pulse-muted">
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
