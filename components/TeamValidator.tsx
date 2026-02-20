"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TeamValidatorResponse,
  TeamsApiResponse,
  Team,
} from "@/lib/ado/types";
import { SkeletonTable } from "./SkeletonLoader";

interface TeamValidatorProps {
  adoHeaders: Record<string, string>;
  days: number;
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
    fetch("/api/teams", { headers: adoHeaders })
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

export function TeamValidator({ adoHeaders, days, preSelectedTeam }: TeamValidatorProps) {
  const [selectedTeam, setSelectedTeam] = useState(preSelectedTeam || "");
  const [data, setData] = useState<TeamValidatorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (preSelectedTeam) setSelectedTeam(preSelectedTeam);
  }, [preSelectedTeam]);

  const fetchValidator = useCallback(() => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedRows(new Set());

    fetch(
      `/api/org-health/team-validator?team=${encodeURIComponent(selectedTeam)}&days=${days}`,
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
  }, [selectedTeam, days, adoHeaders]);

  useEffect(() => {
    fetchValidator();
  }, [fetchValidator]);

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="mb-6">
      <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-pulse-border flex items-center justify-between">
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
              {data.teamRepos.length} repos scanned
            </span>
          )}
        </div>

        <div className="p-4">
          {!selectedTeam && !loading && (
            <p className="text-[13px] text-pulse-muted text-center py-6">
              Select a team above to validate roster identity matching.
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
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Roster Size</div>
                  <div className="text-lg font-semibold text-pulse-text">{data.summary.rosterSize}</div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Found in PR Data</div>
                  <div className="text-lg font-semibold text-pulse-text">{data.summary.matchedInPRData}</div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Gap Authors</div>
                  <div className={`text-lg font-semibold ${data.summary.gapAuthorCount > 0 ? "text-amber-600" : "text-pulse-text"}`}>
                    {data.summary.gapAuthorCount}
                  </div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Possible Mismatches</div>
                  <div className={`text-lg font-semibold ${data.summary.possibleMismatches > 0 ? "text-red-600" : "text-pulse-text"}`}>
                    {data.summary.possibleMismatches}
                  </div>
                </div>
              </div>

              {/* Roster members table */}
              <div className="mb-4">
                <h4 className="text-[12px] font-medium text-pulse-text mb-2">
                  Roster Members
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-pulse-muted border-b border-pulse-border">
                        <th className="px-3 py-2 font-medium w-8"></th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Identity</th>
                        <th className="px-3 py-2 font-medium text-right">PRs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rosterMembers.map((member) => (
                        <tr
                          key={member.uniqueName}
                          className="border-b border-pulse-border/50 last:border-0"
                        >
                          <td className="px-3 py-2 text-center">
                            {member.foundInPRData ? (
                              <span className="text-emerald-500" title="Found in PR data">&#10003;</span>
                            ) : (
                              <span className="text-red-500" title="Not found in PR data">&#10007;</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-pulse-text">{member.displayName}</td>
                          <td className="px-3 py-2 font-mono text-pulse-muted">{member.uniqueName}</td>
                          <td className="px-3 py-2 text-right text-pulse-text">{member.prCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gap authors table */}
              {data.gapAuthors.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-medium text-pulse-text mb-2">
                    Gap Authors ({data.gapAuthors.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-pulse-muted border-b border-pulse-border">
                          <th className="px-3 py-2 font-medium w-8"></th>
                          <th className="px-3 py-2 font-medium">Identity</th>
                          <th className="px-3 py-2 font-medium">Display Name</th>
                          <th className="px-3 py-2 font-medium text-right">PRs</th>
                          <th className="px-3 py-2 font-medium">Possible Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.gapAuthors.map((author) => (
                          <>
                            <tr
                              key={author.uniqueName}
                              className={`border-b border-pulse-border/50 cursor-pointer hover:bg-pulse-hover/50 ${
                                author.possibleMatch ? "border-l-2 border-l-amber-400" : ""
                              }`}
                              onClick={() => toggleRow(author.uniqueName)}
                            >
                              <td className="px-3 py-2 text-center text-pulse-muted">
                                <svg
                                  className={`w-3 h-3 inline transition-transform ${
                                    expandedRows.has(author.uniqueName) ? "rotate-90" : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </td>
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
                            {expandedRows.has(author.uniqueName) && (
                              <tr key={`${author.uniqueName}-prs`}>
                                <td colSpan={5} className="px-0 py-0">
                                  <div className="bg-pulse-bg/50 px-8 py-2">
                                    <table className="w-full text-[11px]">
                                      <thead>
                                        <tr className="text-pulse-muted">
                                          <th className="text-left px-2 py-1 font-medium">PR</th>
                                          <th className="text-left px-2 py-1 font-medium">Title</th>
                                          <th className="text-left px-2 py-1 font-medium">Repo</th>
                                          <th className="text-left px-2 py-1 font-medium">Date</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {author.prs.map((pr) => (
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
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.gapAuthors.length === 0 && (
                <p className="text-[12px] text-pulse-muted text-center py-3">
                  No gap authors found — all PRs in team repos are attributed to roster members.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
