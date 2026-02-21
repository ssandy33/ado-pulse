"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type {
  TeamValidatorResponse,
  TeamsApiResponse,
  Team,
} from "@/lib/ado/types";
import { SkeletonTable } from "./SkeletonLoader";

interface TeamValidatorProps {
  adoHeaders: Record<string, string>;
  range: TimeRange;
  preSelectedTeam?: string;
}

function TeamDropdown({
  selectedTeam,
  onTeamChange,
  adoHeaders,
}: {
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  adoHeaders: Record<string, string>;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/teams?pinnedOnly=true", { headers: adoHeaders })
      .then((res) => res.json())
      .then((data: TeamsApiResponse) => setTeams(data.teams))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <span className="text-pulse-dim text-[12px]">Loading teams...</span>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-pulse-accent hover:text-pulse-accent-hover transition-colors cursor-pointer"
      >
        {selectedTeam || "Select a team"}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-pulse-card border border-pulse-border rounded-lg shadow-lg py-1 min-w-[240px] max-h-[300px] overflow-y-auto">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                onTeamChange(team.name);
                setOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-[13px] hover:bg-pulse-hover transition-colors cursor-pointer ${
                team.name === selectedTeam
                  ? "text-pulse-accent font-medium"
                  : "text-pulse-secondary"
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamValidator({ adoHeaders, range, preSelectedTeam }: TeamValidatorProps) {
  const [selectedTeam, setSelectedTeam] = useState(preSelectedTeam || "");
  const [data, setData] = useState<TeamValidatorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (preSelectedTeam) setSelectedTeam(preSelectedTeam);
  }, [preSelectedTeam]);

  const fetchValidator = useCallback(() => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedRow(null);

    fetch(
      `/api/org-health/team-validator?team=${encodeURIComponent(selectedTeam)}&range=${range}`,
      { headers: adoHeaders }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((json: TeamValidatorResponse) => setData(json))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [selectedTeam, range, adoHeaders]);

  useEffect(() => {
    fetchValidator();
  }, [fetchValidator]);

  const toggleRow = (key: string) => {
    setExpandedRow((prev) => (prev === key ? null : key));
  };

  return (
    <div className="mb-6">
      <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-pulse-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[13px] font-semibold text-pulse-text">
                Team Validator
              </h3>
              <TeamDropdown
                selectedTeam={selectedTeam}
                onTeamChange={setSelectedTeam}
                adoHeaders={adoHeaders}
              />
            </div>
            {data && (
              <span className="text-[11px] text-pulse-dim">
                {data.team.name} &middot; {data.period.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-pulse-muted mt-1">
            Check whether roster member emails resolve to actual PR activity.
          </p>
        </div>

        <div className="p-4">
          {!selectedTeam && !loading && (
            <p className="text-[13px] text-pulse-muted text-center py-6">
              Select a team to begin.
            </p>
          )}

          {loading && <SkeletonTable rows={4} />}

          {error && (
            <div className="text-center py-6">
              <p className="text-[13px] text-pulse-muted mb-2">{error}</p>
              <button
                onClick={fetchValidator}
                className="text-[12px] font-medium text-pulse-accent hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Roster identity check table */}
              <div className="overflow-x-auto">
                <div className="px-3 py-2 mb-1">
                  <h4 className="text-[11px] font-medium text-pulse-muted uppercase tracking-wide">
                    Roster Identity Check
                  </h4>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border">
                      <th className="px-3 py-2 font-medium">Roster Member</th>
                      <th className="px-3 py-2 font-medium">Email Matched</th>
                      <th className="px-3 py-2 font-medium text-right">PRs Found</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rosterMembers.map((member) => {
                      const isExpanded = expandedRow === member.uniqueName;
                      const canExpand = member.foundInProjectPRs && member.prs.length > 0;

                      return (
                        <tr key={member.uniqueName} className="contents">
                          {/* Main row */}
                          <tr
                            className={`border-b border-pulse-border/50 ${
                              !member.foundInProjectPRs ? "border-l-2 border-l-red-300" : ""
                            } ${canExpand ? "cursor-pointer hover:bg-pulse-hover/50" : ""}`}
                            onClick={() => canExpand && toggleRow(member.uniqueName)}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                {canExpand && (
                                  <svg
                                    className={`w-3 h-3 text-pulse-muted transition-transform flex-shrink-0 ${
                                      isExpanded ? "rotate-90" : ""
                                    }`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                                <div>
                                  <div className="text-pulse-text">{member.displayName}</div>
                                  <div className="text-[11px] font-mono text-pulse-muted">{member.uniqueName}</div>
                                </div>
                              </div>
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
                          {/* Expanded PR list */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={3} className="px-0 py-0">
                                <div className="bg-pulse-bg/50 px-8 py-2">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="text-pulse-muted">
                                        <th className="text-left px-2 py-1 font-medium">PR</th>
                                        <th className="text-left px-2 py-1 font-medium">Title</th>
                                        <th className="text-left px-2 py-1 font-medium">Repo</th>
                                        <th className="text-left px-2 py-1 font-medium">Date</th>
                                        <th className="text-right px-2 py-1 font-medium"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {member.prs.map((pr) => (
                                        <tr
                                          key={pr.pullRequestId}
                                          className="border-t border-pulse-border/30"
                                        >
                                          <td className="px-2 py-1 text-pulse-muted">#{pr.pullRequestId}</td>
                                          <td className="px-2 py-1 text-pulse-text">{pr.title}</td>
                                          <td className="px-2 py-1 text-pulse-muted">{pr.repoName}</td>
                                          <td className="px-2 py-1 text-pulse-muted">
                                            {new Date(pr.creationDate).toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                          </td>
                                          <td className="px-2 py-1 text-right">
                                            <a
                                              href={pr.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-pulse-accent hover:underline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              &#8599;
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explanatory footer */}
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-pulse-muted">
                  <span className="text-emerald-600 font-medium">&#10003; Found</span> rows are expandable — click to see PRs.{" "}
                  <span className="text-red-600 font-medium">&#10007; Not found</span> means the email
                  was never used to author a PR this period.
                </p>

                {data.apiLimitHit && (
                  <div className="flex items-center gap-2 text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>API limit hit — may be incomplete (500 PR ceiling)</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
