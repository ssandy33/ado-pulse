"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { WeeklyPRTrend, DailyPRTrend } from "@/lib/trends";

interface AlignmentTrendChartProps {
  data: DailyPRTrend[] | WeeklyPRTrend[];
}

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as {
    cx: number;
    cy: number;
    payload: DailyPRTrend | WeeklyPRTrend;
  };
  const score = payload.alignmentScore;
  if (score === null) return null;
  const fill = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="white" strokeWidth={2} />;
}

export function AlignmentTrendChart({ data }: AlignmentTrendChartProps) {
  const hasAlignment = data.some((d) => d.alignmentScore !== null);
  if (!hasAlignment) return null;

  const isDaily = data.length > 0 && "dateLabel" in data[0];
  const labelKey = isDaily ? "dateLabel" : "weekLabel";
  const periodLabel = isDaily ? `Last ${data.length} Days` : `Last ${data.length} Weeks`;

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-4 shadow-sm">
      <h4 className="text-[13px] font-semibold text-pulse-text mb-3">
        Alignment Score — {periodLabel}
      </h4>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={labelKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
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
              formatter={(value) => [`${value}%`, "Alignment"]}
            />
            <ReferenceLine
              y={70}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: "Good", position: "right", fontSize: 10, fill: "#10b981" }}
            />
            <ReferenceLine
              y={50}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: "Warning", position: "right", fontSize: 10, fill: "#f59e0b" }}
            />
            <Line
              type="monotone"
              dataKey="alignmentScore"
              name="Alignment"
              stroke="#6366f1"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
