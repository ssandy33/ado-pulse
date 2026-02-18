"use client";

import { useEffect, useState, useRef } from "react";
import type { TeamsApiResponse, Team } from "@/lib/ado/types";

interface TeamSelectorProps {
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  adoHeaders: Record<string, string>;
  disabled?: boolean;
}

export function TeamSelector({
  selectedTeam,
  onTeamChange,
  adoHeaders,
  disabled,
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/teams", { headers: adoHeaders })
      .then((res) => res.json())
      .then((data: TeamsApiResponse) => {
        setTeams(data.teams);
        if (!selectedTeam && data.default) {
          onTeamChange(data.default);
        }
      })
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
    return (
      <span className="text-pulse-dim text-sm">Loading teams...</span>
    );
  }

  if (disabled) {
    return (
      <span
        className="text-pulse-dim cursor-default text-sm"
        title="Team filter does not apply to org-level data"
      >
        {selectedTeam || "Select team"}
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-pulse-accent font-medium text-sm hover:text-pulse-accent-hover transition-colors cursor-pointer inline-flex items-center gap-1"
      >
        {selectedTeam || "Select team"}
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
