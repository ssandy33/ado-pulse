/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";

describe("TimeRangeSelector", () => {
  it("renders the PM button", () => {
    render(<TimeRangeSelector range="14" onRangeChange={jest.fn()} />);
    expect(screen.getByText("PM")).toBeInTheDocument();
  });

  it('calls onRangeChange with "pm" when PM is clicked', () => {
    const onChange = jest.fn();
    render(<TimeRangeSelector range="14" onRangeChange={onChange} />);
    fireEvent.click(screen.getByText("PM"));
    expect(onChange).toHaveBeenCalledWith("pm");
  });

  it("highlights PM when it is the active range", () => {
    render(<TimeRangeSelector range="pm" onRangeChange={jest.fn()} />);
    const pmButton = screen.getByText("PM");
    expect(pmButton.className).toContain("bg-pulse-accent");
  });

  it("renders all four range options", () => {
    render(<TimeRangeSelector range="14" onRangeChange={jest.fn()} />);
    expect(screen.getByText("7d")).toBeInTheDocument();
    expect(screen.getByText("14d")).toBeInTheDocument();
    expect(screen.getByText("MTD")).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
  });
});
