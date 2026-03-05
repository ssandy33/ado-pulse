/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SprintComparisonCards } from "@/components/trends/SprintComparisonCards";
import type { SprintComparison } from "@/lib/trends";

const mockComparison: SprintComparison = {
  current: { totalPRs: 12, avgPRAgeDays: 2.0, alignmentScore: 75, days: 14 },
  previous: { totalPRs: 8, avgPRAgeDays: 3.5, alignmentScore: 60, days: 14 },
  delta: { totalPRs: 4, avgPRAgeDays: -1.5, alignmentScore: 15 },
};

describe("SprintComparisonCards", () => {
  it("renders sprint comparison title", () => {
    render(<SprintComparisonCards data={mockComparison} />);
    expect(screen.getByText("Sprint Comparison")).toBeInTheDocument();
  });

  it("renders metric rows", () => {
    render(<SprintComparisonCards data={mockComparison} />);
    expect(screen.getByText("PRs Merged")).toBeInTheDocument();
    expect(screen.getByText("Avg PR Age")).toBeInTheDocument();
    expect(screen.getByText("Alignment")).toBeInTheDocument();
  });

  it("renders delta badges with correct colors", () => {
    const { container } = render(<SprintComparisonCards data={mockComparison} />);
    // Positive delta for PRs merged (good) — should be green
    const greenBadges = container.querySelectorAll(".text-emerald-600");
    expect(greenBadges.length).toBeGreaterThan(0);
  });

  it("renders current and previous values", () => {
    render(<SprintComparisonCards data={mockComparison} />);
    // Current totalPRs = 12
    expect(screen.getByText("12.0")).toBeInTheDocument();
    // Previous totalPRs = 8
    expect(screen.getByText("8.0")).toBeInTheDocument();
  });
});
