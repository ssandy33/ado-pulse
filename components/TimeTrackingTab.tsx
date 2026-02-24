"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type { TeamTimeData, MemberTimeEntry, WrongLevelEntry, TimeTrackingDiagnostics, GovernanceData, ExpenseType } from "@/lib/ado/types";
import { KPICard } from "./KPICard";
import { SkeletonKPIRow, SkeletonTable } from "./SkeletonLoader";
import { EmailTooltip } from "./EmailTooltip";

interface TimeTrackingTabProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  range: TimeRange;
}

function WorkItemLinkCell({ id, org, project }: {
  id: number | null;
  org: string;
  project: string;
}) {
  if (!id || !org || !project) return <td className="px-2 py-1.5 w-8" />;
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${id}`;
  return (
    <td className="px-2 py-1.5 text-right w-8">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open work item #${id} in new tab`}
        onClick={(e) => e.stopPropagation()}
        className="text-pulse-muted hover:text-pulse-text"
      >
        <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true" focusable="false">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </td>
  );
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

function WrongLevelBanner({ entries, org, project }: { entries: WrongLevelEntry[]; org: string; project: string }) {
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
            These worklogs are logged on Tasks/Stories/Bugs instead of their parent Feature. Time is still counted but should be logged at the Feature level.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-amber-700 border-b border-amber-200">
                  <th className="px-2 py-1.5 font-medium">Work Item</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                  <th className="px-2 py-1.5 font-medium">Member</th>
                  <th className="px-2 py-1.5 font-medium text-right">Hours</th>
                  <th className="px-2 py-1.5 w-8" />
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
                    <WorkItemLinkCell id={entry.workItemId} org={org} project={project} />
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

function MemberRow({ member, isExpanded, onToggle, org, project }: {
  member: MemberTimeEntry;
  isExpanded: boolean;
  onToggle: () => void;
  org: string;
  project: string;
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
                <EmailTooltip displayName={member.displayName} email={member.uniqueName} />
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
                    <th className="px-2 py-1 w-8" />
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
                      <WorkItemLinkCell id={f.featureId} org={org} project={project} />
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

// ── Feature Breakdown View ────────────────────────────────────────

interface FeatureRowData {
  featureId: number | null;
  featureTitle: string;
  expenseType: ExpenseType;
  totalHours: number;
  members: {
    displayName: string;
    uniqueName: string;
    hours: number;
    loggedAtWrongLevel: boolean;
    originalWorkItemId?: number;
    originalWorkItemType?: string;
  }[];
  hasWrongLevelLogs: boolean;
  isNoFeature: boolean;
}

function buildFeatureRows(members: MemberTimeEntry[]): FeatureRowData[] {
  const map = new Map<string, FeatureRowData>();

  for (const member of members) {
    for (const feature of member.features) {
      const key = feature.featureId !== null ? `${feature.featureId}` : "none";

      if (!map.has(key)) {
        map.set(key, {
          featureId: feature.featureId,
          featureTitle: feature.featureTitle,
          expenseType: feature.expenseType,
          totalHours: 0,
          members: [],
          hasWrongLevelLogs: false,
          isNoFeature: feature.featureId === null,
        });
      }

      const row = map.get(key)!;
      row.totalHours += feature.hours;
      row.members.push({
        displayName: member.displayName,
        uniqueName: member.uniqueName,
        hours: feature.hours,
        loggedAtWrongLevel: feature.loggedAtWrongLevel,
        originalWorkItemId: feature.originalWorkItemId,
        originalWorkItemType: feature.originalWorkItemType,
      });
      if (feature.loggedAtWrongLevel) row.hasWrongLevelLogs = true;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isNoFeature !== b.isNoFeature) return a.isNoFeature ? 1 : -1;
    return b.totalHours - a.totalHours;
  });
}

function FeatureBreakdownRow({ row, isExpanded, onToggle, org, project }: {
  row: FeatureRowData;
  isExpanded: boolean;
  org: string;
  project: string;
  onToggle: () => void;
}) {
  const memberCount = row.members.length;

  return (
    <>
      <tr
        className="border-b border-pulse-border/50 cursor-pointer hover:bg-pulse-hover/50"
        onClick={onToggle}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <svg
              className={`w-3 h-3 text-pulse-muted transition-transform flex-shrink-0 ${
                isExpanded ? "rotate-90" : ""
              }`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[13px] font-medium text-pulse-text">
              {row.isNoFeature ? (
                <span className="text-amber-700">Unclassified — no parent feature</span>
              ) : (
                <>{row.featureTitle} {row.featureId ? `#${row.featureId}` : ""}</>
              )}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          {row.isNoFeature ? (
            <span className="text-[10px] font-medium text-pulse-muted bg-pulse-bg px-1.5 py-0.5 rounded">—</span>
          ) : (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                row.expenseType === "CapEx"
                  ? "text-blue-700 bg-blue-50"
                  : row.expenseType === "OpEx"
                  ? "text-purple-700 bg-purple-50"
                  : "text-pulse-muted bg-pulse-bg"
              }`}
            >
              {row.expenseType}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text font-medium">
          {row.totalHours.toFixed(1)}
        </td>
        <td className="px-4 py-2.5 text-right text-[13px] text-pulse-text">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </td>
        <td className="px-4 py-2.5 text-right">
          {row.isNoFeature ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              No Feature
            </span>
          ) : row.hasWrongLevelLogs ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              Wrong Level
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </td>
        <WorkItemLinkCell id={row.featureId} org={org} project={project} />
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-0 py-0">
            <div className="bg-pulse-bg/50 px-8 py-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-pulse-muted">
                    <th className="text-left px-2 py-1 font-medium">Member</th>
                    <th className="text-right px-2 py-1 font-medium">Hours</th>
                    <th className="text-left px-2 py-1 font-medium">Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {[...row.members]
                    .sort((a, b) => b.hours - a.hours)
                    .map((m) => (
                    <tr key={m.uniqueName} className="border-t border-pulse-border/30">
                      <td className="px-2 py-1 text-pulse-text">{m.displayName}</td>
                      <td className="px-2 py-1 text-right text-pulse-text">{m.hours.toFixed(1)}</td>
                      <td className="px-2 py-1">
                        {m.loggedAtWrongLevel ? (
                          <span className="text-amber-600">
                            Logged on {m.originalWorkItemType} #{m.originalWorkItemId}
                          </span>
                        ) : (
                          <span className="text-emerald-600">Feature level</span>
                        )}
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
  );
}

export function TimeTrackingTab({
  adoHeaders,
  selectedTeam,
  range,
}: TimeTrackingTabProps) {
  const org = adoHeaders["x-ado-org"] || "";
  const project = adoHeaders["x-ado-project"] || "";
  const [data, setData] = useState<TeamTimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [breakdownView, setBreakdownView] = useState<"member" | "feature">("member");

  const featureRows = useMemo(() => {
    if (!data) return [];
    return buildFeatureRows(data.members);
  }, [data]);

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
              subtitle={
                data.governance ? (
                  <span>
                    <span className={data.governance.isCompliant ? "text-emerald-600" : "text-amber-600"}>
                      {data.governance.compliancePct.toFixed(1)}%
                    </span>
                    {" "}of {data.governance.expectedHours.toFixed(0)}h expected
                    <span className="text-pulse-muted ml-1">
                      ({data.governance.businessDays}d &times; {data.governance.activeMembers} members)
                    </span>
                  </span>
                ) : (
                  data.period.label
                )
              }
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
          <WrongLevelBanner entries={data.wrongLevelEntries} org={org} project={project} />

          {/* View Toggle */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1 bg-pulse-bg rounded-lg p-1">
              <button
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${
                  breakdownView === "member"
                    ? "bg-pulse-card text-pulse-text shadow-sm"
                    : "text-pulse-muted hover:text-pulse-text"
                }`}
                onClick={() => { setBreakdownView("member"); setExpandedRow(null); }}
              >
                Member View
              </button>
              <button
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors cursor-pointer ${
                  breakdownView === "feature"
                    ? "bg-pulse-card text-pulse-text shadow-sm"
                    : "text-pulse-muted hover:text-pulse-text"
                }`}
                onClick={() => { setBreakdownView("feature"); setExpandedRow(null); }}
              >
                Feature View
              </button>
            </div>
          </div>

          {/* Member Table */}
          {breakdownView === "member" && (
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
                      org={org}
                      project={project}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Feature Table */}
          {breakdownView === "feature" && (
          <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-pulse-border">
              <h3 className="text-[13px] font-semibold text-pulse-text">
                Feature Breakdown
              </h3>
              <p className="text-[11px] text-pulse-muted mt-0.5">
                Click a row to expand member-level breakdown. Hours from 7pace Timetracker.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-pulse-muted border-b border-pulse-border">
                    <th className="px-4 py-2.5 font-medium">Feature</th>
                    <th className="px-4 py-2.5 font-medium">Classification</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total Hours</th>
                    <th className="px-4 py-2.5 font-medium text-right">Members</th>
                    <th className="px-4 py-2.5 font-medium text-right">Status</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row) => {
                    const key = row.featureId !== null ? `f-${row.featureId}` : "f-none";
                    return (
                      <FeatureBreakdownRow
                        key={key}
                        row={row}
                        isExpanded={expandedRow === key}
                        onToggle={() =>
                          setExpandedRow((prev) => prev === key ? null : key)
                        }
                        org={org}
                        project={project}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

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
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Fetch Mode</div>
              <div className="text-lg font-semibold text-pulse-text">{diag.fetchMode}</div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Members Fetched</div>
              <div className="text-lg font-semibold text-pulse-text">{diag.membersFetched}</div>
            </div>
            {diag.fetchApi && (
              <div className="bg-pulse-bg rounded-md p-3">
                <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Fetch API</div>
                <div className={`text-lg font-semibold ${diag.fetchApi === "odata" ? "text-blue-600" : "text-pulse-text"}`}>
                  {diag.fetchApi}
                </div>
              </div>
            )}
            {diag.pagination && (
              <>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Pages Fetched</div>
                  <div className="text-lg font-semibold text-pulse-text">{diag.pagination.totalPagesFetched}</div>
                </div>
                <div className="bg-pulse-bg rounded-md p-3">
                  <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Records Fetched</div>
                  <div className="text-lg font-semibold text-pulse-text">{diag.pagination.totalRecordsFetched}</div>
                </div>
              </>
            )}
          </div>

          {/* Pagination cap warning */}
          {diag.pagination?.anyMemberHitCap && (
            <div className="flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>At least one team member hit the pagination cap. Their hours may be incomplete.</span>
            </div>
          )}

          {/* Members with no 7pace ID */}
          {diag.membersWithNoSpId.length > 0 && (
            <div>
              <h4 className="text-[12px] font-medium text-pulse-text mb-1">
                Members Without 7pace User ID ({diag.membersWithNoSpId.length})
              </h4>
              <div className="bg-pulse-bg rounded-md p-3 space-y-0.5">
                {diag.membersWithNoSpId.map((name) => (
                  <div key={name} className="text-[11px] font-mono text-amber-600">{name}</div>
                ))}
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

        </div>
      )}
    </div>
  );
}
