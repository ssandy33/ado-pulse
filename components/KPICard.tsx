"use client";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
}

export function KPICard({ title, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-5">
      <p className="text-xs font-mono uppercase tracking-wider text-pulse-muted">
        {title}
      </p>
      <p className="text-3xl font-mono font-medium text-pulse-text mt-1">
        {value}
      </p>
      <p className="text-sm text-pulse-muted mt-1">{subtitle}</p>
    </div>
  );
}
