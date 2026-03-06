/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ContributorFilter } from "@/components/trends/ContributorFilter";

const members = [
  { uniqueName: "alice@example.com", displayName: "Alice" },
  { uniqueName: "bob@example.com", displayName: "Bob" },
  { uniqueName: "carlos@example.com", displayName: "Carlos" },
];

describe("ContributorFilter", () => {
  it("renders the trigger button", () => {
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("opens dropdown on click and shows members", () => {
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
  });

  it("toggles a member on click", () => {
    const onChange = jest.fn();
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    fireEvent.click(screen.getByText("Bob"));

    expect(onChange).toHaveBeenCalledWith(new Set(["Alice", "Carlos"]));
  });

  it("adds a member when not currently visible", () => {
    const onChange = jest.fn();
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice"])}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    fireEvent.click(screen.getByText("Carlos"));

    expect(onChange).toHaveBeenCalledWith(new Set(["Alice", "Carlos"]));
  });

  it("Select All selects all members", () => {
    const onChange = jest.fn();
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice"])}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    fireEvent.click(screen.getByText("Select All"));

    expect(onChange).toHaveBeenCalledWith(new Set(["Alice", "Bob", "Carlos"]));
  });

  it("Clear All clears all members", () => {
    const onChange = jest.fn();
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    fireEvent.click(screen.getByText("Clear All"));

    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it("shows badge count when partially filtered", () => {
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice"])}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show badge when all members visible", () => {
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={jest.fn()}
      />
    );

    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    render(
      <ContributorFilter
        members={members}
        visible={new Set(["Alice", "Bob", "Carlos"])}
        onChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Contributors"));
    expect(screen.getByText("Alice")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
