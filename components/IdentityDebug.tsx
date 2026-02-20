"use client";

import { useState, useEffect, useCallback } from "react";
import { SkeletonTable } from "./SkeletonLoader";

interface IdentityDebugProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  days: number;
}

interface RosterMemberRaw {
  id: string;
  displayName: string;
  uniqueName: string;
  descriptor?: string;
  subjectKind?: string;
  origin?: string;
}

interface RosterMemberEntry {
  raw: RosterMemberRaw;
  matchedAuthorUniqueName: string | null;
  matchedPRCount: number;
  matchType: "exact" | "lowercase" | "none";
}

interface PRAuthorEntry {
  raw: { id: string; displayName: string; uniqueName: string };
  prCount: number;
  matchedRosterMember: string | null;
}

interface IdentityCheckResponse {
  period: { days: number; from: string; to: string };
  apiLimitHit: boolean;
  team: { id: string; name: string };
  rosterMembers: RosterMemberEntry[];
  prAuthors: PRAuthorEntry[];
  unmatchedRosterMembers: string[];
  unmatchedPRAuthors: string[];
}

function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) + "..." : id;
}

function MatchBadge({ matchType }: { matchType: "exact" | "lowercase" | "none" }) {
  if (matchType === "exact") {
    return <span className="text-emerald-600 font-medium text-[11px]">&#10003; exact</span>;
  }
  if (matchType === "lowercase") {
    return <span className="text-emerald-600 font-medium text-[11px]">&#10003; lowercase</span>;
  }
  return <span className="text-red-600 font-medium text-[11px]">&#10007; none</span>;
}

