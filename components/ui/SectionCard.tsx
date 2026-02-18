import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
  footer,
}: SectionCardProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg shadow-sm overflow-hidden">
      {(title || headerRight) && (
        <div className="px-5 py-4 border-b border-pulse-border flex items-center justify-between">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold text-pulse-text">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[11px] text-pulse-dim mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight}
        </div>
      )}
      {children}
      {footer && (
        <div className="px-5 py-3 border-t border-pulse-border">{footer}</div>
      )}
    </div>
  );
}
