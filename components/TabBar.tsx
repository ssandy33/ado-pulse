"use client";

interface TabBarProps {
  activeTab: "team" | "organization";
  onTabChange: (tab: "team" | "organization") => void;
}

const TABS: { key: "team" | "organization"; label: string }[] = [
  { key: "team", label: "Team" },
  { key: "organization", label: "Organization" },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="border-b border-pulse-border mb-6">
      <div className="flex gap-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`pb-2.5 text-[13px] font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "text-pulse-text border-b-2 border-pulse-accent"
                : "text-pulse-muted hover:text-pulse-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
