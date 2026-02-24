/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AlignmentKPITile } from "@/components/AlignmentKPITile";
import type { AlignmentApiResponse, AlignmentPR } from "@/lib/ado/types";

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makePR(
  overrides: Partial<AlignmentPR> & { pullRequestId: number; title: string }
): AlignmentPR {
  return {
    author: "Alice",
    repoName: "my-repo",
    mergedDate: "2025-01-10T00:00:00Z",
    workItem: null,
    url: `https://dev.azure.com/org/proj/_git/my-repo/pullrequest/${overrides.pullRequestId}`,
    ...overrides,
  };
}

const alignedPR = makePR({
  pullRequestId: 1,
  title: "Aligned PR title",
  author: "Alice",
  repoName: "my-repo",
  workItem: { id: 100, title: "My work item", areaPath: "Project\\TeamA\\Sub" },
});

const outOfScopePR = makePR({
  pullRequestId: 2,
  title: "Out of scope PR title",
  author: "Bob",
  repoName: "other-repo",
  workItem: { id: 200, title: "Other item", areaPath: "Project\\TeamB" },
});

const unlinkedPR = makePR({
  pullRequestId: 3,
  title: "Unlinked PR title",
  author: "Alice",
  repoName: "unlinked-repo",
  workItem: null,
});

