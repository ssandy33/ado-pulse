"use client";

import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: ReactNode;
}

export function KPICard({ title, value, subtitle }: KPICardProps) {
  const isLongValue = typeof value === "string" && value.length > 12;

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-pulse-muted mb-3">
        {title}
      </p>
      <p
        className={`font-mono font-semibold text-pulse-text leading-tight tracking-tight truncate ${
          isLongValue ? "text-[16px]" : "text-[28px] leading-none"
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </p>
      <p className="text-[13px] text-pulse-dim mt-2">{subtitle}</p>
    </div>
  );
}
