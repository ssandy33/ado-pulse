"use client";

import type { RepoSummary } from "@/lib/ado/types";
import { SectionCard, DataTable, type DataTableColumn } from "./ui";

interface RepoTableProps {
  repos: RepoSummary[];
}

function truncateContributors(contributors: string[], max = 3): string {
  const shown = contributors.slice(0, max).join(", ");
  const remaining = contributors.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

const COLUMNS: DataTableColumn[] = [
  { header: "Repository" },
  { header: "PRs Merged", align: "right" },
  { header: "Contributors" },
];

export function RepoTable({ repos }: RepoTableProps) {
  return (
    <SectionCard title="PRs by Repository">
      <DataTable columns={COLUMNS}>
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
      </DataTable>
    </SectionCard>
  );
}
