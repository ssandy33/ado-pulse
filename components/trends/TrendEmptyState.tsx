interface TrendEmptyStateProps {
  message?: string;
}

export function TrendEmptyState({ message }: TrendEmptyStateProps) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm text-center">
      <div className="w-10 h-10 rounded-full bg-pulse-accent/10 flex items-center justify-center mx-auto mb-3">
        <svg
          className="w-5 h-5 text-pulse-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      </div>
      <p className="text-[13px] text-pulse-muted max-w-[320px] mx-auto">
        {message || "Trend data is building — check back after a few more days of snapshots."}
      </p>
    </div>
  );
}
