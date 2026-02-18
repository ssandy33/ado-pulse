"use client";

import type { GhostMembersResponse } from "@/lib/ado/types";
import {
  StatusBadge,
  SectionCard,
  DataTable,
  type DataTableColumn,
} from "./ui";

interface GhostMembersTableProps {
  data: GhostMembersResponse;
}

const COLUMNS: DataTableColumn[] = [
  { header: "Member" },
  { header: "Team" },
  { header: "Last PR" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GhostMembersTable({ data }: GhostMembersTableProps) {
  return (
    <SectionCard
      title="Ghost Members"
      subtitle="Team members with no PR activity in the selected time range"
    >
      <DataTable columns={COLUMNS}>
        {data.members.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px]"
            >
              <StatusBadge variant="success" label="All team members have recent PR activity" />
            </td>
          </tr>
        ) : (
          data.members.map((member) => (
            <tr
              key={`${member.displayName}-${member.teamName}`}
              className="hover:bg-pulse-hover transition-colors"
            >
              <td className="px-5 py-3 text-[13px] font-medium text-pulse-text">
                {member.displayName}
              </td>
              <td className="px-5 py-3 text-[12px] text-pulse-muted">
                {member.teamName}
              </td>
              <td className="px-5 py-3 font-mono text-[12px] text-pulse-muted tabular-nums">
                {formatDate(member.lastPRDate)}
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </SectionCard>
  );
}