export function IdentityDebug({ adoHeaders, selectedTeam, days }: IdentityDebugProps) {
  const [data, setData] = useState<IdentityCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);

    fetch(
      `/api/debug/identity-check?team=${encodeURIComponent(selectedTeam)}&days=${days}`,
      { headers: adoHeaders }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json: IdentityCheckResponse) => setData(json))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [selectedTeam, days, adoHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const matched = data?.rosterMembers.filter((m) => m.matchType !== "none").length ?? 0;
  const unmatched = data?.rosterMembers.filter((m) => m.matchType === "none").length ?? 0;

  return (
    <>
      <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden mb-6">
        {/* Header */}
        <div className="px-4 py-3 border-b border-pulse-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-semibold text-pulse-text">
                Identity Debug
              </h3>
              {selectedTeam && (
                <span className="text-[13px] font-medium text-pulse-accent">{selectedTeam}</span>
              )}
            </div>
            {data && (
              <span className="text-[11px] text-pulse-dim">
                {data.period.days} days &middot; {data.prAuthors.length} unique PR authors
              </span>
            )}
          </div>
          <p className="text-[11px] text-pulse-muted mt-1">
            Raw identity values from ADO APIs — no filtering or normalization.
            Use this to diagnose why roster members aren&apos;t matching PR authors.
          </p>
        </div>

        <div className="p-4">
          {!selectedTeam && !loading && (
            <p className="text-[13px] text-pulse-muted text-center py-6">
              Select a team using the dropdown above to begin.
            </p>
          )}

          {loading && <SkeletonTable rows={6} />}

          {error && (
            <div className="text-center py-6">
              <p className="text-[13px] text-pulse-muted mb-2">{error}</p>
              <button
                onClick={fetchData}
                className="text-[12px] font-medium text-pulse-accent hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Roster Members</div>
                  <div className="text-lg font-semibold text-pulse-text">{data.rosterMembers.length}</div>
                  <div className="text-[11px] text-pulse-muted">from team API</div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Matched</div>
                  <div className="text-lg font-semibold text-emerald-600">{matched}</div>
                  <div className="text-[11px] text-pulse-muted">found in PRs</div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Unmatched</div>
                  <div className={`text-lg font-semibold ${unmatched > 0 ? "text-red-600" : "text-pulse-text"}`}>{unmatched}</div>
                  <div className="text-[11px] text-pulse-muted">not in PR data</div>
                </div>
              </div>

              {/* API limit warning */}
              {data.apiLimitHit && (
                <div className="mb-4 flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>API returned 500 PRs (max limit). Some authors may be missing from the PR Authors table.</span>
                </div>
              )}

              {/* Roster Members table */}
              <div className="mb-6">
                <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                  Roster Members
                </h4>
                <p className="text-[11px] text-pulse-muted mb-2">
                  Raw values from ADO team membership API
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-pulse-muted border-b border-pulse-border">
                        <th className="px-3 py-2 font-medium">Display Name</th>
                        <th className="px-3 py-2 font-medium">uniqueName (raw)</th>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">Match</th>
                        <th className="px-3 py-2 font-medium text-right">PRs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rosterMembers.map((member) => (
                        <tr
                          key={member.raw.id}
                          className={`border-b border-pulse-border/50 last:border-0 ${
                            member.matchType === "none" ? "bg-red-50/30" : ""
                          }`}
                        >
                          <td className="px-3 py-2 text-pulse-text">{member.raw.displayName}</td>
                          <td className="px-3 py-2 font-mono text-pulse-muted break-all">{member.raw.uniqueName}</td>
                          <td className="px-3 py-2 font-mono text-pulse-dim text-[11px]" title={member.raw.id}>
                            {truncateId(member.raw.id)}
                          </td>
                          <td className="px-3 py-2">
                            <MatchBadge matchType={member.matchType} />
                          </td>
                          <td className="px-3 py-2 text-right text-pulse-text">{member.matchedPRCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-[11px] text-pulse-muted space-x-4">
                  <span><span className="text-emerald-600 font-medium">&#10003; exact</span> — matched without any normalization</span>
                  <span><span className="text-emerald-600 font-medium">&#10003; lowercase</span> — only matched after lowercasing both sides</span>
                  <span><span className="text-red-600 font-medium">&#10007; none</span> — no match found in PR data</span>
                </div>
              </div>

              {/* PR Authors table */}
              <div className="mb-6">
                <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                  PR Authors
                </h4>
                <p className="text-[11px] text-pulse-muted mb-2">
                  All unique authors in the project during this period — raw createdBy values from ADO PR API
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-pulse-muted border-b border-pulse-border">
                        <th className="px-3 py-2 font-medium">Display Name</th>
                        <th className="px-3 py-2 font-medium">uniqueName (raw)</th>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-3 py-2 font-medium">On Team?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.prAuthors.map((author) => (
                        <tr
                          key={author.raw.uniqueName}
                          className="border-b border-pulse-border/50 last:border-0"
                        >
                          <td className="px-3 py-2 text-pulse-text">{author.raw.displayName}</td>
                          <td className="px-3 py-2 font-mono text-pulse-muted break-all">{author.raw.uniqueName}</td>
                          <td className="px-3 py-2 font-mono text-pulse-dim text-[11px]" title={author.raw.id}>
                            {truncateId(author.raw.id)}
                          </td>
                          <td className="px-3 py-2">
                            {author.matchedRosterMember ? (
                              <span className="text-emerald-600 font-medium text-[11px]">&#10003; Yes</span>
                            ) : (
                              <span className="text-red-600 font-medium text-[11px]">&#10007; No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unmatched Roster Members */}
              {data.unmatchedRosterMembers.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                    Unmatched Roster Members
                  </h4>
                  <p className="text-[11px] text-pulse-muted mb-2">
                    These roster emails were not found anywhere in PR author data.
                  </p>
                  <div className="bg-pulse-bg rounded-md p-3">
                    <div className="space-y-1">
                      {data.unmatchedRosterMembers.map((email) => (
                        <div key={email} className="text-[12px] font-mono text-red-600">{email}</div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-pulse-muted mt-2">
                    These are the exact strings being compared. If you see a person you know is active,
                    compare their entry in the PR Authors table above to find the actual identity they&apos;re using.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
