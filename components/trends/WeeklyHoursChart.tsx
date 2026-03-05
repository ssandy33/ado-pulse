"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { WeeklyHoursTrend } from "@/lib/trends";

interface WeeklyHoursChartProps {
  data: WeeklyHoursTrend[];
}

export function WeeklyHoursChart({ data }: WeeklyHoursChartProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <h4 className="text-[13px] font-semibold text-pulse-text mb-3">
        Weekly Hours — Last {data.length} Weeks
      </h4>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}h`, undefined]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
            />
            <Bar
              dataKey="capExHours"
              name="CapEx"
              stackId="hours"
              fill="#6366f1"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="opExHours"
              name="OpEx"
              stackId="hours"
              fill="#a5b4fc"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
