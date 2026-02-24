"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type {
  MemberRoleExclusion,
  TeamSummaryApiResponse,
  Team,
  TeamsApiResponse,
} from "@/lib/ado/types";
import { CollapsibleSection } from "./CollapsibleSection";

interface MemberRolesSettingsProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  range: TimeRange;
}

interface LocalExclusion {
  uniqueName: string;
  displayName: string;
  role: string;
  excludeFromMetrics: boolean;
}

export function MemberRolesSettings({
  adoHeaders,
  selectedTeam,
  range,
}: MemberRolesSettingsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState(selectedTeam);
  const [members, setMembers] = useState<
    { uniqueName: string; displayName: string }[]
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savedExclusions, setSavedExclusions] = useState<
    MemberRoleExclusion[]
  >([]);
  const [localEdits, setLocalEdits] = useState<Map<string, LocalExclusion>>(
    new Map()
  );
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Load teams list
  useEffect(() => {
    fetch("/api/teams?pinnedOnly=true", { headers: adoHeaders })
      .then((res) => res.json())
      .then((data: TeamsApiResponse) => setTeams(data.teams))
      .catch(() => {});
  }, [adoHeaders]);

  // Load saved exclusions
  useEffect(() => {
    fetch("/api/settings/member-roles")
      .then((res) => res.json())
      .then((data: { exclusions: MemberRoleExclusion[] }) => {
        setSavedExclusions(data.exclusions ?? []);
      })
      .catch(() => {});
  }, []);

  // Build localEdits map from saved exclusions (keyed by lowercase uniqueName)
  useEffect(() => {
    const map = new Map<string, LocalExclusion>();
    for (const e of savedExclusions) {
      map.set(e.uniqueName.toLowerCase(), {
        uniqueName: e.uniqueName,
        displayName: e.displayName,
        role: e.role,
        excludeFromMetrics: e.excludeFromMetrics,
      });
    }
    setLocalEdits(map);
    setDirty(false);
  }, [savedExclusions]);

  // Fetch team members when team changes
  const fetchMembers = useCallback(
    async (teamName: string) => {
      if (!teamName) return;
      setLoadingMembers(true);
      try {
        const res = await fetch(
          `/api/prs/team-summary?team=${encodeURIComponent(teamName)}&range=${range}`,
          { headers: adoHeaders }
        );
        if (res.ok) {
          const data: TeamSummaryApiResponse = await res.json();
          setMembers(
            data.members.map((m) => ({
              uniqueName: m.uniqueName,
              displayName: m.displayName,
            }))
          );
        }
      } catch {
        // silent
      } finally {
        setLoadingMembers(false);
      }
    },
    [adoHeaders, range]
  );

  useEffect(() => {
    fetchMembers(team);
  }, [team, fetchMembers]);

  const toggleExclude = (uniqueName: string, displayName: string) => {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      const key = uniqueName.toLowerCase();
      const existing = next.get(key);
      if (existing) {
        if (existing.excludeFromMetrics) {
          // Unchecking — remove entirely
          next.delete(key);
        } else {
          next.set(key, { ...existing, excludeFromMetrics: true });
        }
      } else {
        next.set(key, {
          uniqueName,
          displayName,
          role: "",
          excludeFromMetrics: true,
        });
      }
      return next;
    });
    setDirty(true);
    setSaveError(null);
  };

  const updateRole = (uniqueName: string, displayName: string, role: string) => {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      const key = uniqueName.toLowerCase();
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, role });
      } else {
        next.set(key, {
          uniqueName,
          displayName,
          role,
          excludeFromMetrics: true,
        });
      }
      return next;
    });
    setDirty(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const exclusions: MemberRoleExclusion[] = Array.from(
        localEdits.values()
      )
        .filter((e) => e.excludeFromMetrics)
        .map((e) => ({
          uniqueName: e.uniqueName,
          displayName: e.displayName,
          role: e.role,
          excludeFromMetrics: e.excludeFromMetrics,
          addedAt: new Date().toISOString(),
        }));

      const res = await fetch("/api/settings/member-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclusions }),
      });

      if (!res.ok) {
        setSaveError("Failed to save. Please try again.");
        return;
      }

      const data = await res.json();
      setSavedExclusions(data.exclusions ?? []);
      setDirty(false);
      setSavedFeedback(true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getExclusion = (uniqueName: string): LocalExclusion | undefined =>
    localEdits.get(uniqueName.toLowerCase());

  return (
    <CollapsibleSection
      id="member-roles"
      title="Member Role Exclusions"
      description="Mark non-contributors (Scrum Masters, POs, Managers) to exclude them from PR metrics while keeping them visible."
      headerActions={
        <div className="flex items-center gap-3 shrink-0">
          {saveError && (
            <span className="text-[11px] text-red-600 font-medium">
              {saveError}
            </span>
          )}
          {dirty && !saveError && (
            <span className="text-[11px] text-amber-600 font-medium">
              Unsaved changes
            </span>
          )}
          {savedFeedback && (
            <span className="text-[11px] text-emerald-600 font-medium">
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-3 py-1.5 text-[12px] font-medium bg-pulse-accent text-white rounded-md hover:bg-pulse-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      {/* Team selector */}
      <div className="px-5 py-3 border-b border-pulse-border">
        <label className="text-[12px] text-pulse-muted mr-2">Team:</label>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="text-[13px] bg-pulse-bg border border-pulse-border rounded px-2 py-1 text-pulse-text"
        >
          <option value="">Select team...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Members table */}
      <div className="overflow-x-auto">
        {loadingMembers ? (
          <div className="px-5 py-8 text-center text-[13px] text-pulse-muted">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-pulse-muted">
            {team
              ? "No members found for this team."
              : "Select a team to view members."}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-pulse-border">
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-pulse-dim uppercase tracking-wider">
                  Member
                </th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-pulse-dim uppercase tracking-wider">
                  Role
                </th>
                <th className="px-5 py-2.5 text-center text-[11px] font-medium text-pulse-dim uppercase tracking-wider">
                  Exclude
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pulse-border">
              {members.map((m) => {
                const exc = getExclusion(m.uniqueName);
                const isExcluded = exc?.excludeFromMetrics ?? false;
                return (
                  <tr
                    key={m.uniqueName}
                    className="hover:bg-pulse-hover transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <div className="text-[13px] font-medium text-pulse-text">
                        {m.displayName}
                      </div>
                      <div className="text-[11px] text-pulse-dim">
                        {m.uniqueName}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        placeholder="e.g. Scrum Master"
                        value={exc?.role ?? ""}
                        disabled={!isExcluded}
                        onChange={(e) =>
                          updateRole(
                            m.uniqueName,
                            m.displayName,
                            e.target.value
                          )
                        }
                        className="text-[12px] bg-pulse-bg border border-pulse-border rounded px-2 py-1 text-pulse-text w-40 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isExcluded}
                        onChange={() =>
                          toggleExclude(m.uniqueName, m.displayName)
                        }
                        className="w-4 h-4 rounded border-pulse-border text-pulse-accent cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </CollapsibleSection>
  );
}
