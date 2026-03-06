"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { WeeklyPRTrend, DailyPRTrend } from "@/lib/trends";

type Granularity = "daily" | "weekly";

interface PRVelocityChartProps {
  data: DailyPRTrend[] | WeeklyPRTrend[];
  defaultGranularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
}

export function PRVelocityChart({
  data,
  defaultGranularity = "daily",
  onGranularityChange,
}: PRVelocityChartProps) {
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);

  const handleToggle = (g: Granularity) => {
    setGranularity(g);
    onGranularityChange?.(g);
  };

  const labelKey = granularity === "daily" ? "dateLabel" : "weekLabel";
  const periodLabel =
    granularity === "daily"
      ? `Last ${data.length} Days`
      : `Last ${data.length} Weeks`;

  // For daily views with many points, show fewer XAxis labels
  const xInterval = data.length > 14 ? Math.ceil(data.length / 7) - 1 : 0;

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-pulse-text">
          PR Velocity — {periodLabel}
        </h4>
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
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
            <Line
              type="monotone"
              dataKey="totalPRs"
              name="PRs Merged"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: granularity === "daily" && data.length > 14 ? 2 : 4, fill: "#6366f1" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
