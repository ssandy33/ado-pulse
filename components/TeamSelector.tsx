"use client";

import { useEffect, useState, useRef } from "react";
import type { TeamsApiResponse, Team } from "@/lib/ado/types";

interface TeamSelectorProps {
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  onMetaLoaded?: (meta: { org: string; project: string }) => void;
}

export function TeamSelector({
  selectedTeam,
  onTeamChange,
  onMetaLoaded,
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data: TeamsApiResponse & { org?: string; project?: string }) => {
        setTeams(data.teams);
        if (!selectedTeam && data.default) {
          onTeamChange(data.default);
        }
        if (onMetaLoaded && data.org && data.project) {
          onMetaLoaded({ org: data.org, project: data.project });
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
      <span className="text-pulse-muted font-mono text-sm">
        Loading teams...
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-pulse-accent font-mono text-sm hover:text-pulse-text transition-colors cursor-pointer inline-flex items-center gap-1"
      >
        {selectedTeam || "Select team"}
        <span className="text-xs">&#9662;</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-pulse-card border border-pulse-border rounded-lg shadow-lg py-1 min-w-[240px] max-h-[300px] overflow-y-auto">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                onTeamChange(team.name);
                setOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm font-mono hover:bg-pulse-border/50 transition-colors cursor-pointer ${
                team.name === selectedTeam
                  ? "text-pulse-accent"
                  : "text-pulse-text"
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
