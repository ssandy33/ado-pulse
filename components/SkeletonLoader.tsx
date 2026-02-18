"use client";

export function SkeletonKPIRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-pulse-card border border-pulse-border rounded-lg p-5"
        >
          <div className="h-3 w-24 bg-pulse-border rounded animate-pulse mb-3" />
          <div className="h-8 w-16 bg-pulse-border rounded animate-pulse mb-2" />
          <div className="h-3 w-32 bg-pulse-border rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-pulse-border">
        <div className="h-4 w-48 bg-pulse-border rounded animate-pulse" />
      </div>
      <div className="divide-y divide-pulse-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-6">
            <div className="h-4 w-24 bg-pulse-border rounded animate-pulse" />
            <div className="h-4 w-12 bg-pulse-border rounded animate-pulse" />
            <div className="h-4 w-36 bg-pulse-border rounded animate-pulse" />
            <div className="h-4 w-20 bg-pulse-border rounded animate-pulse" />
            <div className="h-4 w-16 bg-pulse-border rounded animate-pulse" />
            <div className="h-4 w-8 bg-pulse-border rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
