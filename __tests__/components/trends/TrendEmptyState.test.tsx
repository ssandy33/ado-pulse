/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TrendEmptyState } from "@/components/trends/TrendEmptyState";

describe("TrendEmptyState", () => {
  it("renders default message", () => {
    render(<TrendEmptyState />);
    expect(
      screen.getByText(/Trend data is building/)
    ).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<TrendEmptyState message="Custom empty state message" />);
    expect(screen.getByText("Custom empty state message")).toBeInTheDocument();
  });
});
