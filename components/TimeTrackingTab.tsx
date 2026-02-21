"use client";

import { useState, useEffect, useCallback } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type { TeamTimeData, MemberTimeEntry, WrongLevelEntry, TimeTrackingDiagnostics } from "@/lib/ado/types";
import { KPICard } from "./KPICard";
import { SkeletonKPIRow, SkeletonTable } from "./SkeletonLoader";

interface TimeTrackingTabProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  range: TimeRange;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function StatusBadge({ status }: { status: "logged" | "not-logging" | "excluded" }) {
  if (status === "logged") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Logged
      </span>
    );
  }
  if (status === "not-logging") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Not logging
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pulse-muted bg-pulse-bg px-2 py-0.5 rounded-full">
      Excluded
    </span>
  );
}

function WrongLevelBanner({ entries }: { entries: WrongLevelEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-[13px] font-medium text-amber-800">
            {entries.length} worklog{entries.length !== 1 ? "s" : ""} logged at wrong level ({totalHours.toFixed(1)}h)
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-amber-600 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-amber-700 mb-2">
            These worklogs are logged directly on Features instead of child Tasks/Stories. Time is still counted but the practice should be corrected.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-amber-700 border-b border-amber-200">
                  <th className="px-2 py-1.5 font-medium">Work Item</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                  <th className="px-2 py-1.5 font-medium">Member</th>
                  <th className="px-2 py-1.5 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={`${entry.workItemId}-${i}`} className="border-b border-amber-100 last:border-0">
                    <td className="px-2 py-1.5 text-amber-900">
                      #{entry.workItemId} {entry.title}
                    </td>
                    <td className="px-2 py-1.5 text-amber-700">{entry.workItemType}</td>
                    <td className="px-2 py-1.5 text-amber-700">{entry.memberName}</td>
                    <td className="px-2 py-1.5 text-right text-amber-900">{entry.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isExpanded, onToggle }: {
  member: MemberTimeEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasFeatures = member.features.length > 0;
  const status: "logged" | "not-logging" | "excluded" = member.isExcluded
    ? "excluded"
    : member.totalHours > 0
    ? "logged"
    : "not-logging";

  return (
    <>
      <tr
        className={`border-b border-pulse-border/50 ${
          member.isExcluded ? "opacity-50" : ""
        } ${hasFeatures ? "cursor-pointer hover:bg-pulse-hover/50" : ""}`}
        onClick={() => hasFeatures && onToggle()}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            {hasFeatures && (
              <svg
                className={`w-3 h-3 text-pulse-muted transition-transform flex-shrink-0 ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            <div>
              <span className="text-[13px] font-medium text-pulse-text">
                {member.displayName}
              </span>
              {member.isExcluded && member.role && (
                <span className="ml-2 text-[10px] font-medium text-pulse-muted bg-pulse-bg px-1.5 py-0.5 rounded">
                  {member.role}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text font-medium">
          {member.totalHours.toFixed(1)}
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text">
          {member.capExHours.toFixed(1)}
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text">
          {member.opExHours.toFixed(1)}
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text">
          {member.unclassifiedHours.toFixed(1)}
        </td>
        <td className="px-4 py-2.5 text-right">
          <StatusBadge status={status} />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-0 py-0">
            <div className="bg-pulse-bg/50 px-8 py-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-pulse-muted">
                    <th className="text-left px-2 py-1 font-medium">Feature</th>
                    <th className="text-left px-2 py-1 font-medium">Type</th>
                    <th className="text-right px-2 py-1 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {member.features.map((f) => (
                    <tr
                      key={f.featureId ?? "none"}
                      className="border-t border-pulse-border/30"
                    >
                      <td className="px-2 py-1 text-pulse-text">
                        {f.featureId ? `#${f.featureId} ` : ""}
                        {f.featureTitle}
                        {f.loggedAtWrongLevel && (
                          <span className="ml-1 text-[10px] text-amber-600">(wrong level)</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            f.expenseType === "CapEx"
                              ? "text-blue-700 bg-blue-50"
                              : f.expenseType === "OpEx"
                              ? "text-purple-700 bg-purple-50"
                              : "text-pulse-muted bg-pulse-bg"
                          }`}
                        >
                          {f.expenseType}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right text-pulse-text">{f.hours.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function TimeTrackingTab({
  adoHeaders,
  selectedTeam,
  range,
}: TimeTrackingTabProps) {
  const [data, setData] = useState<TeamTimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedRow(null);

    fetch(
      `/api/timetracking/team-summary?team=${encodeURIComponent(selectedTeam)}&range=${range}`,
      { headers: adoHeaders }
    )
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || `API error: ${res.status}`);
          });
        }
        return res.json();
      })
      .then((json: TeamTimeData) => setData(json))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [selectedTeam, range, adoHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Empty state: no team selected
  if (!selectedTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-pulse-accent/10 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-pulse-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-[15px] font-semibold text-pulse-text mb-1">
          Select a team to view time tracking
        </h2>
        <p className="text-[13px] text-pulse-muted max-w-[280px]">
          Choose a team from the dropdown above to see hours logged per member with CapEx/OpEx classification.
        </p>
      </div>
    );
  }

  // 7pace not configured
  if (data && !data.sevenPaceConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 00-6.364-6.364L4.757 8.25a4.5 4.5 0 003.182 7.682"
            />
          </svg>
        </div>
        <h2 className="text-[15px] font-semibold text-pulse-text mb-1">
          7pace Timetracker not configured
        </h2>
        <p className="text-[13px] text-pulse-muted max-w-[320px]">
          Go to <span className="font-medium text-pulse-text">Settings &gt; Integrations</span> to
          connect your 7pace API token and enable time tracking data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Error state */}
      {error && (
        <div className="bg-pulse-red-bg border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-pulse-red">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-[12px] font-medium text-pulse-red hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <>
          <SkeletonKPIRow />
          <SkeletonTable rows={6} />
        </>
      )}

      {/* Data loaded */}
      {data && data.sevenPaceConnected && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Total Hours"
              value={data.summary.totalHours.toFixed(1)}
              subtitle={data.period.label}
            />
            <KPICard
              title="CapEx Hours"
              value={data.summary.capExHours.toFixed(1)}
              subtitle={
                <span className="text-blue-600">
                  {pct(data.summary.capExHours, data.summary.totalHours)}
                </span>
              }
            />
            <KPICard
              title="OpEx Hours"
              value={data.summary.opExHours.toFixed(1)}
              subtitle={
                <span className="text-purple-600">
                  {pct(data.summary.opExHours, data.summary.totalHours)}
                </span>
              }
            />
            <KPICard
              title="Not Logging"
              value={data.summary.membersNotLogging}
              subtitle={
                data.summary.membersNotLogging > 0 ? (
                  <span className="text-red-600">
                    {data.summary.membersNotLogging} of {data.team.totalMembers} members
                  </span>
                ) : (
                  <span className="text-emerald-600">all members logging</span>
                )
              }
            />
          </div>

          {/* Wrong-Level Banner */}
          <WrongLevelBanner entries={data.wrongLevelEntries} />

          {/* Member Table */}
          <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-pulse-border">
              <h3 className="text-[13px] font-semibold text-pulse-text">
                Member Time Breakdown
              </h3>
              <p className="text-[11px] text-pulse-muted mt-0.5">
                Click a row to expand feature-level breakdown. Hours from 7pace Timetracker.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-pulse-muted border-b border-pulse-border">
                    <th className="px-4 py-2.5 font-medium">Member</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total</th>
                    <th className="px-4 py-2.5 font-medium text-right">CapEx</th>
                    <th className="px-4 py-2.5 font-medium text-right">OpEx</th>
                    <th className="px-4 py-2.5 font-medium text-right">Unclassified</th>
                    <th className="px-4 py-2.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <MemberRow
                      key={member.uniqueName}
                      member={member}
                      isExpanded={expandedRow === member.uniqueName}
                      onToggle={() =>
                        setExpandedRow((prev) =>
                          prev === member.uniqueName ? null : member.uniqueName
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pipeline Diagnostics */}
          {data.diagnostics && <PipelineDiagnostics diag={data.diagnostics} />}
        </>
      )}
    </>
  );
}

function PipelineDiagnostics({ diag }: { diag: TimeTrackingDiagnostics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-pulse-hover/50"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-pulse-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[13px] font-medium text-pulse-text">Pipeline Diagnostics</span>
          <span className="text-[11px] text-pulse-muted">
            {diag.totalWorklogsFromSevenPace} worklogs fetched, {diag.worklogsMatchedToTeam} matched to team
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-pulse-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Pipeline counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">7pace Users</div>
              <div className="text-lg font-semibold text-pulse-text">{diag.sevenPaceUsersTotal}</div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Total Worklogs</div>
              <div className="text-lg font-semibold text-pulse-text">{diag.totalWorklogsFromSevenPace}</div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Matched to Team</div>
              <div className={`text-lg font-semibold ${diag.worklogsMatchedToTeam > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {diag.worklogsMatchedToTeam}
              </div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Unmapped User IDs</div>
              <div className={`text-lg font-semibold ${diag.unmappedUserIdCount > 0 ? "text-amber-600" : "text-pulse-text"}`}>
                {diag.unmappedUserIdCount}
              </div>
            </div>
          </div>

          {/* API Request Info */}
          {diag.worklogsRequestUrl && (
            <div>
              <h4 className="text-[12px] font-medium text-pulse-text mb-1">7pace Worklogs Request</h4>
              <div className="bg-pulse-bg rounded-md p-3 space-y-1.5">
                <div className="text-[11px] font-mono text-pulse-muted break-all">{diag.worklogsRequestUrl}</div>
                <div className="flex gap-4 text-[11px]">
                  <span className="text-pulse-muted">
                    Response keys: <span className="font-mono text-pulse-text">{(diag.worklogsRawResponseKeys ?? []).join(", ") || "none"}</span>
                  </span>
                  <span className="text-pulse-muted">
                    Raw count: <span className={`font-semibold ${(diag.worklogsRawCount ?? 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>{diag.worklogsRawCount ?? 0}</span>
                  </span>
                  {diag.worklogsUnfilteredCount !== undefined && (
                    <span className="text-pulse-muted">
                      Unfiltered probe: <span className={`font-semibold ${diag.worklogsUnfilteredCount > 0 ? "text-emerald-600" : diag.worklogsUnfilteredCount === -1 ? "text-red-600" : "text-amber-600"}`}>
                        {diag.worklogsUnfilteredCount === -1 ? "error" : diag.worklogsUnfilteredCount}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Roster uniqueNames */}
          <div>
            <h4 className="text-[12px] font-medium text-pulse-text mb-1">Team Roster (uniqueNames)</h4>
            <div className="bg-pulse-bg rounded-md p-3 space-y-0.5">
              {diag.rosterUniqueNames.map((name) => (
                <div key={name} className="text-[11px] font-mono text-pulse-muted">{name}</div>
              ))}
            </div>
          </div>

          {/* 7pace users */}
          {diag.sevenPaceUsers.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                7pace Users (first {diag.sevenPaceUsers.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border">
                      <th className="px-2 py-1 font-medium">7pace ID</th>
                      <th className="px-2 py-1 font-medium">Resolved uniqueName</th>
                      <th className="px-2 py-1 font-medium">On Roster?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.sevenPaceUsers.map((u) => {
                      const onRoster = diag.rosterUniqueNames.includes(u.uniqueName.toLowerCase());
                      return (
                        <tr key={u.id} className="border-b border-pulse-border/30">
                          <td className="px-2 py-1 font-mono text-pulse-dim">{u.id.slice(0, 12)}...</td>
                          <td className="px-2 py-1 font-mono text-pulse-muted">{u.uniqueName}</td>
                          <td className="px-2 py-1">
                            {onRoster ? (
                              <span className="text-emerald-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-red-600 font-medium">No</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sample worklogs */}
          {diag.sampleWorklogs.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                Sample Worklogs (first {diag.sampleWorklogs.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border">
                      <th className="px-2 py-1 font-medium">7pace userId</th>
                      <th className="px-2 py-1 font-medium">Resolved Name</th>
                      <th className="px-2 py-1 font-medium">Work Item</th>
                      <th className="px-2 py-1 font-medium text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.sampleWorklogs.map((wl, i) => (
                      <tr key={i} className="border-b border-pulse-border/30">
                        <td className="px-2 py-1 font-mono text-pulse-dim">{wl.userId.slice(0, 12)}...</td>
                        <td className="px-2 py-1 font-mono text-pulse-muted">{wl.resolvedUniqueName ?? "unmapped"}</td>
                        <td className="px-2 py-1 text-pulse-muted">#{wl.workItemId}</td>
                        <td className="px-2 py-1 text-right text-pulse-text">{wl.hours.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mapped but not on team */}
          {diag.mappedButNotOnTeam.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                Mapped but Not on Team ({diag.mappedButNotOnTeamCount})
              </h4>
              <div className="bg-pulse-bg rounded-md p-3 space-y-0.5">
                {diag.mappedButNotOnTeam.map((name) => (
                  <div key={name} className="text-[11px] font-mono text-amber-600">{name}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
