"use client";

import { useState } from "react";
import type { AlignmentApiResponse, AlignmentPR } from "@/lib/ado/types";
import { DataTable, type DataTableColumn } from "./ui";

type AlignmentCategory = "aligned" | "outOfScope" | "unlinked";

interface AlignmentKPITileProps {
  data: AlignmentApiResponse;
}

const CATEGORY_LABEL: Record<AlignmentCategory, string> = {
  aligned: "Aligned PRs",
  outOfScope: "Out-of-Scope PRs",
  unlinked: "Unlinked PRs",
};

const COLUMNS: DataTableColumn[] = [
  { header: "PR Title" },
  { header: "Author" },
  { header: "Repo" },
  { header: "Merged" },
  { header: "Work Item" },
  { header: "", align: "right" },
];

function formatRelativeDate(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

function DrillDownPanel({
  category,
  prs,
}: {
  category: AlignmentCategory;
  prs: AlignmentPR[];
}) {
  return (
    <div className="border-t border-pulse-border mt-4 pt-4">
      <p className="text-[12px] font-medium text-pulse-muted mb-2">
        {CATEGORY_LABEL[category]} ({prs.length})
      </p>
      <DataTable columns={COLUMNS}>
        {prs.map((pr) => (
          <tr
            key={pr.pullRequestId}
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
            <td className="px-5 py-3 text-[12px] text-pulse-muted tabular-nums">
              {formatRelativeDate(pr.mergedDate)}
            </td>
            <td className="px-5 py-3 text-[12px]">
              {pr.workItem ? (
                <span className="text-pulse-muted">
                  {pr.workItem.title || `#${pr.workItem.id}`}
                  {category === "outOfScope" && (
                    <span className="block text-[11px] text-pulse-dim">
                      {pr.workItem.areaPath}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-red-500">— No work item</span>
              )}
            </td>
            <td className="px-5 py-3 text-right">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pulse-accent hover:underline"
              >
                &#8599;
              </a>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

export function AlignmentKPITile({ data }: AlignmentKPITileProps) {
  const [activeCategory, setActiveCategory] =
    useState<AlignmentCategory | null>(null);
  const { alignment, categorizedPRs } = data;

  const pctColor =
    alignment.alignedPct >= 80
      ? "text-emerald-600"
      : alignment.alignedPct >= 50
      ? "text-amber-600"
      : "text-red-600";

  function toggleCategory(cat: AlignmentCategory) {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  }

  const countButton = (
    count: number,
    cat: AlignmentCategory,
    color: string
  ) => {
    const isActive = activeCategory === cat;
    if (count === 0) {
      return (
        <span className="text-pulse-dim/50 font-medium">{count}</span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => toggleCategory(cat)}
        aria-expanded={isActive}
        className={`${color} font-medium cursor-pointer hover:underline`}
      >
        {count}
      </button>
    );
  };

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm mb-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-pulse-muted mb-3">
        PR Alignment
      </p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`font-mono text-[28px] font-semibold leading-none ${pctColor}`}>
          {alignment.alignedPct}%
        </span>
        <span className="text-[13px] text-pulse-muted">
          {countButton(alignment.aligned, "aligned", "text-emerald-600")} aligned
          <span className="mx-1.5 text-pulse-dim">&middot;</span>
          {countButton(alignment.outOfScope, "outOfScope", "text-amber-600")} out of scope
          <span className="mx-1.5 text-pulse-dim">&middot;</span>
          {countButton(alignment.unlinked, "unlinked", "text-pulse-dim")} unlinked
        </span>
      </div>
      <p className="text-[13px] text-pulse-dim mt-2">{data.period.label}</p>

      {activeCategory && categorizedPRs[activeCategory].length > 0 && (
        <DrillDownPanel
          category={activeCategory}
          prs={categorizedPRs[activeCategory]}
        />
      )}
    </div>
  );
}
