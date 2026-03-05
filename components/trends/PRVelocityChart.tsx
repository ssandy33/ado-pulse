"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { WeeklyPRTrend } from "@/lib/trends";

interface PRVelocityChartProps {
  data: WeeklyPRTrend[];
}

export function PRVelocityChart({ data }: PRVelocityChartProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <h4 className="text-[13px] font-semibold text-pulse-text mb-3">
        PR Velocity — Last {data.length} Weeks
      </h4>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
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
              dot={{ r: 4, fill: "#6366f1" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
