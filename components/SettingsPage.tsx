"use client";

import { MemberRolesSettings } from "./MemberRolesSettings";

interface SettingsPageProps {
  adoHeaders: Record<string, string>;
  selectedTeam: string;
  days: number;
}

export function SettingsPage({
  adoHeaders,
  selectedTeam,
  days,
}: SettingsPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold text-pulse-text">Settings</h2>
        <p className="text-[13px] text-pulse-muted mt-0.5">
          Configure team and project preferences.
        </p>
      </div>

      <MemberRolesSettings
        adoHeaders={adoHeaders}
        selectedTeam={selectedTeam}
        days={days}
      />

      <hr className="my-8 border-pulse-border" />
      <p className="text-[12px] text-pulse-dim">
        More settings coming soon.
      </p>
    </div>
  );
}
