import type { ReactNode } from "react";

export interface DataTableColumn {
  header: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps {
  columns: DataTableColumn[];
  children: ReactNode;
}

export function DataTable({ columns, children }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pulse-border bg-pulse-bg/50">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-pulse-muted text-${col.align ?? "left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pulse-border">{children}</tbody>
      </table>
    </div>
  );
}
