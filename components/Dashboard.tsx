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
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-6 bg-pulse-accent rounded-full" />
                <h1 className="text-xl font-semibold text-pulse-text">
                  PR Hygiene Dashboard
                </h1>
              </div>
              <div className="flex items-center gap-1 text-sm font-mono text-pulse-muted ml-4">
                <span>{creds.org}</span>
                <span>/</span>
                <span>{creds.project}</span>
                <span>/</span>
                <TeamSelector
                  selectedTeam={selectedTeam}
                  onTeamChange={handleTeamChange}
                  adoHeaders={adoHeaders}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {refreshedAt && (
                <span className="text-xs font-mono text-pulse-muted">
                  refreshed{" "}
                  {refreshedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
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
                className="text-pulse-muted hover:text-pulse-text transition-colors text-sm font-mono cursor-pointer disabled:opacity-50"
                title="Refresh"
              >
                &#x21bb; refresh
              </button>
              <TimeRangeSelector days={days} onDaysChange={handleDaysChange} />
              <button
                onClick={onDisconnect}
                className="text-pulse-muted hover:text-red-400 transition-colors text-xs font-mono cursor-pointer"
                title="Disconnect"
              >
                disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-xs font-mono text-red-400 hover:text-red-300 underline cursor-pointer"
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
              value={mostActiveRepo?.repoName || "—"}
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