function makeData(
  overrides: {
    aligned?: number;
    outOfScope?: number;
    unlinked?: number;
    alignedPRs?: AlignmentPR[];
    outOfScopePRs?: AlignmentPR[];
    unlinkedPRs?: AlignmentPR[];
  } = {}
): AlignmentApiResponse {
  const alignedCount = overrides.aligned ?? 1;
  const outOfScopeCount = overrides.outOfScope ?? 1;
  const unlinkedCount = overrides.unlinked ?? 1;
  const total = alignedCount + outOfScopeCount + unlinkedCount;
  const alignedPct = total > 0 ? Math.round((alignedCount / total) * 100) : 0;

  return {
    period: {
      days: 14,
      from: "2025-01-01",
      to: "2025-01-14",
      label: "Last 14 days",
    },
    teamAreaPath: "Project\\TeamA",
    alignment: {
      total,
      aligned: alignedCount,
      outOfScope: outOfScopeCount,
      unlinked: unlinkedCount,
      alignedPct,
      teamAreaPath: "Project\\TeamA",
    },
    members: [],
    categorizedPRs: {
      aligned: overrides.alignedPRs ?? [alignedPR],
      outOfScope: overrides.outOfScopePRs ?? [outOfScopePR],
      unlinked: overrides.unlinkedPRs ?? [unlinkedPR],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AlignmentKPITile", () => {
  describe("renders percentage and counts", () => {
    it("should display the aligned percentage", () => {
      render(<AlignmentKPITile data={makeData()} />);

      // 1 aligned out of 3 total = 33%
      expect(screen.getByText(/33%/)).toBeInTheDocument();
    });

    it("should display all three counts in the summary line", () => {
      render(<AlignmentKPITile data={makeData()} />);

      // Each count (1, 1, 1) should be visible
      // They render as buttons, so query by role to be precise
      const buttons = screen.getAllByRole("button");
      const buttonTexts = buttons.map((b) => b.textContent);
      expect(buttonTexts).toContain("1"); // aligned
      // outOfScope and unlinked also show "1" — at least two buttons with "1"
      expect(buttons).toHaveLength(3);
    });

    it("should display the period label", () => {
      render(<AlignmentKPITile data={makeData()} />);

      expect(screen.getByText("Last 14 days")).toBeInTheDocument();
    });

    it("should show 100% in emerald colour class when fully aligned", () => {
      const data = makeData({ aligned: 3, outOfScope: 0, unlinked: 0 });
      // Override categorized arrays to match count=0 for the non-aligned categories
      data.categorizedPRs.outOfScope = [];
      data.categorizedPRs.unlinked = [];
      render(<AlignmentKPITile data={data} />);

      const pctEl = screen.getByText("100%");
      expect(pctEl).toHaveClass("text-emerald-600");
    });
  });

  describe("count buttons", () => {
    it("should render aligned count as a button when count is > 0", () => {
      render(<AlignmentKPITile data={makeData()} />);

      // All three counts are 1; each is a button
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      expect(buttons[0]).toHaveTextContent("1");
    });

    it("should render out-of-scope count as a button when count is > 0", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const buttons = screen.getAllByRole("button");
      // There should be 3 buttons: aligned, outOfScope, unlinked
      expect(buttons).toHaveLength(3);
    });

    it("should render unlinked count as a button when count is > 0", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("should NOT render a button for a count of zero", () => {
      const data = makeData({ aligned: 5, outOfScope: 0, unlinked: 2 });
      data.categorizedPRs.outOfScope = [];
      render(<AlignmentKPITile data={data} />);

      // Only aligned and unlinked should be buttons — outOfScope is 0 so it's a <span>
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
      expect(buttons.map((b) => b.textContent)).not.toContain("0");
    });

    it("should show zero count as plain text (not a button)", () => {
      const data = makeData({ aligned: 5, outOfScope: 0, unlinked: 2 });
      data.categorizedPRs.outOfScope = [];
      render(<AlignmentKPITile data={data} />);

      // The "0" should appear in the DOM but NOT as a button
      expect(screen.getByText("0")).toBeInTheDocument();
      const zeroEl = screen.getByText("0");
      expect(zeroEl.tagName).not.toBe("BUTTON");
    });
  });

  describe("drill-down panel — expand and collapse", () => {
    it("should show no drill-down panel on initial render", () => {
      render(<AlignmentKPITile data={makeData()} />);

      // None of the column headers should be visible until a button is clicked
      expect(screen.queryByText("PR Title")).not.toBeInTheDocument();
    });

    it("should expand the drill-down panel when the aligned count is clicked", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      // The DataTable column header should now appear
      expect(screen.getByText("PR Title")).toBeInTheDocument();
    });

    it("should show the aligned PR title in the drill-down table", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      expect(screen.getByText("Aligned PR title")).toBeInTheDocument();
    });

    it("should collapse the panel when the same count button is clicked twice", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn); // expand
      fireEvent.click(alignedBtn); // collapse

      expect(screen.queryByText("PR Title")).not.toBeInTheDocument();
    });

    it("should set aria-expanded to true on the active button", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      expect(alignedBtn).toHaveAttribute("aria-expanded", "true");
    });

    it("should set aria-expanded to false on other (inactive) buttons", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn, outOfScopeBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      expect(outOfScopeBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("should switch the panel when a different count button is clicked", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn, , unlinkedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);
      expect(screen.getByText("Aligned PR title")).toBeInTheDocument();

      fireEvent.click(unlinkedBtn);
      expect(screen.queryByText("Aligned PR title")).not.toBeInTheDocument();
      expect(screen.getByText("Unlinked PR title")).toBeInTheDocument();
    });
  });

  describe("drill-down panel — unlinked PRs", () => {
    it("should show 'No work item' text in red for unlinked PRs", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, , unlinkedBtn] = screen.getAllByRole("button");
      fireEvent.click(unlinkedBtn);

      const noWorkItemEl = screen.getByText(/No work item/i);
      expect(noWorkItemEl).toBeInTheDocument();
      expect(noWorkItemEl).toHaveClass("text-red-500");
    });

    it("should show the unlinked PR in the table", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, , unlinkedBtn] = screen.getAllByRole("button");
      fireEvent.click(unlinkedBtn);

      expect(screen.getByText("Unlinked PR title")).toBeInTheDocument();
    });

    it("should display the panel header label for unlinked category", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, , unlinkedBtn] = screen.getAllByRole("button");
      fireEvent.click(unlinkedBtn);

      expect(screen.getByText(/Unlinked PRs \(1\)/)).toBeInTheDocument();
    });
  });

  describe("drill-down panel — out-of-scope PRs", () => {
    it("should show the out-of-scope PR title in the table", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, outOfScopeBtn] = screen.getAllByRole("button");
      fireEvent.click(outOfScopeBtn);

      expect(screen.getByText("Out of scope PR title")).toBeInTheDocument();
    });

    it("should show the work item title for an out-of-scope PR", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, outOfScopeBtn] = screen.getAllByRole("button");
      fireEvent.click(outOfScopeBtn);

      expect(screen.getByText("Other item")).toBeInTheDocument();
    });

    it("should show the work item area path for an out-of-scope PR", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, outOfScopeBtn] = screen.getAllByRole("button");
      fireEvent.click(outOfScopeBtn);

      expect(screen.getByText("Project\\TeamB")).toBeInTheDocument();
    });

    it("should display the panel header label for out-of-scope category", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [, outOfScopeBtn] = screen.getAllByRole("button");
      fireEvent.click(outOfScopeBtn);

      expect(screen.getByText(/Out-of-Scope PRs \(1\)/)).toBeInTheDocument();
    });
  });

  describe("drill-down panel — aligned PRs", () => {
    it("should show the work item title for an aligned PR", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      expect(screen.getByText("My work item")).toBeInTheDocument();
    });

    it("should NOT show the area path for an aligned PR (only shown for out-of-scope)", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      // Area path only renders for outOfScope category
      expect(screen.queryByText("Project\\TeamA\\Sub")).not.toBeInTheDocument();
    });

    it("should display the panel header label for aligned category", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      expect(screen.getByText(/Aligned PRs \(1\)/)).toBeInTheDocument();
    });
  });

  describe("PR links", () => {
    it("should render an end-of-row link icon with the correct href", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      const links = screen.getAllByRole("link");
      const prLink = links.find((l) =>
        l.getAttribute("href")?.includes("pullrequest/1")
      );
      expect(prLink).toBeDefined();
      expect(prLink).toHaveAttribute(
        "href",
        "https://dev.azure.com/org/proj/_git/my-repo/pullrequest/1"
      );
    });

    it("should open PR links in a new tab", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      const links = screen.getAllByRole("link");
      const prLink = links.find((l) =>
        l.getAttribute("href")?.includes("pullrequest/1")
      );
      expect(prLink).toHaveAttribute("target", "_blank");
      expect(prLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should style the link icon with pulse-accent", () => {
      render(<AlignmentKPITile data={makeData()} />);

      const [alignedBtn] = screen.getAllByRole("button");
      fireEvent.click(alignedBtn);

      const links = screen.getAllByRole("link");
      const prLink = links.find((l) =>
        l.getAttribute("href")?.includes("pullrequest/1")
      );
      expect(prLink).toHaveClass("text-pulse-accent");
    });
  });
});
