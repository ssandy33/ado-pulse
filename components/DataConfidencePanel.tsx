"use client";

import { useState } from "react";
import type { DataDiagnostics } from "@/lib/ado/types";

interface DataConfidencePanelProps {
  diagnostics: DataDiagnostics;
  onInvestigate?: () => void;
}

function getConfidenceColor(matchRate: number, zeroActivity: boolean) {
  if (zeroActivity) return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500" };
  if (matchRate >= 80) return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (matchRate >= 50) return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500" };
  return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500" };
}

function getConfidenceLabel(matchRate: number, zeroActivity: boolean) {
  if (zeroActivity) return "No team activity detected";
  if (matchRate >= 80) return "High confidence";
  if (matchRate >= 50) return "Moderate confidence";
  return "Low confidence";
}

export function DataConfidencePanel({ diagnostics, onInvestigate }: DataConfidencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = getConfidenceColor(diagnostics.matchRate, diagnostics.zeroActivityWarning);
  const label = getConfidenceLabel(diagnostics.matchRate, diagnostics.zeroActivityWarning);

  return (
    <div className={`mb-6 rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className={`inline-block w-2 h-2 rounded-full ${colors.bar}`} />
          <span className={`text-[13px] font-medium ${colors.text}`}>
            Data Confidence: {label}
          </span>
          <span className="text-[12px] text-pulse-muted">
            {diagnostics.matchRate}% of PRs in team repos attributed to roster
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

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-pulse-border/30">
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="bg-white/70 rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">PRs in Team Repos</div>
              <div className="text-lg font-semibold text-pulse-text">{diagnostics.PRsInTeamRepos}</div>
              <div className="text-[11px] text-pulse-muted">across {diagnostics.teamRepos.length} repos</div>
            </div>
            <div className="bg-white/70 rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Attributed to Team</div>
              <div className="text-lg font-semibold text-pulse-text">{diagnostics.teamMatchedPRs}</div>
              <div className="text-[11px] text-pulse-muted">{diagnostics.matchRate}% match rate</div>
            </div>
            <div className="bg-white/70 rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Gap PRs</div>
              <div className={`text-lg font-semibold ${diagnostics.gapPRs > 0 ? "text-amber-600" : "text-pulse-text"}`}>
                {diagnostics.gapPRs}
              </div>
              <div className="text-[11px] text-pulse-muted">unattributed in team repos</div>
            </div>
          </div>

          {/* Possible mismatches table */}
          {diagnostics.unmatchedInTeamRepos.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[12px] font-medium text-pulse-text mb-2">
                Unmatched Authors in Team Repos ({diagnostics.unmatchedInTeamRepos.length})
              </h4>
              <div className="bg-white/70 rounded-md overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border/30">
                      <th className="px-3 py-2 font-medium">Identity</th>
                      <th className="px-3 py-2 font-medium">Display Name</th>
                      <th className="px-3 py-2 font-medium text-right">PRs</th>
                      <th className="px-3 py-2 font-medium">Possible Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.unmatchedInTeamRepos.map((author) => (
                      <tr
                        key={author.uniqueName}
                        className={`border-b border-pulse-border/20 last:border-0 ${
                          author.possibleMatch ? "bg-amber-50/50" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-pulse-muted">{author.uniqueName}</td>
                        <td className="px-3 py-2 text-pulse-text">{author.displayName}</td>
                        <td className="px-3 py-2 text-right text-pulse-text">{author.prCount}</td>
                        <td className="px-3 py-2">
                          {author.possibleMatch ? (
                            <span className="text-amber-600 font-medium">{author.possibleMatchName}</span>
                          ) : (
                            <span className="text-pulse-dim">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roster identities */}
          <div className="mt-4">
            <details className="group">
              <summary className="text-[12px] font-medium text-pulse-muted cursor-pointer hover:text-pulse-text">
                Roster Identities ({diagnostics.rosterIdentities.length})
              </summary>
              <div className="mt-2 bg-white/70 rounded-md p-3">
                <div className="flex flex-wrap gap-1.5">
                  {diagnostics.rosterIdentities.map((id) => (
                    <span key={id} className="inline-block text-[11px] font-mono text-pulse-muted bg-pulse-bg px-2 py-0.5 rounded">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            </details>
          </div>

          {/* API limit warning */}
          {diagnostics.apiLimitHit && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>API returned 500 PRs (max limit). Data may be incomplete for this time range.</span>
            </div>
          )}

          {/* Zero activity warning */}
          {diagnostics.zeroActivityWarning && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                Zero team PRs matched but {diagnostics.totalProjectPRs} project PRs exist.
                This likely indicates identity mismatches in the team roster.
              </span>
            </div>
          )}

          {/* Investigate further link */}
          {onInvestigate && (diagnostics.gapPRs > 0 || diagnostics.zeroActivityWarning) && (
            <div className="mt-3 text-right">
              <button
                onClick={onInvestigate}
                className="text-[12px] font-medium text-pulse-accent hover:text-pulse-accent-hover hover:underline cursor-pointer"
              >
                Investigate further in Team Validator →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
