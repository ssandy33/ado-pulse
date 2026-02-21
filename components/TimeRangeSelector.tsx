"use client";

import type { TimeRange } from "@/lib/dateRange";

interface TimeRangeSelectorProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "mtd", label: "MTD" },
];

export function TimeRangeSelector({
  range,
  onRangeChange,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center rounded-lg border border-pulse-border overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onRangeChange(opt.value)}
          className={`px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
            range === opt.value
              ? "bg-pulse-accent text-white"
              : "bg-pulse-card text-pulse-muted hover:text-pulse-text hover:bg-pulse-hover"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
