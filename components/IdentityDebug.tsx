"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { TimeRange } from "@/lib/dateRange";
import { SkeletonTable } from "./SkeletonLoader";

// ── Collapsible section wrapper ───────────────────────────────

function CollapsibleSection({
  title,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-pulse-card border border-pulse-border rounded-lg overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-pulse-hover/50 transition-colors"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-pulse-text">
              {title}
            </h3>
            {badge}
          </div>
          <p className="text-[11px] text-pulse-muted mt-0.5">{description}</p>
        </div>
        <svg
          className={`w-4 h-4 text-pulse-muted flex-shrink-0 ml-3 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-pulse-border">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Types & helpers ───────────────────────────────────────────

interface IdentityDebugProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  range: TimeRange;
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
  period: { days: number; from: string; to: string; label: string };
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

// ── Work Item Time Log Lookup types ───────────────────────────

interface WorkItemTimelogParent {
  id: number;
  title: string;
  type: string;
  classification?: string;
}

interface WorkItemTimelogEntry {
  id: string;
  date: string;
  hours: number;
  userId: string;
  uniqueName: string;
  displayName: string;
  inTeamRoster: boolean;
  rawLength: number;
  rawFields: Record<string, unknown>;
}

interface WorkItemTimelogResponse {
  workItem: {
    id: number;
    title: string;
    type: string;
    state: string;
    classification: string;
    parentChain: WorkItemTimelogParent[];
  };
  worklogs: WorkItemTimelogEntry[];
  summary: {
    totalHours: number;
    loggerCount: number;
    dateRange: { earliest: string; latest: string } | null;
  };
}

function WorkItemTimeLogLookup({
  adoHeaders,
  selectedTeam,
}: {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
}) {
  const [workItemId, setWorkItemId] = useState("");
  const [result, setResult] = useState<WorkItemTimelogResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLookup = () => {
    const id = workItemId.trim();
    if (!id || isNaN(Number(id))) return;

    setLookupLoading(true);
    setLookupError(null);
    setResult(null);
    setShowRawJson(false);

    const teamParam = selectedTeam
      ? `&team=${encodeURIComponent(selectedTeam)}`
      : "";

    fetch(
      `/api/debug/workitem-timelogs?workItemId=${id}${teamParam}`,
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
      .then((json: WorkItemTimelogResponse) => setResult(json))
      .catch((err) =>
        setLookupError(err instanceof Error ? err.message : "Lookup failed")
      )
      .finally(() => setLookupLoading(false));
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4">
      {/* Search input */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-[12px] font-medium text-pulse-text whitespace-nowrap">
          Work Item ID
        </label>
        <input
          type="number"
          value={workItemId}
          onChange={(e) => setWorkItemId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          placeholder="e.g. 183639"
          className="w-40 px-3 py-1.5 text-[12px] border border-pulse-border rounded-md bg-pulse-bg text-pulse-text placeholder:text-pulse-dim focus:outline-none focus:ring-1 focus:ring-pulse-accent"
        />
        <button
          onClick={handleLookup}
          disabled={lookupLoading || !workItemId.trim()}
          className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-pulse-accent text-white hover:bg-pulse-accent/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {lookupLoading ? "Looking up..." : "Look Up"}
        </button>
      </div>

      {/* Error */}
      {lookupError && (
        <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {lookupError}
        </div>
      )}

      {/* Loading */}
      {lookupLoading && <SkeletonTable rows={3} />}

      {/* Results */}
      {result && (
        <>
          {/* Work Item Info */}
          <div className="mb-4 bg-pulse-bg rounded-md p-4">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-[14px] font-semibold text-pulse-text">
                #{result.workItem.id}
              </span>
              <span className="text-[14px] font-medium text-pulse-text">
                {result.workItem.title}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-pulse-muted">
              <span>Type: <span className="font-medium text-pulse-text">{result.workItem.type}</span></span>
              <span>&middot;</span>
              <span>State: <span className="font-medium text-pulse-text">{result.workItem.state}</span></span>
              {result.workItem.classification !== "Unknown" && (
                <>
                  <span>&middot;</span>
                  <span>
                    Classification:{" "}
                    <span
                      className={`font-medium ${
                        result.workItem.classification === "CapEx"
                          ? "text-blue-700"
                          : result.workItem.classification === "OpEx"
                          ? "text-purple-700"
                          : "text-pulse-text"
                      }`}
                    >
                      {result.workItem.classification}
                    </span>
                  </span>
                </>
              )}
            </div>

            {/* Parent Chain */}
            {result.workItem.parentChain.length > 0 && (
              <div className="mt-3 pt-3 border-t border-pulse-border/50">
                <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1.5">
                  Parent Chain
                </div>
                <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
                  <span className="text-pulse-muted">
                    {result.workItem.type} #{result.workItem.id}
                  </span>
                  {result.workItem.parentChain.map((parent) => (
                    <span key={parent.id} className="flex items-center gap-1.5">
                      <span className="text-pulse-dim">&rarr;</span>
                      <span className="text-pulse-text font-medium">
                        {parent.type} #{parent.id}
                      </span>
                      <span className="text-pulse-muted">
                        &ldquo;{parent.title}&rdquo;
                      </span>
                      {parent.classification && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            parent.classification === "CapEx"
                              ? "text-blue-700 bg-blue-50"
                              : parent.classification === "OpEx"
                              ? "text-purple-700 bg-purple-50"
                              : ""
                          }`}
                        >
                          {parent.classification}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          {result.worklogs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-pulse-bg rounded-md p-3">
                <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Total Hours</div>
                <div className="text-lg font-semibold text-pulse-text">{result.summary.totalHours.toFixed(1)}</div>
              </div>
              <div className="bg-pulse-bg rounded-md p-3">
                <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Unique Loggers</div>
                <div className="text-lg font-semibold text-pulse-text">{result.summary.loggerCount}</div>
              </div>
              <div className="bg-pulse-bg rounded-md p-3">
                <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">Date Range</div>
                <div className="text-[13px] font-semibold text-pulse-text">
                  {result.summary.dateRange
                    ? `${formatDate(result.summary.dateRange.earliest)} — ${formatDate(result.summary.dateRange.latest)}`
                    : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Worklog Table */}
          {result.worklogs.length > 0 ? (
            <div className="mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Logged By</th>
                      <th className="px-3 py-2 font-medium text-right">Hours</th>
                      <th className="px-3 py-2 font-medium">In Roster</th>
                      <th className="px-3 py-2 font-medium text-right">Raw Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.worklogs.map((wl, i) => (
                      <tr
                        key={`${wl.id}-${i}`}
                        className="border-b border-pulse-border/50 last:border-0"
                      >
                        <td className="px-3 py-2 text-pulse-text">
                          {formatDate(wl.date)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-pulse-text">{wl.displayName}</div>
                          {wl.uniqueName !== wl.displayName && wl.uniqueName !== "Unknown" && (
                            <div className="text-[11px] font-mono text-pulse-muted">{wl.uniqueName}</div>
                          )}
                          {wl.uniqueName === "Unknown" && (
                            <div className="text-[11px] font-mono text-pulse-dim">userId: {wl.userId}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-pulse-text font-medium">
                          {wl.hours.toFixed(1)}h
                        </td>
                        <td className="px-3 py-2">
                          {wl.inTeamRoster ? (
                            <span className="text-emerald-600 font-medium text-[11px]">&#10003;</span>
                          ) : (
                            <span className="text-red-600 font-medium text-[11px]">&#10007;</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-pulse-muted">
                          {wl.rawLength}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-[13px] text-pulse-muted">
              No 7pace time entries found for work item #{result.workItem.id}
            </div>
          )}

          {/* Raw JSON Toggle */}
          <div className="border-t border-pulse-border pt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[12px] font-medium text-pulse-muted hover:text-pulse-text cursor-pointer"
              >
                {showRawJson ? "Hide" : "Show"} Raw JSON
              </button>
              {showRawJson && (
                <button
                  onClick={handleCopy}
                  className="text-[11px] font-medium text-pulse-accent hover:underline cursor-pointer"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
            {showRawJson && (
              <pre className="mt-2 bg-pulse-bg rounded-md p-3 text-[11px] font-mono text-pulse-muted overflow-x-auto max-h-96 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── User Time Log Lookup types ────────────────────────────────

interface UserTimeWorkItemEntry {
  id: string;
  date: string;
  hours: number;
  activity: string;
  uniqueName?: string;
}

interface UserTimeWorkItem {
  workItemId: number;
  title: string;
  type: string;
  state: string;
  featureId: number | null;
  featureTitle: string;
  classification: string;
  totalHours: number;
  entryCount: number;
  activities: string[];
  entries: UserTimeWorkItemEntry[];
}

interface UserTimeResponse {
  user: { id: string; email: string; displayName: string } | null;
  error?: string;
  availableUsers?: { id: string; email: string; displayName: string }[];
  summary?: {
    totalHours: number;
    workItemCount: number;
    entryCount: number;
    dateRange: { earliest: string; latest: string } | null;
    period: { from: string; to: string; days: number };
  };
  workItems?: UserTimeWorkItem[];
  _debug?: {
    fetchMode?: string;
    fetchApi?: string;
    fromTimestamp: string;
    toTimestamp: string;
    lookbackDays: number;
    userId?: string;
    rawWorklogCount?: number;
    userWorklogCount?: number;
    worklogCount?: number;
    responseKeys?: string[];
    requestUrl: string;
    pagination?: {
      pagesFetched: number;
      totalRecords: number;
      hitSafetyCap: boolean;
    };
  };
}

export function UserTimeLogLookup({
  adoHeaders,
}: {
  adoHeaders: Record<string, string>;
}) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<UserTimeResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const handleLookup = () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setLookupLoading(true);
    setLookupError(null);
    setResult(null);
    setExpandedRows(new Set());

    fetch(`/api/debug/user-time?email=${encodeURIComponent(trimmed)}`, {
      headers: adoHeaders,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || `API error: ${res.status}`);
          });
        }
        return res.json();
      })
      .then((json: UserTimeResponse) => setResult(json))
      .catch((err) =>
        setLookupError(err instanceof Error ? err.message : "Lookup failed")
      )
      .finally(() => setLookupLoading(false));
  };

  const toggleRow = (workItemId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(workItemId)) {
        next.delete(workItemId);
      } else {
        next.add(workItemId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4">
      {/* Search input */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-[12px] font-medium text-pulse-text whitespace-nowrap">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          placeholder="user@example.com"
          className="w-64 px-3 py-1.5 text-[12px] border border-pulse-border rounded-md bg-pulse-bg text-pulse-text placeholder:text-pulse-dim focus:outline-none focus:ring-1 focus:ring-pulse-accent"
        />
        <button
          onClick={handleLookup}
          disabled={lookupLoading || !email.trim()}
          className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-pulse-accent text-white hover:bg-pulse-accent/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {lookupLoading ? "Searching..." : "Search"}
        </button>
      </div>

      <p className="text-[11px] text-pulse-muted mb-4">
        Looks up all 7pace time entries for the past 30 days. Matches by email or uniqueName.
      </p>

      {/* Error */}
      {lookupError && (
        <div className="mb-4 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {lookupError}
        </div>
      )}

      {/* Loading */}
      {lookupLoading && <SkeletonTable rows={3} />}

      {/* No user found */}
      {result && !result.user && result.error && (
        <div className="mb-4 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <p className="font-medium mb-1">{result.error}</p>
          {result.availableUsers && result.availableUsers.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-amber-600 hover:underline">
                Show available users ({result.availableUsers.length})
              </summary>
              <div className="mt-1 max-h-40 overflow-y-auto">
                {result.availableUsers.map((u) => (
                  <div key={u.id} className="text-[11px] text-pulse-muted font-mono py-0.5">
                    {u.email} {u.displayName ? `(${u.displayName})` : ""}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Results */}
      {result && result.user && result.summary && result.workItems && (
        <>
          {/* User info */}
          <div className="mb-4 bg-pulse-bg rounded-md p-3">
            <div className="text-[13px] font-medium text-pulse-text">
              {result.user.displayName || result.user.email}
            </div>
            {result.user.displayName && (
              <div className="text-[11px] text-pulse-muted font-mono">
                {result.user.email}
              </div>
            )}
          </div>

          {/* Pagination cap warning */}
          {result._debug?.pagination?.hitSafetyCap && (
            <div className="mb-4 flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>Record cap reached &mdash; some entries may be missing. Try a shorter date range.</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">
                Total Hours
              </div>
              <div className="text-lg font-semibold text-pulse-text">
                {result.summary.totalHours.toFixed(1)}
              </div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">
                Work Items
              </div>
              <div className="text-lg font-semibold text-pulse-text">
                {result.summary.workItemCount}
              </div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">
                Time Entries
              </div>
              <div className="text-lg font-semibold text-pulse-text">
                {result.summary.entryCount}
              </div>
            </div>
            <div className="bg-pulse-bg rounded-md p-3">
              <div className="text-[11px] text-pulse-muted uppercase tracking-wide mb-1">
                Date Range
              </div>
              <div className="text-[13px] font-semibold text-pulse-text">
                {result.summary.dateRange
                  ? `${formatDate(result.summary.dateRange.earliest)} — ${formatDate(result.summary.dateRange.latest)}`
                  : "—"}
              </div>
            </div>
          </div>

          {/* Work Items Table */}
          {result.workItems.length > 0 ? (
            <div className="mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-pulse-muted border-b border-pulse-border">
                      <th className="px-3 py-2 font-medium w-8"></th>
                      <th className="px-3 py-2 font-medium">Work Item</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">State</th>
                      <th className="px-3 py-2 font-medium">Feature</th>
                      <th className="px-3 py-2 font-medium">Cap/Op</th>
                      <th className="px-3 py-2 font-medium text-right">Hours</th>
                      <th className="px-3 py-2 font-medium text-right">Entries</th>
                      <th className="px-3 py-2 font-medium">Activities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.workItems.map((wi) => (
                      <>
                        <tr
                          key={wi.workItemId}
                          className="border-b border-pulse-border/50 last:border-0 hover:bg-pulse-hover/30 cursor-pointer"
                          onClick={() => toggleRow(wi.workItemId)}
                        >
                          <td className="px-3 py-2">
                            <svg
                              className={`w-3 h-3 text-pulse-muted transition-transform duration-150 ${
                                expandedRows.has(wi.workItemId) ? "rotate-90" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-pulse-text font-medium">
                              {wi.workItemId > 0 ? `#${wi.workItemId}` : ""}{" "}
                              {wi.title}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-pulse-muted">
                            {wi.type}
                          </td>
                          <td className="px-3 py-2 text-pulse-muted">
                            {wi.state}
                          </td>
                          <td className="px-3 py-2">
                            {wi.featureId ? (
                              <span className="text-pulse-text text-[11px]">
                                #{wi.featureId}{" "}
                                <span className="text-pulse-muted">{wi.featureTitle}</span>
                              </span>
                            ) : (
                              <span className="text-pulse-dim text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                                wi.classification === "CapEx"
                                  ? "text-blue-700 bg-blue-50"
                                  : wi.classification === "OpEx"
                                  ? "text-purple-700 bg-purple-50"
                                  : "text-pulse-dim"
                              }`}
                            >
                              {wi.classification}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-pulse-text font-medium">
                            {wi.totalHours.toFixed(1)}h
                          </td>
                          <td className="px-3 py-2 text-right text-pulse-muted">
                            {wi.entryCount}
                          </td>
                          <td className="px-3 py-2 text-pulse-muted">
                            {wi.activities.join(", ")}
                          </td>
                        </tr>
                        {expandedRows.has(wi.workItemId) && (
                          <tr key={`${wi.workItemId}-entries`}>
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-pulse-bg/50 border-y border-pulse-border/30">
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="text-left text-pulse-dim">
                                      <th className="pl-12 pr-3 py-1.5 font-medium">
                                        Date
                                      </th>
                                      <th className="px-3 py-1.5 font-medium">
                                        User
                                      </th>
                                      <th className="px-3 py-1.5 font-medium text-right">
                                        Hours
                                      </th>
                                      <th className="px-3 py-1.5 font-medium">
                                        Activity
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {wi.entries.map((entry, idx) => (
                                      <tr
                                        key={`${entry.id}-${idx}`}
                                        className="border-t border-pulse-border/20"
                                      >
                                        <td className="pl-12 pr-3 py-1.5 text-pulse-muted">
                                          {formatDate(entry.date)}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-pulse-muted text-[10px]">
                                          {entry.uniqueName || "—"}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-pulse-text font-medium">
                                          {entry.hours.toFixed(2)}h
                                        </td>
                                        <td className="px-3 py-1.5 text-pulse-muted">
                                          {entry.activity}
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
          ) : (
            <div className="text-center py-6 text-[13px] text-pulse-muted">
              No time entries found for {result.user.email} in the last 30 days.
            </div>
          )}

          {/* API Debug panel */}
          {result._debug && (
            <div className="mt-3 p-3 bg-pulse-bg border border-pulse-border rounded-md text-[11px] font-mono text-pulse-muted space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-pulse-dim uppercase tracking-wide text-[10px]">
                  API Debug
                </span>
                {result._debug.fetchApi && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    result._debug.fetchApi === "odata"
                      ? "text-blue-700 bg-blue-50"
                      : "text-pulse-dim bg-pulse-bg"
                  }`}>
                    {result._debug.fetchApi}
                  </span>
                )}
              </div>
              <div>
                <span className="text-pulse-dim">fromTimestamp </span>
                {result._debug.fromTimestamp}
              </div>
              <div>
                <span className="text-pulse-dim">toTimestamp   </span>
                {result._debug.toTimestamp}
              </div>
              <div>
                <span className="text-pulse-dim">lookbackDays  </span>
                {result._debug.lookbackDays}
              </div>
              {result._debug.userId && (
                <div>
                  <span className="text-pulse-dim">userId        </span>
                  {result._debug.userId}
                </div>
              )}
              <div>
                <span className="text-pulse-dim">worklogs      </span>
                {result._debug.worklogCount ?? result._debug.userWorklogCount ?? "—"}
                <span className="text-pulse-dim"> (filtered to user)</span>
              </div>
              {result._debug.pagination && (
                <div>
                  <span className="text-pulse-dim">pagination    </span>
                  {result._debug.pagination.pagesFetched} page(s), {result._debug.pagination.totalRecords} records
                  {result._debug.pagination.hitSafetyCap && (
                    <span className="text-amber-600 font-medium"> (CAP HIT)</span>
                  )}
                </div>
              )}
              <div className="pt-1 break-all">
                <span className="text-pulse-dim">requestUrl </span>
                {result._debug.requestUrl}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export function IdentityDebug({ adoHeaders, selectedTeam, range }: IdentityDebugProps) {
  const [data, setData] = useState<IdentityCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);

    fetch(
      `/api/debug/identity-check?team=${encodeURIComponent(selectedTeam)}&range=${range}`,
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
  }, [selectedTeam, range, adoHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const matched = data?.rosterMembers.filter((m) => m.matchType !== "none").length ?? 0;
  const unmatched = data?.rosterMembers.filter((m) => m.matchType === "none").length ?? 0;

  return (
    <>
      {/* ── Work Item Time Log Lookup (first) ──────────────── */}
      <CollapsibleSection
        title="Work Item Time Log Lookup"
        description="Look up 7pace time entries for a specific ADO work item."
      >
        <WorkItemTimeLogLookup adoHeaders={adoHeaders} selectedTeam={selectedTeam} />
      </CollapsibleSection>

      {/* ── User Time Log Lookup (second) ─────────────────── */}
      <CollapsibleSection
        title="User Time Log Lookup"
        description="Look up all 7pace time entries for a specific user by email (last 30 days)."
      >
        <UserTimeLogLookup adoHeaders={adoHeaders} />
      </CollapsibleSection>

      {/* ── Identity Debug (third) ─────────────────────────── */}
      <CollapsibleSection
        title="Identity Debug"
        description="Raw ADO identity values — diagnose matching issues."
        badge={
          selectedTeam ? (
            <span className="text-[12px] font-medium text-pulse-accent">{selectedTeam}</span>
          ) : undefined
        }
      >
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
              {/* Period info */}
              <div className="mb-4 text-[11px] text-pulse-dim text-right">
                {data.period.label} &middot; {data.prAuthors.length} unique PR authors
              </div>

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
      </CollapsibleSection>
    </>
  );
}
