import { StatusDot, type StatusVariant } from "./StatusDot";

const BADGE_STYLES: Record<StatusVariant, { bg: string; text: string; ring: string }> = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-500/20" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-500/20" },
  danger: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-500/20" },
  neutral: { bg: "bg-gray-50", text: "text-gray-500", ring: "ring-gray-400/20" },
  info: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-500/20" },
};

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

export function StatusBadge({ variant, label, className = "" }: StatusBadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text} ring-1 ${s.ring} ${className}`}
    >
      <StatusDot variant={variant} />
      {label}
    </span>
  );
}
