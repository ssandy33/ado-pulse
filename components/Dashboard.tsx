"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { TeamSummaryApiResponse } from "@/lib/ado/types";
import { TeamSelector } from "./TeamSelector";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { KPICard } from "./KPICard";
import { MemberTable } from "./MemberTable";
import { RepoTable } from "./RepoTable";
import { SkeletonKPIRow, SkeletonTable } from "./SkeletonLoader";

interface DashboardProps {
  creds: { org: string; project: string; pat: string };
  onDisconnect: () => void;
}

export function Dashboard({ creds, onDisconnect }: DashboardProps) {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [days, setDays] = useState(14);
  const [data, setData] = useState<TeamSummaryApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const adoHeaders = useMemo(
    () => ({
      "x-ado-org": creds.org,
      "x-ado-project": creds.project,
      "x-ado-pat": creds.pat,
    }),
    [creds]
  );

  const fetchData = useCallback(async () => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/prs/team-summary?days=${days}&team=${encodeURIComponent(selectedTeam)}`,
        { headers: adoHeaders }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      const json: TeamSummaryApiResponse = await res.json();
      setData(json);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedTeam, days, adoHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
  };

  const handleDaysChange = (d: number) => {
    setDays(d);
  };

  const mostActiveRepo =
    data && data.byRepo.length > 0 ? data.byRepo[0] : null;

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
              <TimeRangeSelector days={days} onDaysChange={handleDaysChange} />
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

        {/* Error State */}
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

        {/* KPI Row */}
        {loading && <SkeletonKPIRow />}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPICard
              title="PRs Merged"
              value={data.team.totalPRs}
              subtitle={`last ${data.period.days} days`}
            />
            <KPICard
              title="Active Contributors"
              value={`${data.team.activeContributors} / ${data.team.totalMembers}`}
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
          </div>
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
            />
          </div>
        )}

        {/* Repo Table */}
        {loading && <SkeletonTable rows={4} />}
        {data && <RepoTable repos={data.byRepo} />}
      </div>
    </div>
  );
}
