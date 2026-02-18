"use client";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
}

export function KPICard({ title, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-pulse-muted mb-3">
        {title}
      </p>
      <p className="text-[28px] font-mono font-semibold text-pulse-text leading-none tracking-tight">
        {value}
      </p>
      <p className="text-[13px] text-pulse-dim mt-2">{subtitle}</p>
    </div>
  );
}
