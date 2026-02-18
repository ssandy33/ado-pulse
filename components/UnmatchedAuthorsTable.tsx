"use client";

import type { UnmatchedAuthorsResponse } from "@/lib/ado/types";
import {
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";

interface UnmatchedAuthorsTableProps {
  data: UnmatchedAuthorsResponse;
}

const TYPE_VARIANT: Record<string, StatusVariant> = {
  service: "neutral",
  external: "warning",
  unknown: "danger",
};

const TYPE_LABEL: Record<string, string> = {
  service: "Service",
  external: "External",
  unknown: "Unknown",
};

const COLUMNS: DataTableColumn[] = [
  { header: "Identity" },
  { header: "PRs", align: "right" },
  { header: "Repos" },
  { header: "Type" },
];

function truncateRepos(repos: string[], max = 3): string {
  if (repos.length === 0) return "—";
  const shown = repos.slice(0, max).join(", ");
  const remaining = repos.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

export function UnmatchedAuthorsTable({ data }: UnmatchedAuthorsTableProps) {
  return (
    <SectionCard
      title="Unmatched PR Authors"
      subtitle="Authors who submitted PRs but don't resolve to any ADO team"
    >
      <DataTable columns={COLUMNS}>
        {data.authors.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px]"
            >
              <StatusBadge variant="success" label="All PR authors resolved to ADO teams" />
            </td>
          </tr>
        ) : (
          data.authors.map((author) => (
            <tr
              key={author.identity}
              className="hover:bg-pulse-hover transition-colors"
            >
              <td className="px-5 py-3 font-mono text-[13px] font-medium text-pulse-text">
                {author.identity}
              </td>
              <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
                {author.prCount}
              </td>
              <td className="px-5 py-3 text-[12px] text-pulse-muted">
                {truncateRepos(author.repos)}
              </td>
              <td className="px-5 py-3">
                <StatusBadge
                  variant={TYPE_VARIANT[author.type]}
                  label={TYPE_LABEL[author.type]}
                />
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </SectionCard>
  );
}
