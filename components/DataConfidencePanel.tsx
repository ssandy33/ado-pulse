"use client";

import { useState } from "react";
import type { DataDiagnostics } from "@/lib/ado/types";

interface DataConfidencePanelProps {
  diagnostics: DataDiagnostics;
  onInvestigate?: () => void;
}

const CONFIDENCE_STYLES = {
  high: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  medium: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  low: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" },
  zero: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" },
} as const;

const CONFIDENCE_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
  zero: "Zero",
} as const;

function getSummaryText(d: DataDiagnostics): string {
  const { membersWithPRs, totalRosterMembers } = d.summary;
  if (d.confidence === "zero") {
    return "no roster members appear in any project PR";
  }
  return `${membersWithPRs}/${totalRosterMembers} roster members active in project PR data`;
}

export function DataConfidencePanel({ diagnostics, onInvestigate }: DataConfidencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const styles = CONFIDENCE_STYLES[diagnostics.confidence];
  const label = CONFIDENCE_LABELS[diagnostics.confidence];
  const summary = getSummaryText(diagnostics);

  const sorted = [...diagnostics.rosterMembers].sort((a, b) => {
    if (a.foundInProjectPRs !== b.foundInProjectPRs) return a.foundInProjectPRs ? 1 : -1;
    return a.displayName.localeCompare(b.displayName);
  });

  const isHealthy = diagnostics.confidence === "high" && !diagnostics.apiLimitHit;

  return (
    <div className={`mb-6 rounded-lg border ${styles.border} ${styles.bg} overflow-hidden`}>
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className={`inline-block w-2 h-2 rounded-full ${styles.dot}`} />
          <span className={`text-[13px] font-medium ${styles.text}`}>
            Data Confidence: {label}
          </span>
          <span className="text-[12px] text-pulse-muted">
            — {summary}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-pulse-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* API limit warning — always visible when hit */}
      {diagnostics.apiLimitHit && !expanded && (
        <div className="mx-4 mb-2.5 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>Data may be incomplete — API returned maximum results (500 PR ceiling)</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-pulse-border/30">
          {/* Explanation */}
          <p className="text-[12px] text-pulse-muted mt-3 mb-4">
            Each roster member&apos;s email is looked up in all project PR data for this period.
            If their email never appears, their ADO identity may not match their roster entry.
          </p>

          {/* Healthy state — minimal view */}
          {isHealthy ? (
            <div className="flex items-center gap-2 bg-white/70 rounded-md px-4 py-3">
              <span className="text-emerald-500 text-sm">&#10003;</span>
              <span className="text-[13px] text-pulse-text">
                All {diagnostics.summary.totalRosterMembers} roster members found in project PR data. Data looks healthy.
              </span>
            </div>
          ) : (
            <>
              {/* Roster identity check table */}
              <div className="bg-white/70 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-pulse-border/30">
                  <h4 className="text-[11px] font-medium text-pulse-muted uppercase tracking-wide">
                    Roster Identity Check
                  </h4>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border/30">
                      <th className="px-3 py-2 font-medium">Roster Member</th>
                      <th className="px-3 py-2 font-medium">Email Matched</th>
                      <th className="px-3 py-2 font-medium text-right">PRs Found</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((member) => (
                      <tr
                        key={member.uniqueName}
                        className={`border-b border-pulse-border/20 last:border-0 ${
                          !member.foundInProjectPRs ? "border-l-2 border-l-red-300" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="text-pulse-text">{member.displayName}</div>
                          <div className="text-[11px] font-mono text-pulse-muted">{member.uniqueName}</div>
                        </td>
                        <td className="px-3 py-2">
                          {member.foundInProjectPRs ? (
                            <span className="text-emerald-600 font-medium">&#10003; Found</span>
                          ) : (
                            <span className="text-red-600 font-medium">&#10007; Not found</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-pulse-text">{member.matchedPRCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Not found explanation */}
              {diagnostics.summary.membersNotFound > 0 && (
                <p className="text-[11px] text-pulse-muted mt-3">
                  <span className="text-red-600 font-medium">&#10007; Not found</span> means this exact email
                  was not used to author any PR in the project during this period. Either the member is inactive,
                  or their ADO login email differs from their roster entry.
                  Fix in ADO: Project Settings &rarr; Teams &rarr; [team] &rarr; Members
                </p>
              )}
            </>
          )}

          {/* API limit warning */}
          {diagnostics.apiLimitHit && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                API limit hit — results may be incomplete. The project has more than 500 PRs in this period.
                Some members may be marked Not Found incorrectly.
              </span>
            </div>
          )}

          {/* Investigate further link */}
          {onInvestigate && diagnostics.confidence !== "high" && (
            <div className="mt-3 text-right">
              <button
                onClick={onInvestigate}
                className="text-[12px] font-medium text-pulse-accent hover:text-pulse-accent-hover hover:underline cursor-pointer"
              >
                Investigate further in Team Validator &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
