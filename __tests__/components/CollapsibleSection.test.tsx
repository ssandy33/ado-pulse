/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CollapsibleSection } from "@/components/CollapsibleSection";

const STORAGE_KEY = "pulse-section-test-id";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe("CollapsibleSection", () => {
  const defaultProps = {
    id: "test-id",
    title: "Section Title",
    description: "Section description text",
    children: <p>Section body content</p>,
  };

  describe("default expanded state", () => {
    it("should render title and description in the header", () => {
      render(<CollapsibleSection {...defaultProps} />);

      expect(screen.getByText("Section Title")).toBeInTheDocument();
      expect(screen.getByText("Section description text")).toBeInTheDocument();
    });

    it("should render children when expanded by default", () => {
      render(<CollapsibleSection {...defaultProps} />);

      expect(screen.getByText("Section body content")).toBeInTheDocument();
    });

    it("should set aria-expanded to true when expanded", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    it("should apply border-b class to header when expanded", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      // The header container wrapping the button has the border
      const header = toggleButton.closest("div[class*='px-5']");
      expect(header).toHaveClass("border-b");
    });

    it("should apply rotate-0 class to chevron when expanded", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const chevron = document
        .querySelector("svg")!;
      expect(chevron).toHaveClass("rotate-0");
      expect(chevron).not.toHaveClass("-rotate-90");
    });
  });

  describe("collapse behavior", () => {
    it("should hide children after clicking the toggle button", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      expect(screen.queryByText("Section body content")).not.toBeInTheDocument();
    });

    it("should set aria-expanded to false after collapsing", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });

    it("should apply -rotate-90 class to chevron when collapsed", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      const chevron = document.querySelector("svg")!;
      expect(chevron).toHaveClass("-rotate-90");
      expect(chevron).not.toHaveClass("rotate-0");
    });

    it("should remove border-b from header when collapsed", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      const header = toggleButton.closest("div[class*='px-5']");
      expect(header).not.toHaveClass("border-b");
    });

    it("should re-expand after clicking toggle twice", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);

      expect(screen.getByText("Section body content")).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("defaultExpanded prop", () => {
    it("should render collapsed when defaultExpanded is false and no localStorage entry exists", () => {
      render(<CollapsibleSection {...defaultProps} defaultExpanded={false} />);

      expect(screen.queryByText("Section body content")).not.toBeInTheDocument();
    });

    it("should set aria-expanded to false when defaultExpanded is false", () => {
      render(<CollapsibleSection {...defaultProps} defaultExpanded={false} />);

      const toggleButton = screen.getByRole("button");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("headerActions", () => {
    it("should render headerActions in the header", () => {
      render(
        <CollapsibleSection
          {...defaultProps}
          headerActions={<button type="button">Save</button>}
        />
      );

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("should render headerActions alongside the toggle button", () => {
      render(
        <CollapsibleSection
          {...defaultProps}
          headerActions={<span data-testid="header-action">Action</span>}
        />
      );

      expect(screen.getByTestId("header-action")).toBeInTheDocument();
      // Both the toggle button and the action are present
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByTestId("header-action")).toBeInTheDocument();
    });

    it("should not collapse the section when headerActions element is clicked", () => {
      render(
        <CollapsibleSection
          {...defaultProps}
          headerActions={<button type="button">Save</button>}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      // Body should still be visible — save button is NOT part of the toggle
      expect(screen.getByText("Section body content")).toBeInTheDocument();
      const toggleButton = screen.getByRole("button", { name: /section title/i });
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    it("should not render headerActions region when prop is omitted", () => {
      render(<CollapsibleSection {...defaultProps} />);

      // Only the toggle button should be present — no extra nodes
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });
  });

  describe("localStorage persistence", () => {
    it("should persist collapsed state to localStorage when toggled", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, "false");
    });

    it("should persist expanded state to localStorage when toggled back", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton); // collapse → "false"
      fireEvent.click(toggleButton); // expand → "true"

      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, "true");
    });

    it("should read persisted collapsed state from localStorage on mount", () => {
      // Pre-seed localStorage with a collapsed value
      localStorageMock.getItem.mockReturnValueOnce("false");

      render(<CollapsibleSection {...defaultProps} />);

      // Children should be hidden because localStorage says collapsed
      expect(screen.queryByText("Section body content")).not.toBeInTheDocument();
    });

    it("should read persisted expanded state from localStorage on mount", () => {
      // Section rendered with defaultExpanded false, but localStorage says true
      localStorageMock.getItem.mockReturnValueOnce("true");

      render(
        <CollapsibleSection {...defaultProps} defaultExpanded={false} />
      );

      // localStorage overrides defaultExpanded — should be expanded
      expect(screen.getByText("Section body content")).toBeInTheDocument();
    });

    it("should fall back to defaultExpanded when localStorage has no entry", () => {
      // getItem returns null by default (no entry)
      render(<CollapsibleSection {...defaultProps} defaultExpanded={true} />);

      expect(screen.getByText("Section body content")).toBeInTheDocument();
    });

    it("should use the correct localStorage key based on id prop", () => {
      render(
        <CollapsibleSection
          {...defaultProps}
          id="my-custom-section"
        />
      );

      const toggleButton = screen.getByRole("button");
      fireEvent.click(toggleButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "pulse-section-my-custom-section",
        "false"
      );
    });
  });

  describe("aria-controls and region", () => {
    it("should link button to content region via aria-controls", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      const controlsId = toggleButton.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();

      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("id", controlsId);
    });

    it("should set aria-labelledby on the region pointing to the button", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-labelledby", toggleButton.id);
    });

    it("should remove the region from the DOM when collapsed", () => {
      render(<CollapsibleSection {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    it("should set aria-labelledby and aria-describedby on the button", () => {
      render(<CollapsibleSection {...defaultProps} />);

      const toggleButton = screen.getByRole("button");
      const labelledById = toggleButton.getAttribute("aria-labelledby");
      const describedById = toggleButton.getAttribute("aria-describedby");

      expect(labelledById).toBeTruthy();
      expect(describedById).toBeTruthy();
      expect(document.getElementById(labelledById!)).toHaveTextContent("Section Title");
      expect(document.getElementById(describedById!)).toHaveTextContent("Section description text");
    });
  });

  describe("aria-expanded attribute", () => {
    it("should have aria-expanded true when expanded", () => {
      render(<CollapsibleSection {...defaultProps} />);

      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it("should have aria-expanded false after collapse", () => {
      render(<CollapsibleSection {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });

    it("should reflect localStorage state in aria-expanded on mount", () => {
      localStorageMock.getItem.mockReturnValueOnce("false");

      render(<CollapsibleSection {...defaultProps} />);

      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });
  });
});
