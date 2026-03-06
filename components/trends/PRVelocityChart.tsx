"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { WeeklyPRTrend, DailyPRTrend, PerPersonDailyPoint } from "@/lib/trends";
import { ContributorFilter } from "./ContributorFilter";

type Granularity = "daily" | "weekly";
type ViewMode = "team" | "per-person";

const MEMBER_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6b7280",
];

interface PRVelocityChartProps {
  data: DailyPRTrend[] | WeeklyPRTrend[];
  defaultGranularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  perPersonData?: PerPersonDailyPoint[];
  perPersonLoading?: boolean;
  members?: Array<{ uniqueName: string; displayName: string }>;
  visibleMembers?: Set<string>;
  onVisibleMembersChange?: (visible: Set<string>) => void;
}

export function PRVelocityChart({
  data,
  defaultGranularity = "daily",
  onGranularityChange,
  viewMode = "team",
  onViewModeChange,
  perPersonData,
  perPersonLoading,
  members,
  visibleMembers,
  onVisibleMembersChange,
}: PRVelocityChartProps) {
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);

  const handleToggle = (g: Granularity) => {
    setGranularity(g);
    onGranularityChange?.(g);
  };

  const isPerPerson = viewMode === "per-person";
  const hasPerPersonData = Boolean(perPersonData && members);

  const chartData = isPerPerson && hasPerPersonData ? perPersonData! : isPerPerson ? [] : data;
  const labelKey = isPerPerson
    ? "dateLabel"
    : granularity === "daily"
      ? "dateLabel"
      : "weekLabel";

  const periodLabel = isPerPerson
    ? hasPerPersonData
      ? `Per Person — ${perPersonData!.length} Days`
      : "Per Person"
    : granularity === "daily"
      ? `Last ${data.length} Days`
      : `Last ${data.length} Weeks`;

  const xInterval = chartData.length > 14 ? Math.ceil(chartData.length / 7) - 1 : 0;

  // Stable color map: assign color by member index in the full members array (not filtered)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (members) {
      members.forEach((m, i) => {
        map.set(m.displayName, MEMBER_COLORS[i % MEMBER_COLORS.length]);
      });
    }
    return map;
  }, [members]);

  // Visible member names for per-person lines — filtered from full members list to preserve order
  const visibleNames = isPerPerson && members
    ? members.filter((m) => !visibleMembers || visibleMembers.has(m.displayName)).map((m) => m.displayName)
    : [];

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-[13px] font-semibold text-pulse-text">
          PR Velocity — {periodLabel}
        </h4>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {onViewModeChange && (
            <div className="flex rounded-md border border-pulse-border overflow-hidden" role="group" aria-label="View mode toggle">
              <button
                type="button"
                onClick={() => onViewModeChange("team")}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === "team"
                    ? "bg-pulse-accent text-white"
                    : "bg-pulse-card text-pulse-muted hover:text-pulse-text"
                }`}
              >
                Team
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("per-person")}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === "per-person"
                    ? "bg-pulse-accent text-white"
                    : "bg-pulse-card text-pulse-muted hover:text-pulse-text"
                }`}
              >
                Per Person
              </button>
            </div>
          )}
          {/* Granularity toggle — only in team mode */}
          {viewMode === "team" && (
            <div className="flex rounded-md border border-pulse-border overflow-hidden" role="group" aria-label="Granularity toggle">
              <button
                type="button"
                onClick={() => handleToggle("daily")}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  granularity === "daily"
                    ? "bg-pulse-accent text-white"
                    : "bg-pulse-card text-pulse-muted hover:text-pulse-text"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => handleToggle("weekly")}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  granularity === "weekly"
                    ? "bg-pulse-accent text-white"
                    : "bg-pulse-card text-pulse-muted hover:text-pulse-text"
                }`}
              >
                Weekly
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contributor filter — only in per-person mode with data */}
      {isPerPerson && hasPerPersonData && visibleMembers && onVisibleMembersChange && (
        <div className="mb-3">
          <ContributorFilter
            members={members!}
            visible={visibleMembers}
            onChange={onVisibleMembersChange}
          />
        </div>
      )}

      {/* Loading state for per-person mode */}
      {isPerPerson && perPersonLoading && (
        <div className="flex items-center justify-center" style={{ height: 220 }}>
          <p className="text-[12px] text-pulse-muted animate-pulse">Loading contributor data...</p>
        </div>
      )}

      {/* Chart */}
      {!(isPerPerson && perPersonLoading) && (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={labelKey}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                interval={xInterval}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              {isPerPerson && hasPerPersonData ? (
                visibleNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={colorMap.get(name) ?? "#6b7280"}
                    strokeWidth={2}
                    dot={{ r: perPersonData!.length > 14 ? 2 : 3, fill: colorMap.get(name) ?? "#6b7280" }}
                    activeDot={{ r: 5 }}
                  />
                ))
              ) : !isPerPerson ? (
                <Line
                  type="monotone"
                  dataKey="totalPRs"
                  name="PRs Merged"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: granularity === "daily" && data.length > 14 ? 2 : 4, fill: "#6366f1" }}
                  activeDot={{ r: 6 }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
