"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/dateRange";
import type {
  MemberProfile,
  TeamSummaryApiResponse,
  Team,
  TeamsApiResponse,
} from "@/lib/ado/types";
import { CollapsibleSection } from "./CollapsibleSection";

interface MemberAgencySettingsProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  range: TimeRange;
}

interface RowState {
  employmentType: "fte" | "contractor";
  agency: string;
}

export function MemberAgencySettings({
  adoHeaders,
  selectedTeam,
  range,
}: MemberAgencySettingsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState(selectedTeam);
  const [members, setMembers] = useState<
    { id: string; uniqueName: string; displayName: string }[]
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<MemberProfile[]>([]);
  const [rowEdits, setRowEdits] = useState<Map<string, RowState>>(new Map());
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Map<string, "success" | "error">>(new Map());
  const feedbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up feedback timers on unmount
  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      for (const id of timers.values()) clearTimeout(id);
      timers.clear();
    };
  }, []);

  // Load teams list
  useEffect(() => {
    fetch("/api/teams?pinnedOnly=true", { headers: adoHeaders })
      .then((res) => res.json())
      .then((data: TeamsApiResponse) => setTeams(data.teams))
      .catch((err) => console.error("Failed to load teams", err));
  }, [adoHeaders]);

  // Load saved profiles
  useEffect(() => {
    fetch("/api/settings/members")
      .then((res) => res.json())
      .then((data: { profiles: MemberProfile[] }) => {
        setSavedProfiles(data.profiles ?? []);
      })
      .catch((err) => console.error("Failed to load member profiles", err));
  }, []);

  // Build row edits from saved profiles whenever profiles or members change
  useEffect(() => {
    const map = new Map<string, RowState>();
    const profileMap = new Map(savedProfiles.map((p) => [p.adoId, p]));
    for (const m of members) {
      const saved = profileMap.get(m.id);
      if (saved) {
        map.set(m.id, {
          employmentType: saved.employmentType,
          agency: saved.agency,
        });
      } else {
        map.set(m.id, { employmentType: "fte", agency: "arrivia" });
      }
    }
    setRowEdits(map);
  }, [savedProfiles, members]);

  // Fetch team members when team changes
  const fetchMembers = useCallback(
    async (teamName: string) => {
      if (!teamName) return;
      setLoadingMembers(true);
      try {
        const res = await fetch(
          `/api/prs/team-summary?team=${encodeURIComponent(teamName)}&range=${range}`,
          { headers: adoHeaders },
        );
        if (res.ok) {
          const data: TeamSummaryApiResponse = await res.json();
          setMembers(
            data.members.map((m) => ({
              id: m.id,
              uniqueName: m.uniqueName,
              displayName: m.displayName,
            })),
          );
        }
      } catch {
        // silent
      } finally {
        setLoadingMembers(false);
      }
    },
    [adoHeaders, range],
  );

  useEffect(() => {
    fetchMembers(team);
  }, [team, fetchMembers]);

  const setRowFeedbackTimed = (adoId: string, status: "success" | "error") => {
    setRowFeedback((prev) => new Map(prev).set(adoId, status));
    const existing = feedbackTimers.current.get(adoId);
    if (existing) clearTimeout(existing);
    feedbackTimers.current.set(
      adoId,
      setTimeout(() => {
        setRowFeedback((prev) => {
          const next = new Map(prev);
          next.delete(adoId);
          return next;
        });
        feedbackTimers.current.delete(adoId);
      }, 2000),
    );
  };

  const updateEmploymentType = (adoId: string, type: "fte" | "contractor") => {
    setRowEdits((prev) => {
      const next = new Map(prev);
      next.set(adoId, {
        employmentType: type,
        agency: type === "fte" ? "arrivia" : "",
      });
      return next;
    });
  };

  const updateAgency = (adoId: string, agency: string) => {
    setRowEdits((prev) => {
      const next = new Map(prev);
      const current = next.get(adoId) ?? { employmentType: "fte", agency: "arrivia" };
      next.set(adoId, { ...current, agency });
      return next;
    });
  };

  const handleSaveRow = async (member: { id: string; uniqueName: string; displayName: string }) => {
    const row = rowEdits.get(member.id);
    if (!row) return;

    setSavingRow(member.id);
    try {
      const profile: MemberProfile = {
        adoId: member.id,
        displayName: member.displayName,
        email: member.uniqueName,
        employmentType: row.employmentType,
        agency: row.agency,
      };

      const res = await fetch("/api/settings/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        setRowFeedbackTimed(member.id, "error");
        return;
      }

      // Update local saved state
      setSavedProfiles((prev) => {
        const next = prev.filter((p) => p.adoId !== member.id);
        next.push(profile);
        return next;
      });
      setRowFeedbackTimed(member.id, "success");
    } catch {
      setRowFeedbackTimed(member.id, "error");
    } finally {
      setSavingRow(null);
    }
  };

  return (
    <CollapsibleSection
      id="member-agencies"
      title="Member Agencies"
      description="Annotate team members as FTE or contractor and assign their agency for reporting."
      defaultExpanded={false}
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
                  Type
                </th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-pulse-dim uppercase tracking-wider">
                  Agency
                </th>
                <th className="px-5 py-2.5 text-center text-[11px] font-medium text-pulse-dim uppercase tracking-wider">
                  {/* Save column */}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pulse-border">
              {members.map((m) => {
                const row = rowEdits.get(m.id) ?? { employmentType: "fte" as const, agency: "arrivia" };
                const feedback = rowFeedback.get(m.id);
                const isSaving = savingRow === m.id;
                return (
                  <tr
                    key={m.id}
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
                      <select
                        value={row.employmentType}
                        onChange={(e) =>
                          updateEmploymentType(m.id, e.target.value as "fte" | "contractor")
                        }
                        className="text-[12px] bg-pulse-bg border border-pulse-border rounded px-2 py-1 text-pulse-text"
                      >
                        <option value="fte">FTE</option>
                        <option value="contractor">Contractor</option>
                      </select>
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        type="text"
                        value={row.agency}
                        onChange={(e) => updateAgency(m.id, e.target.value)}
                        placeholder="Agency name"
                        className="text-[12px] bg-pulse-bg border border-pulse-border rounded px-2 py-1 text-pulse-text w-40"
                      />
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {feedback === "success" && (
                          <span className="text-emerald-600 text-[13px]">&#10003;</span>
                        )}
                        {feedback === "error" && (
                          <span className="text-[11px] text-red-600 font-medium">
                            Error
                          </span>
                        )}
                        <button
                          onClick={() => handleSaveRow(m)}
                          disabled={isSaving || !row.agency}
                          className="px-3 py-1 text-[12px] font-medium bg-pulse-accent text-white rounded-md hover:bg-pulse-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isSaving ? "..." : "Save"}
                        </button>
                      </div>
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
