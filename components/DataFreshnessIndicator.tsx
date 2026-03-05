import { StatusDot, type StatusVariant } from "./ui/StatusDot";

type DataSource = "live" | "cache" | "stale";

interface DataFreshnessIndicatorProps {
  source: DataSource;
  snapshotDate?: string;
}

function getVariant(source: DataSource): StatusVariant {
  switch (source) {
    case "live":
      return "success";
    case "cache":
      return "info";
    case "stale":
      return "warning";
    default:
      return "neutral";
  }
}

function getLabel(source: DataSource, snapshotDate?: string): string {
  switch (source) {
    case "live":
      return "Live";
    case "cache": {
      if (!snapshotDate) return "Cached";
      const d = new Date(snapshotDate + "T00:00:00Z");
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return `Cached \u00B7 ${label}`;
    }
    case "stale": {
      if (!snapshotDate) return "Stale";
      const d = new Date(snapshotDate + "T00:00:00Z");
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return `Stale \u00B7 ${label}`;
    }
    default:
      return "Unknown";
  }
}

export function DataFreshnessIndicator({
  source,
  snapshotDate,
}: DataFreshnessIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-pulse-dim">
      <StatusDot variant={getVariant(source)} />
      {getLabel(source, snapshotDate)}
    </span>
  );
}
