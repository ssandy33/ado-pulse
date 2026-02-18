"use client";

interface TimeRangeSelectorProps {
  days: number;
  onDaysChange: (days: number) => void;
}

const OPTIONS = [7, 14, 30] as const;

export function TimeRangeSelector({
  days,
  onDaysChange,
}: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center rounded-lg border border-pulse-border overflow-hidden">
      {OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => onDaysChange(d)}
          className={`px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
            days === d
              ? "bg-pulse-accent text-white"
              : "bg-pulse-card text-pulse-muted hover:text-pulse-text hover:bg-pulse-hover"
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}
