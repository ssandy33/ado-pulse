export type StatusVariant = "success" | "warning" | "danger" | "neutral" | "info";

const DOT_COLORS: Record<StatusVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-gray-400",
  info: "bg-blue-500",
};

interface StatusDotProps {
  variant: StatusVariant;
  className?: string;
}

export function StatusDot({ variant, className = "" }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]} ${className}`}
    />
  );
}
