"use client";

import type { UsersNoTeamResponse } from "@/lib/ado/types";
import {
  StatusBadge,
  SectionCard,
  DataTable,
  type DataTableColumn,
} from "./ui";

interface UsersNoTeamTableProps {
  data: UsersNoTeamResponse;
}

const COLUMNS: DataTableColumn[] = [
  { header: "User" },
  { header: "PRs", align: "right" },
  { header: "Repos" },
  { header: "Last PR" },
];

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

export function UsersNoTeamTable({ data }: UsersNoTeamTableProps) {
  return (
    <SectionCard
      title="Unassigned PR Authors"
      subtitle="Active contributors not assigned to any ADO team"
    >
      <DataTable columns={COLUMNS}>
        {data.users.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px]"
            >
              <StatusBadge variant="success" label="All active PR authors belong to a team" />
            </td>
          </tr>
        ) : (
          data.users.map((user) => (
            <tr
              key={user.displayName}
              className="hover:bg-pulse-hover transition-colors"
            >
              <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
                {user.displayName}
              </td>
              <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
                {user.prCount}
              </td>
              <td className="px-5 py-3 text-[12px] text-pulse-muted">
                {truncateRepos(user.repos)}
              </td>
              <td className="px-5 py-3 font-mono text-[12px] text-pulse-muted tabular-nums">
                {formatDate(user.lastPRDate)}
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </SectionCard>
  );
}
