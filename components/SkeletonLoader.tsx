"use client";

export function SkeletonKPIRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm"
        >
          <div className="h-3 w-20 bg-pulse-border rounded animate-pulse mb-4" />
          <div className="h-7 w-14 bg-pulse-border rounded animate-pulse mb-3" />
          <div className="h-3 w-28 bg-pulse-border rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-pulse-border">
        <div className="h-4 w-40 bg-pulse-border rounded animate-pulse" />
      </div>
      <div className="divide-y divide-pulse-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-6">
            <div className="h-3.5 w-28 bg-pulse-border rounded animate-pulse" />
            <div className="h-3.5 w-10 bg-pulse-border rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-pulse-border rounded animate-pulse" />
            <div className="h-3.5 w-16 bg-pulse-border rounded animate-pulse" />
            <div className="h-3.5 w-10 bg-pulse-border rounded animate-pulse" />
            <div className="h-5 w-16 bg-pulse-border rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
