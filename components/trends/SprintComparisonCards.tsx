"use client";

import type { SprintComparison } from "@/lib/trends";

interface SprintComparisonCardsProps {
  data: SprintComparison;
}

function DeltaBadge({
  value,
  invert = false,
  suffix = "",
}: {
  value: number | null;
  invert?: boolean;
  suffix?: string;
}) {
  if (value === null) return <span className="text-[11px] text-pulse-dim">—</span>;

  const isPositive = value > 0;
  const isGood = invert ? !isPositive : isPositive;
  const color = value === 0 ? "text-pulse-muted" : isGood ? "text-emerald-600" : "text-red-600";
  const arrow = value > 0 ? "\u2191" : value < 0 ? "\u2193" : "";
  const display = Math.abs(value);

  return (
    <span className={`text-[11px] font-medium ${color}`}>
      {arrow} {display.toFixed(suffix === "%" ? 0 : 1)}
      {suffix}
    </span>
  );
}

function MetricRow({
  label,
  current,
  previous,
  delta,
  invert = false,
  suffix = "",
}: {
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  invert?: boolean;
  suffix?: string;
}) {
  const format = (v: number | null) =>
    v === null ? "—" : `${v.toFixed(suffix === "%" ? 0 : 1)}${suffix}`;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-pulse-border/50 last:border-0">
      <span className="text-[11px] text-pulse-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-pulse-text font-medium w-12 text-right">
          {format(current)}
        </span>
        <span className="text-[11px] text-pulse-dim w-12 text-right">
          {format(previous)}
        </span>
        <div className="w-14 text-right">
          <DeltaBadge value={delta} invert={invert} suffix={suffix} />
        </div>
      </div>
    </div>
  );
}

export function SprintComparisonCards({ data }: SprintComparisonCardsProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <h4 className="text-[13px] font-semibold text-pulse-text mb-3">
        Sprint Comparison
      </h4>
      <div className="flex items-center gap-3 text-[10px] text-pulse-dim uppercase tracking-wider mb-2 justify-end pr-1">
        <span className="w-12 text-right">Current</span>
        <span className="w-12 text-right">Previous</span>
        <span className="w-14 text-right">Delta</span>
      </div>
      <MetricRow
        label="PRs Merged"
        current={data.current.totalPRs}
        previous={data.previous.totalPRs}
        delta={data.delta.totalPRs}
      />
      <MetricRow
        label="Avg PR Age"
        current={data.current.avgPRAgeDays}
        previous={data.previous.avgPRAgeDays}
        delta={data.delta.avgPRAgeDays}
        invert
        suffix="d"
      />
      <MetricRow
        label="Alignment"
        current={data.current.alignmentScore}
        previous={data.previous.alignmentScore}
        delta={data.delta.alignmentScore}
        suffix="%"
      />
    </div>
  );
}
