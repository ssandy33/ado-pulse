"use client";

import { useState, Fragment } from "react";
import type {
  UnmatchedAuthorsResponse,
  UnmatchedAuthorPR,
} from "@/lib/ado/types";
import {
  StatusBadge,
  SectionCard,
  DataTable,
  type StatusVariant,
  type DataTableColumn,
} from "./ui";

interface UnmatchedAuthorsTableProps {
  data: UnmatchedAuthorsResponse;
}

const TYPE_VARIANT: Record<string, StatusVariant> = {
  "service-account": "neutral",
  external: "warning",
  unknown: "danger",
};

const TYPE_LABEL: Record<string, string> = {
  "service-account": "Service",
  external: "External",
  unknown: "Unknown",
};

const COLUMNS: DataTableColumn[] = [
  { header: "" },
  { header: "Identity" },
  { header: "PRs", align: "right" },
  { header: "Repos" },
  { header: "Last PR" },
  { header: "Type" },
];

function truncateRepos(repos: string[], max = 3): string {
  if (repos.length === 0) return "—";
  const shown = repos.slice(0, max).join(", ");
  const remaining = repos.length - max;
  return remaining > 0 ? `${shown} +${remaining} more` : shown;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function UnmatchedAuthorsTable({ data }: UnmatchedAuthorsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(uniqueName: string) {
    setExpandedId((prev) => (prev === uniqueName ? null : uniqueName));
  }

  return (
    <SectionCard
      title="Unmatched PR Authors"
      subtitle="Authors who submitted PRs but don't resolve to any ADO team"
    >
      <DataTable columns={COLUMNS}>
        {data.authors.length === 0 ? (
          <tr>
            <td
              colSpan={COLUMNS.length}
              className="px-5 py-8 text-center text-[13px]"
            >
              <StatusBadge
                variant="success"
                label="All PR authors resolved to ADO teams"
              />
            </td>
          </tr>
        ) : (
          data.authors.map((author) => {
            const isExpanded = expandedId === author.uniqueName;
            const dualLine =
              author.displayName && author.displayName !== author.uniqueName;

            return (
              <Fragment key={author.uniqueName}>
                <tr
                  className="hover:bg-pulse-hover transition-colors cursor-pointer"
                  onClick={() => toggleExpand(author.uniqueName)}
                >
                  <td className="pl-5 pr-1 py-3 w-6 text-pulse-muted">
                    <span
                      className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {dualLine ? (
                      <>
                        <div className="text-[13px] font-medium text-pulse-text">
                          {author.displayName}
                        </div>
                        <div className="font-mono text-[11px] text-pulse-muted">
                          {author.uniqueName}
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-[13px] font-medium text-pulse-text">
                        {author.uniqueName}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px] text-pulse-text text-right tabular-nums">
                    {author.prCount}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-pulse-muted">
                    {truncateRepos(author.repos)}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-pulse-muted">
                    {formatDate(author.lastPRDate)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      variant={TYPE_VARIANT[author.likelyType]}
                      label={TYPE_LABEL[author.likelyType]}
                    />
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="p-0">
                      <div className="bg-pulse-bg/50 border-t border-pulse-border px-8 py-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="pb-2 text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                                Title
                              </th>
                              <th className="pb-2 text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                                Repo
                              </th>
                              <th className="pb-2 text-[11px] font-medium uppercase tracking-wide text-pulse-muted">
                                Date
                              </th>
                              <th className="pb-2 text-[11px] font-medium uppercase tracking-wide text-pulse-muted w-10">
                                Link
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-pulse-border/50">
                            {author.prs.map((pr: UnmatchedAuthorPR) => (
                              <tr key={pr.pullRequestId}>
                                <td className="py-2 pr-4 text-[13px] text-pulse-text">
                                  {pr.title}
                                </td>
                                <td className="py-2 pr-4 font-mono text-[12px] text-pulse-muted">
                                  {pr.repoName}
                                </td>
                                <td className="py-2 pr-4 text-[12px] text-pulse-muted">
                                  {formatDate(pr.creationDate)}
                                </td>
                                <td className="py-2 text-center">
                                  <a
                                    href={pr.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open PR ${pr.pullRequestId} in new tab`}
                                    className="text-pulse-accent hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ↗
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })
        )}
      </DataTable>
    </SectionCard>
  );
}
