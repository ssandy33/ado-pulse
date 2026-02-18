"use client";

import type { PolicyAuditResponse, RepoPolicyStatus } from "@/lib/ado/types";
import {
  StatusDot,
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";

interface PolicyAuditTableProps {
  data: PolicyAuditResponse;
}

const POLICY_KEYS: (keyof RepoPolicyStatus["policies"])[] = [
  "minReviewers",
  "buildValidation",
  "workItemLinking",
  "commentResolution",
  "mergeStrategy",
];

const POLICY_LABELS: Record<keyof RepoPolicyStatus["policies"], string> = {
  minReviewers: "Min Reviewers",
  buildValidation: "Build",
  workItemLinking: "Work Items",
  commentResolution: "Comments",
  mergeStrategy: "Merge Strategy",
};

const COLUMNS: DataTableColumn[] = [
  { header: "Repository" },
  { header: "Min Reviewers", align: "center" },
  { header: "Build", align: "center" },
  { header: "Work Items", align: "center" },
  { header: "Comments", align: "center" },
  { header: "Merge Strategy", align: "center" },
  { header: "Compliance" },
];

const POLICY_DOT_VARIANT: Record<string, StatusVariant> = {
  enabled: "success",
  disabled: "danger",
  not_configured: "neutral",
};

const COMPLIANCE_CONFIG: Record<
  RepoPolicyStatus["compliance"],
  { variant: StatusVariant; label: string }
> = {
  full: { variant: "success", label: "All policies" },
  partial: { variant: "warning", label: "Partial" },
  none: { variant: "neutral", label: "None" },
};

export function PolicyAuditTable({ data }: PolicyAuditTableProps) {
  return (
    <SectionCard
      title="Branch Policy Audit"
      subtitle={`${data.coverage.compliant} / ${data.coverage.total} repos compliant`}
    >
      <DataTable columns={COLUMNS}>
        {data.repos.map((repo) => (
          <tr
            key={repo.repoId}
            className="hover:bg-pulse-hover transition-colors"
          >
            <td className="px-5 py-3 font-mono text-[13px] font-medium text-pulse-text">
              {repo.repoName}
            </td>
            {POLICY_KEYS.map((key) => (
              <td key={key} className="px-5 py-3 text-center">
                <StatusDot variant={POLICY_DOT_VARIANT[repo.policies[key]]} />
              </td>
            ))}
            <td className="px-5 py-3">
              <StatusBadge
                variant={COMPLIANCE_CONFIG[repo.compliance].variant}
                label={COMPLIANCE_CONFIG[repo.compliance].label}
              />
            </td>
          </tr>
        ))}
      </DataTable>
    </SectionCard>
  );
}
