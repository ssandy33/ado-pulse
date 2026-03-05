/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";

describe("DataFreshnessIndicator", () => {
  it("renders 'Live' for live source", () => {
    render(<DataFreshnessIndicator source="live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders 'Cached' with date for cache source", () => {
    render(<DataFreshnessIndicator source="cache" snapshotDate="2026-02-28" />);
    expect(screen.getByText(/Cached/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 28/)).toBeInTheDocument();
  });

  it("renders 'Stale' with date for stale source", () => {
    render(<DataFreshnessIndicator source="stale" snapshotDate="2026-02-25" />);
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 25/)).toBeInTheDocument();
  });

  it("renders correct status dot color per source", () => {
    const { container } = render(<DataFreshnessIndicator source="live" />);
    const dot = container.querySelector(".bg-emerald-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders info dot for cache source", () => {
    const { container } = render(<DataFreshnessIndicator source="cache" />);
    const dot = container.querySelector(".bg-blue-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders warning dot for stale source", () => {
    const { container } = render(<DataFreshnessIndicator source="stale" />);
    const dot = container.querySelector(".bg-amber-500");
    expect(dot).toBeInTheDocument();
  });
});
