"use client";

import type { StalePRResponse, Staleness } from "@/lib/ado/types";
import {
  StatusDot,
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";

interface StalePRTableProps {
  data: StalePRResponse;
}

const STALENESS_VARIANT: Record<Staleness, StatusVariant> = {
  fresh: "success",
  aging: "warning",
  stale: "danger",
};

const STALENESS_LABEL: Record<Staleness, string> = {
  fresh: "Fresh",
  aging: "Aging",
  stale: "Stale",
};

const AGE_COLOR: Record<Staleness, string> = {
  fresh: "text-pulse-text",
  aging: "text-amber-600",
  stale: "text-red-600",
};

const COLUMNS: DataTableColumn[] = [
  { header: "PR Title" },
  { header: "Author" },
  { header: "Repo" },
  { header: "Age", align: "right" },
  { header: "Status" },
];

const LEGEND: Staleness[] = ["fresh", "aging", "stale"];
const LEGEND_LABELS: Record<Staleness, string> = {
  fresh: "Fresh (0-2d)",
  aging: "Aging (3-6d)",
  stale: "Stale (7d+)",
};

export function StalePRTable({ data }: StalePRTableProps) {
  return (
    <SectionCard
      title="Open PRs"
      headerRight={
        <span className="text-[12px] text-pulse-dim">
          {data.summary.total} open total
        </span>
      }
      footer={
        <div className="flex items-center gap-4">
          {LEGEND.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <StatusDot variant={STALENESS_VARIANT[s]} />
              <span className="text-[11px] text-pulse-dim">
                {LEGEND_LABELS[s]}
              </span>
            </div>
          ))}
        </div>
      }
    >
      <DataTable columns={COLUMNS}>
        {data.prs.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px] text-pulse-muted"
            >
              No open PRs — nice work!
            </td>
          </tr>
        ) : (
          data.prs.map((pr) => (
            <tr
              key={pr.id}
              className="hover:bg-pulse-hover transition-colors"
            >
              <td className="px-5 py-3 text-[13px] font-medium text-pulse-text max-w-[280px] truncate">
                {pr.title}
              </td>
              <td className="px-5 py-3 text-[12px] text-pulse-muted">
                {pr.author}
              </td>
              <td className="px-5 py-3 font-mono text-[12px] text-pulse-muted">
                {pr.repoName}
              </td>
              <td
                className={`px-5 py-3 font-mono text-[13px] tabular-nums text-right ${AGE_COLOR[pr.staleness]}`}
              >
                {pr.ageInDays}d
              </td>
              <td className="px-5 py-3">
                <StatusBadge
                  variant={STALENESS_VARIANT[pr.staleness]}
                  label={STALENESS_LABEL[pr.staleness]}
                />
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </SectionCard>
  );
}
