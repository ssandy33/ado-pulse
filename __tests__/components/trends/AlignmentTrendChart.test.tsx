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
    LineChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "line-chart" }, children),
    Line: () => React.createElement("div", { "data-testid": "line" }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: ({ label }: { label?: { value: string } }) =>
      React.createElement("div", { "data-testid": "reference-line", "data-label": label?.value }),
  };
});

import { AlignmentTrendChart } from "@/components/trends/AlignmentTrendChart";

const dataWithAlignment = [
  { weekStart: "2026-02-17", weekLabel: "Feb 17", totalPRs: 10, activeContributors: 3, alignmentScore: 70 },
  { weekStart: "2026-02-24", weekLabel: "Feb 24", totalPRs: 12, activeContributors: 4, alignmentScore: 75 },
];

const dataWithoutAlignment = [
  { weekStart: "2026-02-17", weekLabel: "Feb 17", totalPRs: 10, activeContributors: 3, alignmentScore: null },
  { weekStart: "2026-02-24", weekLabel: "Feb 24", totalPRs: 12, activeContributors: 4, alignmentScore: null },
];

describe("AlignmentTrendChart", () => {
  it("renders chart with threshold reference lines", () => {
    render(<AlignmentTrendChart data={dataWithAlignment} />);
    expect(screen.getByText(/Alignment Score/)).toBeInTheDocument();
    const refLines = screen.getAllByTestId("reference-line");
    expect(refLines.length).toBe(2);
    expect(refLines[0]).toHaveAttribute("data-label", "Good");
    expect(refLines[1]).toHaveAttribute("data-label", "Warning");
  });

  it("returns null when no alignment data", () => {
    const { container } = render(<AlignmentTrendChart data={dataWithoutAlignment} />);
    expect(container.firstChild).toBeNull();
  });
});
