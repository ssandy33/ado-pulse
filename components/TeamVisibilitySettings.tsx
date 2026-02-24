"use client";

import { useState, useEffect, useRef } from "react";
import type { Team, TeamsApiResponse } from "@/lib/ado/types";
import { CollapsibleSection } from "./CollapsibleSection";

interface TeamVisibilitySettingsProps {
  adoHeaders: Record<string, string>;
}

export function TeamVisibilitySettings({
  adoHeaders,
}: TeamVisibilitySettingsProps) {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [savedPinned, setSavedPinned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const dirty =
    pinned.size !== savedPinned.size ||
    [...pinned].some((t) => !savedPinned.has(t));

  // Load ALL teams (no pinnedOnly — this checklist must show everything)
  useEffect(() => {
    fetch("/api/teams", { headers: adoHeaders })
      .then((res) => res.json())
      .then((data: TeamsApiResponse) => {
        const sorted = [...data.teams].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setAllTeams(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }, [adoHeaders]);

  // Load saved pinned teams
  useEffect(() => {
    fetch("/api/settings/team-visibility")
      .then((res) => res.json())
      .then((data: { pinnedTeams: string[] }) => {
        const set = new Set(data.pinnedTeams ?? []);
        setSavedPinned(set);
        setPinned(set);
      })
      .catch(() => {});
  }, []);

  const toggle = (teamName: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) {
        next.delete(teamName);
      } else {
        next.add(teamName);
      }
      return next;
    });
    setSaveError(null);
  };

  const selectAll = () => {
    setPinned(new Set(allTeams.map((t) => t.name)));
    setSaveError(null);
  };

  const clearAll = () => {
    setPinned(new Set());
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings/team-visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedTeams: [...pinned] }),
      });

      if (!res.ok) {
        setSaveError("Failed to save. Please try again.");
        return;
      }

      const data = await res.json();
      const set = new Set<string>(data.pinnedTeams ?? []);
      setSavedPinned(set);
      setPinned(set);
      setSavedFeedback(true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2000);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleSection
      id="team-visibility"
      title="Team Visibility"
      description="Select which teams appear in all team dropdowns across the app. If none are selected, all teams are shown."
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
            {saving ? "Saving..." : "Save Team Visibility"}
          </button>
        </div>
      }
    >
      <div className="px-5 py-3">
        {loadingTeams ? (
          <div className="py-6 text-center text-[13px] text-pulse-muted">
            Loading teams...
          </div>
        ) : allTeams.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-pulse-muted">
            No teams found.
          </div>
        ) : (
          <>
            <div className="max-h-[320px] overflow-y-auto border border-pulse-border rounded-md divide-y divide-pulse-border">
              {allTeams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-pulse-hover transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={pinned.has(team.name)}
                    onChange={() => toggle(team.name)}
                    className="w-4 h-4 rounded border-pulse-border text-pulse-accent cursor-pointer"
                  />
                  <span className="text-[13px] text-pulse-text">
                    {team.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={selectAll}
                className="text-[12px] font-medium text-pulse-accent hover:text-pulse-accent-hover transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="text-[12px] font-medium text-pulse-muted hover:text-pulse-text transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
