"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type { TeamSummaryApiResponse, StalePRResponse, AlignmentApiResponse, MemberProfile } from "@/lib/ado/types";
import {
  filterMembersByAgency,
  computeFilteredTeamKPIs,
  filterAlignmentData,
  filterDiagnostics,
  filterStalePRData,
} from "@/lib/agencyFilterUtils";
import { TeamSelector } from "./TeamSelector";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { TabBar, type TabKey } from "./TabBar";
import { KPICard } from "./KPICard";
import { MemberTable } from "./MemberTable";
import { RepoTable } from "./RepoTable";
import { StalePRTable } from "./StalePRTable";
import { OrgHealthView } from "./OrgHealthView";
import { DataConfidencePanel } from "./DataConfidencePanel";
import { IdentityDebug } from "./IdentityDebug";
import { SettingsPage } from "./SettingsPage";
import { TimeTrackingTab } from "./TimeTrackingTab";
import { AlignmentKPITile } from "./AlignmentKPITile";
import { SkeletonKPIRow, SkeletonTable } from "./SkeletonLoader";

interface DashboardProps {
  creds: { org: string; project: string; pat: string };
  onDisconnect: () => void;
}

export function Dashboard({ creds, onDisconnect }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("team");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [range, setRange] = useState<TimeRange>("14");
  const [data, setData] = useState<TeamSummaryApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [stalePRData, setStalePRData] = useState<StalePRResponse | null>(null);
  const [stalePRLoading, setStalePRLoading] = useState(false);
  const [alignmentData, setAlignmentData] = useState<AlignmentApiResponse | null>(null);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);
  const [validatorTeam, setValidatorTeam] = useState("");
  const [agencyLookup, setAgencyLookup] = useState<Map<string, MemberProfile>>(new Map());
  const [agencyFilter, setAgencyFilter] = useState<Set<string>>(new Set());

  const adoHeaders = useMemo(
    () => ({
      "x-ado-org": creds.org,
      "x-ado-project": creds.project,
      "x-ado-pat": creds.pat,
    }),
    [creds]
  );

  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!selectedTeam) return;

    // Increment request ID so stale responses are ignored
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setData(null);
    setStalePRData(null);
    setAlignmentData(null);
    setAlignmentError(null);
    setAgencyFilter(new Set());

    const fetchOpts = { headers: adoHeaders, cache: "no-store" as RequestCache };

    // Fire team-summary, stale PR, and alignment fetch in parallel
    const summaryPromise = fetch(
      `/api/prs/team-summary?range=${range}&team=${encodeURIComponent(selectedTeam)}`,
      fetchOpts
    );

    const stalePromise = fetch(
      `/api/prs/stale?team=${encodeURIComponent(selectedTeam)}`,
      fetchOpts
    );

    const alignmentPromise = fetch(
      `/api/prs/team-alignment?range=${range}&team=${encodeURIComponent(selectedTeam)}`,
      fetchOpts
    );

    try {
      const res = await summaryPromise;
      if (requestIdRef.current !== requestId) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json: TeamSummaryApiResponse = await res.json();
      setData(json);
      setRefreshedAt(new Date());
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }

    // Await stale PR result (already in-flight)
    if (requestIdRef.current === requestId) setStalePRLoading(true);
    try {
      const staleRes = await stalePromise;
      if (requestIdRef.current !== requestId) return;
      if (staleRes.ok) {
        const json: StalePRResponse = await staleRes.json();
        setStalePRData(json);
      }
    } catch {
      // Stale PR fetch failures are silent (non-critical section)
    } finally {
      if (requestIdRef.current === requestId) setStalePRLoading(false);
    }

    // Await alignment result (already in-flight)
    if (requestIdRef.current === requestId) setAlignmentLoading(true);
    try {
      const alignRes = await alignmentPromise;
      if (requestIdRef.current !== requestId) return;
      if (alignRes.ok) {
        const json: AlignmentApiResponse = await alignRes.json();
        setAlignmentData(json);
      } else {
        const body = await alignRes.json().catch(() => ({}));
        setAlignmentError(
          body.error || "Failed to load alignment data"
        );
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.debug("Alignment fetch failed:", err);
    } finally {
      if (requestIdRef.current === requestId) setAlignmentLoading(false);
    }
  }, [selectedTeam, range, adoHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMemberProfiles = useCallback(() => {
    fetch("/api/settings/members")
      .then((res) => res.json())
      .then((data: { profiles: MemberProfile[] }) => {
        setAgencyLookup(new Map(data.profiles.map((p) => [p.adoId, p])));
      })
      .catch(() => {}); // Non-critical — table renders without badges
  }, []);

  // Fetch on mount and re-fetch when returning to Team tab (picks up settings edits)
  useEffect(() => {
    if (activeTab === "team") {
      loadMemberProfiles();
    }
  }, [activeTab, loadMemberProfiles]);

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
  };

  const handleRangeChange = (r: TimeRange) => {
    setRange(r);
  };

  // ── Filtered data derivations ──────────────────────────────────
  const filteredTeamMembers = useMemo(() => {
    if (!data) return [];
    return filterMembersByAgency(
      data.members,
      agencyFilter,
      agencyLookup,
      (m) => m.id
    );
  }, [data, agencyFilter, agencyLookup]);

  const filteredKPIs = useMemo(() => {
    if (!data) return null;
    if (agencyFilter.size === 0) return null; // use original data
    return computeFilteredTeamKPIs(filteredTeamMembers);
  }, [data, agencyFilter, filteredTeamMembers]);

  const filteredUniqueNames = useMemo(() => {
    if (agencyFilter.size === 0) return new Set<string>();
    return new Set(filteredTeamMembers.map((m) => m.uniqueName.toLowerCase()));
  }, [agencyFilter, filteredTeamMembers]);

  const filteredAlignmentData = useMemo(() => {
    if (!alignmentData) return null;
    return filterAlignmentData(alignmentData, filteredUniqueNames);
  }, [alignmentData, filteredUniqueNames]);

  const filteredDiagnosticsData = useMemo(() => {
    if (!data?.diagnostics) return null;
    return filterDiagnostics(data.diagnostics, filteredUniqueNames);
  }, [data, filteredUniqueNames]);

  const filteredStalePRs = useMemo(() => {
    if (!stalePRData) return null;
    return filterStalePRData(stalePRData, filteredUniqueNames);
  }, [stalePRData, filteredUniqueNames]);

  const mostActiveRepo = useMemo(() => {
    if (!data) return null;
    if (filteredKPIs) return filteredKPIs.mostActiveRepo;
    return data.byRepo.length > 0 ? data.byRepo[0] : null;
  }, [data, filteredKPIs]);

  return (
    <div className="min-h-screen bg-pulse-bg">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-lg font-semibold text-pulse-text">
                PR Hygiene
              </h1>
              <div className="flex items-center gap-1.5 text-[13px] text-pulse-muted mt-0.5">
                <span>{creds.org}</span>
                <span className="text-pulse-dim">/</span>
                <span>{creds.project}</span>
                <span className="text-pulse-dim">/</span>
                <TeamSelector
                  selectedTeam={selectedTeam}
                  onTeamChange={handleTeamChange}
                  adoHeaders={adoHeaders}
                  disabled={activeTab !== "team" && activeTab !== "timetracking"}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {refreshedAt && (
                <span className="text-[11px] text-pulse-dim">
                  {refreshedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {refreshedAt.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              )}
              {(selectedTeam || activeTab === "organization" || activeTab === "timetracking") && (
                <>
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-pulse-muted bg-pulse-card border border-pulse-border rounded-lg hover:text-pulse-text hover:bg-pulse-hover transition-colors cursor-pointer disabled:opacity-50"
                    title="Refresh"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </button>
                  <TimeRangeSelector range={range} onRangeChange={handleRangeChange} />
                </>
              )}
              <button
                onClick={onDisconnect}
                className="text-[12px] text-pulse-dim hover:text-pulse-red transition-colors cursor-pointer"
                title="Disconnect"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Error State (team tab only) */}
        {activeTab === "team" && error && (
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

        {/* ── Team Tab ── */}
        {activeTab === "team" && (
          <>
            {/* Empty state — no team selected yet */}
            {!selectedTeam && !loading && !error && (
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
                      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-[15px] font-semibold text-pulse-text mb-1">
                  Select a team to get started
                </h2>
                <p className="text-[13px] text-pulse-muted max-w-[280px]">
                  Choose a team from the dropdown above to view PR activity and review metrics.
                </p>
              </div>
            )}

            {/* KPI Row */}
            {loading && <SkeletonKPIRow />}
            {data && (
              <div
                className={`grid grid-cols-1 gap-4 mb-6 ${
                  stalePRData ? "md:grid-cols-4" : "md:grid-cols-3"
                }`}
              >
                <KPICard
                  title="PRs Merged"
                  value={filteredKPIs ? filteredKPIs.totalPRs : data.team.totalPRs}
                  subtitle={data.period.label}
                />
                <KPICard
                  title="Active Contributors"
                  value={`${filteredKPIs ? filteredKPIs.activeContributors : data.team.activeContributors} / ${filteredKPIs ? filteredKPIs.totalMembers : data.team.totalMembers}`}
                  subtitle="team members"
                />
                <KPICard
                  title="Most Active Repo"
                  value={mostActiveRepo?.repoName || "\u2014"}
                  subtitle={
                    mostActiveRepo
                      ? `${mostActiveRepo.totalPRs} PRs merged`
                      : "no data"
                  }
                />
                {filteredStalePRs && (
                  <KPICard
                    title="Open PRs"
                    value={filteredStalePRs.summary.total}
                    subtitle={
                      filteredStalePRs.summary.stale > 0 ? (
                        <span className="text-red-600">{filteredStalePRs.summary.stale} stale</span>
                      ) : (
                        <span className="text-emerald-600">all fresh</span>
                      )
                    }
                  />
                )}
              </div>
            )}

            {/* Alignment KPI Tile */}
            {alignmentLoading && (
              <div className="bg-pulse-card border border-pulse-border rounded-lg p-6 shadow-sm mb-6 animate-pulse">
                <div className="h-3 w-24 bg-pulse-bg rounded mb-3" />
                <div className="h-7 w-32 bg-pulse-bg rounded" />
              </div>
            )}
            {filteredAlignmentData && <AlignmentKPITile data={filteredAlignmentData} />}
            {alignmentError && !alignmentLoading && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-[13px] text-amber-800">{alignmentError}</p>
              </div>
            )}

            {/* Data Confidence Panel */}
            {data && filteredDiagnosticsData && (
              <DataConfidencePanel
                diagnostics={filteredDiagnosticsData}
                onInvestigate={() => {
                  setValidatorTeam(data.team.name);
                  setActiveTab("organization");
                }}
              />
            )}

            {/* Developer Breakdown Table */}
            {loading && (
              <div className="mb-6">
                <SkeletonTable rows={6} />
              </div>
            )}
            {data && (
              <div className="mb-6">
                <MemberTable
                  members={data.members}
                  teamName={data.team.name}
                  alignmentData={alignmentData}
                  agencyLookup={agencyLookup}
                  agencyFilter={agencyFilter}
                  onAgencyFilterChange={setAgencyFilter}
                />
              </div>
            )}

            {/* Repo Table */}
            {loading && <SkeletonTable rows={4} />}
            {data && (
              <div className="mb-6">
                <RepoTable repos={data.byRepo} />
              </div>
            )}

            {/* Stale PRs */}
            {stalePRLoading && <SkeletonTable rows={4} />}
            {filteredStalePRs && (
              <div className="mb-6">
                <StalePRTable data={filteredStalePRs} />
              </div>
            )}

          </>
        )}

        {/* ── Time Tracking Tab ── */}
        {activeTab === "timetracking" && (
          <TimeTrackingTab
            adoHeaders={adoHeaders}
            selectedTeam={selectedTeam}
            range={range}
          />
        )}

        {/* ── Organization Tab ── */}
        {activeTab === "organization" && (
          <OrgHealthView adoHeaders={adoHeaders} range={range} validatorTeam={validatorTeam} />
        )}

        {/* ── Debug Tab ── */}
        {activeTab === "debug" && (
          <IdentityDebug adoHeaders={adoHeaders} selectedTeam={selectedTeam} range={range} />
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <SettingsPage adoHeaders={adoHeaders} selectedTeam={selectedTeam} range={range} />
        )}
      </div>
    </div>
  );
}
