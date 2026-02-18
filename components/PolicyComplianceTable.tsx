"use client";

import type { PolicyComplianceResponse } from "@/lib/ado/types";
import {
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";

interface PolicyComplianceTableProps {
  data: PolicyComplianceResponse;
}

const STATUS_VARIANT: Record<string, StatusVariant> = {
  compliant: "success",
  non_compliant: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
};

const COLUMNS: DataTableColumn[] = [
  { header: "Repository" },
  { header: "Status" },
  { header: "Active Policies" },
];

export function PolicyComplianceTable({ data }: PolicyComplianceTableProps) {
  const sorted = [...data.repos].sort((a, b) => {
    if (a.status === "non_compliant" && b.status !== "non_compliant") return -1;
    if (a.status !== "non_compliant" && b.status === "non_compliant") return 1;
    return 0;
  });

  return (
    <SectionCard
      title="Branch Policy Compliance"
      subtitle="Repos with active PRs that allow direct push to default branch"
    >
      <DataTable columns={COLUMNS}>
        {sorted.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px]"
            >
              <StatusBadge variant="success" label="All repos have branch policies enforced" />
            </td>
          </tr>
        ) : (
          sorted.map((repo) => (
            <tr
              key={repo.repoName}
              className="hover:bg-pulse-hover transition-colors"
            >
              <td className="px-5 py-3 font-mono text-[13px] font-medium text-pulse-text">
                {repo.repoName}
              </td>
              <td className="px-5 py-3">
                <StatusBadge
                  variant={STATUS_VARIANT[repo.status]}
                  label={STATUS_LABEL[repo.status]}
                />
              </td>
              <td className="px-5 py-3 text-[12px] text-pulse-muted">
                {repo.activePolicies.length > 0
                  ? repo.activePolicies.join(", ")
                  : "—"}
              </td>
            </tr>
          ))
        )}
      </DataTable>
    </SectionCard>
  );
}
