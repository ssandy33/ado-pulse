/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AgencyFilterDropdown } from "@/components/AgencyFilterDropdown";

const agencies = [
  { label: "arrivia", employmentType: "fte" as const, count: 3 },
  { label: "Acme Consulting", employmentType: "contractor" as const, count: 2 },
  { label: "Beta Corp", employmentType: null, count: 1 },
];

describe("AgencyFilterDropdown", () => {
  it("renders the Agency button", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /agency/i })).toBeInTheDocument();
  });

  it("opens dropdown on click and lists all agencies", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.getByText("arrivia")).toBeInTheDocument();
    expect(screen.getByText("Acme Consulting")).toBeInTheDocument();
    expect(screen.getByText("Beta Corp")).toBeInTheDocument();
  });

  it("shows FTE and Contractor badges", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.getByText("FTE")).toBeInTheDocument();
    expect(screen.getByText("Contractor")).toBeInTheDocument();
  });

  it("shows member count for each agency", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onChange with selected agency when clicked", () => {
    const onChange = jest.fn();
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    fireEvent.click(screen.getByText("arrivia"));
    expect(onChange).toHaveBeenCalledWith(new Set(["arrivia"]));
  });

  it("calls onChange to deselect when already selected", () => {
    const onChange = jest.fn();
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set(["arrivia"])}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    fireEvent.click(screen.getByText("arrivia"));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it("shows count badge when agencies are selected", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set(["arrivia", "Acme Consulting"])}
        onChange={() => {}}
      />
    );
    // The badge text "2" inside the button
    const button = screen.getByRole("button", { name: /agency/i });
    expect(button).toHaveTextContent("2");
  });

  it("shows 'Clear filter' when agencies are selected", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set(["arrivia"])}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.getByText("Clear filter")).toBeInTheDocument();
  });

  it("does not show 'Clear filter' when no agencies are selected", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.queryByText("Clear filter")).not.toBeInTheDocument();
  });

  it("clears selection when 'Clear filter' is clicked", () => {
    const onChange = jest.fn();
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set(["arrivia"])}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    fireEvent.click(screen.getByText("Clear filter"));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });

  it("closes dropdown on outside click", () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <AgencyFilterDropdown
          agencies={agencies}
          selected={new Set()}
          onChange={() => {}}
        />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.getByText("arrivia")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("arrivia")).not.toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set()}
        onChange={() => {}}
        disabled
      />
    );
    expect(screen.getByRole("button", { name: /agency/i })).toBeDisabled();
  });

  it("is disabled when agencies list is empty", () => {
    render(
      <AgencyFilterDropdown
        agencies={[]}
        selected={new Set()}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /agency/i })).toBeDisabled();
  });

  it("supports multi-select (OR logic)", () => {
    const onChange = jest.fn();
    render(
      <AgencyFilterDropdown
        agencies={agencies}
        selected={new Set(["arrivia"])}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    fireEvent.click(screen.getByText("Acme Consulting"));
    expect(onChange).toHaveBeenCalledWith(new Set(["arrivia", "Acme Consulting"]));
  });
});
