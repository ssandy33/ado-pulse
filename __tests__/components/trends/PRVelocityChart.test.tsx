/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock recharts to avoid SVG rendering issues in jsdom
jest.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "responsive-container" }, children),
    LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
      React.createElement("div", { "data-testid": "line-chart", "data-count": data.length }, children),
    Line: ({ name }: { name: string }) => React.createElement("div", { "data-testid": "line", "data-name": name }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

import { PRVelocityChart } from "@/components/trends/PRVelocityChart";

const dailyData = [
  { date: "2026-03-01", dateLabel: "Mar 1", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
  { date: "2026-03-02", dateLabel: "Mar 2", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
  { date: "2026-03-03", dateLabel: "Mar 3", totalPRs: 15, activeContributors: 5, alignmentScore: 80 },
];

const weeklyData = [
  { weekStart: "2026-02-17", weekLabel: "Feb 17", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
  { weekStart: "2026-02-24", weekLabel: "Feb 24", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
  { weekStart: "2026-03-03", weekLabel: "Mar 3", totalPRs: 15, activeContributors: 5, alignmentScore: 80 },
];

describe("PRVelocityChart", () => {
  it("renders chart container with data", () => {
    render(<PRVelocityChart data={dailyData} />);
    expect(screen.getByText(/PR Velocity/)).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-count", "3");
  });

  it("renders the line element", () => {
    render(<PRVelocityChart data={dailyData} />);
    expect(screen.getByTestId("line")).toBeInTheDocument();
  });

  it("defaults to Daily granularity", () => {
    render(<PRVelocityChart data={dailyData} />);
    expect(screen.getByText(/Last 3 Days/)).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
  });

  it("switches to Weekly view on toggle click", () => {
    const onGranularityChange = jest.fn();
    render(
      <PRVelocityChart
        data={weeklyData}
        defaultGranularity="daily"
        onGranularityChange={onGranularityChange}
      />
    );

    fireEvent.click(screen.getByText("Weekly"));
    expect(onGranularityChange).toHaveBeenCalledWith("weekly");
    expect(screen.getByText(/Last 3 Weeks/)).toBeInTheDocument();
  });

  it("shows Weekly title when defaultGranularity is weekly", () => {
    render(<PRVelocityChart data={weeklyData} defaultGranularity="weekly" />);
    expect(screen.getByText(/Last 3 Weeks/)).toBeInTheDocument();
  });

  it("renders toggle with Daily and Weekly buttons", () => {
    render(<PRVelocityChart data={dailyData} />);
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("renders Team and Per Person toggle when onViewModeChange provided", () => {
    render(
      <PRVelocityChart
        data={dailyData}
        onViewModeChange={jest.fn()}
      />
    );
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Per Person")).toBeInTheDocument();
  });

  it("does not render view mode toggle without onViewModeChange", () => {
    render(<PRVelocityChart data={dailyData} />);
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.queryByText("Per Person")).not.toBeInTheDocument();
  });

  it("calls onViewModeChange when Per Person is clicked", () => {
    const onViewModeChange = jest.fn();
    render(
      <PRVelocityChart
        data={dailyData}
        onViewModeChange={onViewModeChange}
      />
    );

    fireEvent.click(screen.getByText("Per Person"));
    expect(onViewModeChange).toHaveBeenCalledWith("per-person");
  });

  it("calls onViewModeChange with 'team' when Team is clicked in per-person mode", () => {
    const onViewModeChange = jest.fn();
    const perPersonData = [
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 2 },
    ];
    const members = [
      { uniqueName: "alice@example.com", displayName: "Alice" },
    ];

    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={onViewModeChange}
        perPersonData={perPersonData}
        members={members}
        visibleMembers={new Set(["Alice"])}
        onVisibleMembersChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Team"));
    expect(onViewModeChange).toHaveBeenCalledWith("team");
  });

  it("shows loading state when perPersonLoading is true", () => {
    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={jest.fn()}
        perPersonLoading={true}
      />
    );

    expect(screen.getByText("Loading contributor data...")).toBeInTheDocument();
  });

  it("renders per-person lines when in per-person mode", () => {
    const perPersonData = [
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 2, Bob: 1 },
      { date: "2026-03-02", dateLabel: "Mar 2", Alice: 1, Bob: 3 },
    ];
    const members = [
      { uniqueName: "alice@example.com", displayName: "Alice" },
      { uniqueName: "bob@example.com", displayName: "Bob" },
    ];

    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={jest.fn()}
        perPersonData={perPersonData}
        members={members}
        visibleMembers={new Set(["Alice", "Bob"])}
        onVisibleMembersChange={jest.fn()}
      />
    );

    const lines = screen.getAllByTestId("line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("data-name", "Alice");
    expect(lines[1]).toHaveAttribute("data-name", "Bob");
  });

  it("only renders lines for visible members", () => {
    const perPersonData = [
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 2, Bob: 1 },
    ];
    const members = [
      { uniqueName: "alice@example.com", displayName: "Alice" },
      { uniqueName: "bob@example.com", displayName: "Bob" },
    ];

    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={jest.fn()}
        perPersonData={perPersonData}
        members={members}
        visibleMembers={new Set(["Alice"])}
        onVisibleMembersChange={jest.fn()}
      />
    );

    const lines = screen.getAllByTestId("line");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveAttribute("data-name", "Alice");
  });

  it("hides granularity toggle in per-person mode", () => {
    const perPersonData = [
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 2 },
    ];
    const members = [
      { uniqueName: "alice@example.com", displayName: "Alice" },
    ];

    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={jest.fn()}
        perPersonData={perPersonData}
        members={members}
        visibleMembers={new Set(["Alice"])}
        onVisibleMembersChange={jest.fn()}
      />
    );

    expect(screen.queryByText("Daily")).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly")).not.toBeInTheDocument();
  });

  it("shows per-person period label", () => {
    const perPersonData = [
      { date: "2026-03-01", dateLabel: "Mar 1", Alice: 2 },
      { date: "2026-03-02", dateLabel: "Mar 2", Alice: 1 },
      { date: "2026-03-03", dateLabel: "Mar 3", Alice: 0 },
    ];
    const members = [
      { uniqueName: "alice@example.com", displayName: "Alice" },
    ];

    render(
      <PRVelocityChart
        data={dailyData}
        viewMode="per-person"
        onViewModeChange={jest.fn()}
        perPersonData={perPersonData}
        members={members}
        visibleMembers={new Set(["Alice"])}
        onVisibleMembersChange={jest.fn()}
      />
    );

    expect(screen.getByText(/Per Person — 3 Days/)).toBeInTheDocument();
  });
});
