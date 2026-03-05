/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
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

const mockData = [
  { weekStart: "2026-02-17", weekLabel: "Feb 17", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
  { weekStart: "2026-02-24", weekLabel: "Feb 24", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
  { weekStart: "2026-03-03", weekLabel: "Mar 3", totalPRs: 15, activeContributors: 5, alignmentScore: 80 },
];

describe("PRVelocityChart", () => {
  it("renders chart container with data", () => {
    render(<PRVelocityChart data={mockData} />);
    expect(screen.getByText(/PR Velocity/)).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-count", "3");
  });

  it("renders the line element", () => {
    render(<PRVelocityChart data={mockData} />);
    expect(screen.getByTestId("line")).toBeInTheDocument();
  });
});
