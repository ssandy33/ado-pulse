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
    Line: () => React.createElement("div", { "data-testid": "line" }),
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
});
