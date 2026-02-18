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
    <div className="flex gap-1">
      {OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => onDaysChange(d)}
          className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
            days === d
              ? "bg-pulse-accent text-white"
              : "bg-pulse-card text-pulse-muted border border-pulse-border hover:text-pulse-text"
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}
