"use client";

import type { AlignmentApiResponse } from "@/lib/ado/types";

interface AlignmentKPITileProps {
  data: AlignmentApiResponse;
}

/**
 * Renders a compact card that displays pull request alignment metrics and the reporting period.
 *
 * @param data - AlignmentApiResponse containing `alignment` (percentage and counts for aligned, out of scope, and unlinked) and `period` with a display `label`
 * @returns A JSX element showing the aligned percentage, counts for aligned/out-of-scope/unlinked, and the period label
 */
export function AlignmentKPITile({ data }: AlignmentKPITileProps) {
  const { alignment } = data;

  const pctColor =
    alignment.alignedPct >= 80
      ? "text-emerald-600"
      : alignment.alignedPct >= 50
      ? "text-amber-600"
      : "text-red-600";

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
          <span className="text-emerald-600 font-medium">{alignment.aligned}</span> aligned
          <span className="mx-1.5 text-pulse-dim">&middot;</span>
          <span className="text-amber-600 font-medium">{alignment.outOfScope}</span> out of scope
          <span className="mx-1.5 text-pulse-dim">&middot;</span>
          <span className="text-pulse-dim font-medium">{alignment.unlinked}</span> unlinked
        </span>
      </div>
      <p className="text-[13px] text-pulse-dim mt-2">{data.period.label}</p>
    </div>
  );
}