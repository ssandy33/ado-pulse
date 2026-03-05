/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "responsive-container" }, children),
    BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
      React.createElement("div", { "data-testid": "bar-chart", "data-count": data.length }, children),
    Bar: ({ name }: { name: string }) =>
      React.createElement("div", { "data-testid": `bar-${name.toLowerCase()}` }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import { WeeklyHoursChart } from "@/components/trends/WeeklyHoursChart";

const mockData = [
  { weekStart: "2026-02-17", weekLabel: "Feb 17", totalHours: 100, capExHours: 60, opExHours: 40 },
  { weekStart: "2026-02-24", weekLabel: "Feb 24", totalHours: 120, capExHours: 80, opExHours: 40 },
];

describe("WeeklyHoursChart", () => {
  it("renders stacked bar chart", () => {
    render(<WeeklyHoursChart data={mockData} />);
    expect(screen.getByText(/Weekly Hours/)).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toHaveAttribute("data-count", "2");
  });

  it("renders CapEx and OpEx bars", () => {
    render(<WeeklyHoursChart data={mockData} />);
    expect(screen.getByTestId("bar-capex")).toBeInTheDocument();
    expect(screen.getByTestId("bar-opex")).toBeInTheDocument();
  });
});
