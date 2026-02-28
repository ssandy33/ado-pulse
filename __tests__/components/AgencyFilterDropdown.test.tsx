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

  describe("keyboard navigation", () => {
    it("sets aria-expanded on trigger button", () => {
      render(
        <AgencyFilterDropdown
          agencies={agencies}
          selected={new Set()}
          onChange={() => {}}
        />
      );
      const button = screen.getByRole("button", { name: /agency/i });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("closes dropdown on Escape", () => {
      render(
        <AgencyFilterDropdown
          agencies={agencies}
          selected={new Set()}
          onChange={() => {}}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("renders items with menuitemcheckbox role and aria-checked", () => {
      render(
        <AgencyFilterDropdown
          agencies={agencies}
          selected={new Set(["arrivia"])}
          onChange={() => {}}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));

      const items = screen.getAllByRole("menuitemcheckbox");
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveAttribute("aria-checked", "true"); // arrivia selected
      expect(items[1]).toHaveAttribute("aria-checked", "false");
    });

    it("moves focus with ArrowDown/ArrowUp", () => {
      render(
        <AgencyFilterDropdown
          agencies={agencies}
          selected={new Set()}
          onChange={() => {}}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const menu = screen.getByRole("menu");
      const items = screen.getAllByRole("menuitemcheckbox");

      fireEvent.keyDown(menu, { key: "ArrowDown" });
      expect(document.activeElement).toBe(items[0]);

      fireEvent.keyDown(menu, { key: "ArrowDown" });
      expect(document.activeElement).toBe(items[1]);

      fireEvent.keyDown(menu, { key: "ArrowUp" });
      expect(document.activeElement).toBe(items[0]);
    });
  });
});
