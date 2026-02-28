/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemberTable } from "@/components/MemberTable";
import type { MemberSummary, MemberProfile } from "@/lib/ado/types";

// ---------------------------------------------------------------------------
// Mock EmailTooltip to simplify rendering
// ---------------------------------------------------------------------------
jest.mock("@/components/EmailTooltip", () => ({
  EmailTooltip: ({ displayName }: { displayName: string }) => (
    <span>{displayName}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMember(overrides: Partial<MemberSummary> & { id: string; displayName: string }): MemberSummary {
  return {
    uniqueName: `${overrides.displayName.toLowerCase().replace(/\s/g, ".")}@example.com`,
    prCount: 3,
    repos: ["repo-a"],
    lastPRDate: "2025-06-01T00:00:00Z",
    isActive: true,
    reviewsGiven: 2,
    reviewFlagged: false,
    isExcluded: false,
    role: null,
    prs: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<MemberProfile> & { adoId: string }): MemberProfile {
  return {
    displayName: "Member",
    email: "member@example.com",
    employmentType: "fte",
    agency: "arrivia",
    ...overrides,
  };
}

const alice = makeMember({ id: "alice-id", displayName: "Alice" });
const bob = makeMember({ id: "bob-id", displayName: "Bob" });
const charlie = makeMember({ id: "charlie-id", displayName: "Charlie" });

const aliceProfile = makeProfile({
  adoId: "alice-id",
  displayName: "Alice",
  email: "alice@example.com",
  employmentType: "fte",
  agency: "arrivia",
});

const bobProfile = makeProfile({
  adoId: "bob-id",
  displayName: "Bob",
  email: "bob@contractor.com",
  employmentType: "contractor",
  agency: "Acme Consulting",
});

function buildLookup(...profiles: MemberProfile[]): Map<string, MemberProfile> {
  return new Map(profiles.map((p) => [p.adoId, p]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MemberTable", () => {
  const defaultProps = {
    members: [alice, bob, charlie],
    teamName: "Team Alpha",
  };

  it("renders all member names", () => {
    render(<MemberTable {...defaultProps} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders team name in header", () => {
    render(<MemberTable {...defaultProps} />);
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });

  describe("agency badge", () => {
    it("renders blue badge for FTE member", () => {
      const lookup = buildLookup(aliceProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      const badges = screen.getAllByTestId("agency-badge");
      const aliceBadge = badges.find((b) => b.textContent === "arrivia");
      expect(aliceBadge).toBeInTheDocument();
      expect(aliceBadge).toHaveClass("bg-blue-50", "text-blue-600");
    });

    it("renders amber badge for contractor member", () => {
      const lookup = buildLookup(bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      const badges = screen.getAllByTestId("agency-badge");
      const bobBadge = badges.find((b) => b.textContent === "Acme Consulting");
      expect(bobBadge).toBeInTheDocument();
      expect(bobBadge).toHaveClass("bg-amber-50", "text-amber-600");
    });

    it("does not render badge for members without a profile", () => {
      const lookup = buildLookup(aliceProfile); // only alice
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      const badges = screen.getAllByTestId("agency-badge");
      expect(badges).toHaveLength(1); // only alice's badge
    });

    it("renders no badges when agencyLookup is empty", () => {
      render(<MemberTable {...defaultProps} agencyLookup={new Map()} />);
      expect(screen.queryAllByTestId("agency-badge")).toHaveLength(0);
    });
  });

  describe("agency filter dropdown", () => {
    it("shows Agency button when profiles exist", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      expect(screen.getByRole("button", { name: /agency/i })).toBeInTheDocument();
    });

    it("disables Agency button when no profiles loaded", () => {
      render(<MemberTable {...defaultProps} agencyLookup={new Map()} />);
      expect(screen.getByRole("button", { name: /agency/i })).toBeDisabled();
    });

    it("does not show the old 'Group by agency' toggle", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      expect(screen.queryByRole("button", { name: /group by agency/i })).not.toBeInTheDocument();
    });

    it("lists available agencies in dropdown with counts", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      // "arrivia" also appears as a badge — use getAllByText
      expect(screen.getAllByText("arrivia").length).toBeGreaterThanOrEqual(2);
      // Acme Consulting appears in badge + dropdown
      expect(screen.getAllByText("Acme Consulting").length).toBeGreaterThanOrEqual(2);
    });

    it("sorts FTE first, then contractors alphabetically", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const fteLabel = screen.getByText("FTE");
      const contractorLabel = screen.getByText("Contractor");
      // FTE should appear before Contractor in the DOM
      expect(fteLabel.compareDocumentPosition(contractorLabel)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it("filters table to only matching members when agency selected", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      // All visible initially
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();

      // Select arrivia (FTE) — click the dropdown item (text-[12px] span inside the dropdown)
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const arriviaItems = screen.getAllByText("arrivia");
      // The dropdown item is the one inside the dropdown panel (has class text-[12px])
      const dropdownItem = arriviaItems.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);

      // Only Alice should remain visible
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      // Charlie (unlabelled) hidden when filter active
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    });

    it("hides unlabelled members when any agency filter is active", () => {
      const lookup = buildLookup(aliceProfile); // only Alice has a profile
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);

      // Charlie and Bob have no profile → hidden
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    });

    it("shows count badge on button when filters active", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);

      const button = screen.getByRole("button", { name: /agency/i });
      expect(button).toHaveTextContent("1");
    });

    it("restores full list when all filters cleared", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      // Select arrivia
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();

      // Dropdown is still open after selection — click Clear filter directly
      fireEvent.click(screen.getByText("Clear filter"));

      // All visible again
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("resets filter when members prop changes (team change)", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      const { rerender } = render(
        <MemberTable {...defaultProps} agencyLookup={lookup} />
      );

      // Apply filter
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();

      // Rerender with new members (team change)
      const newMembers = [makeMember({ id: "dave-id", displayName: "Dave" })];
      rerender(
        <MemberTable
          members={newMembers}
          teamName="Team Beta"
          agencyLookup={lookup}
        />
      );

      // Dave should be visible (filter reset)
      expect(screen.getByText("Dave")).toBeInTheDocument();
    });
  });

  describe("prop-driven filter interface", () => {
    it("calls onAgencyFilterChange when agency is selected", () => {
      const onFilterChange = jest.fn();
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(
        <MemberTable
          {...defaultProps}
          agencyLookup={lookup}
          agencyFilter={new Set()}
          onAgencyFilterChange={onFilterChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);

      expect(onFilterChange).toHaveBeenCalledTimes(1);
      const newFilter = onFilterChange.mock.calls[0][0];
      expect(newFilter).toBeInstanceOf(Set);
      expect(newFilter.has("arrivia")).toBe(true);
    });

    it("calls onAgencyFilterChange with empty Set when filter cleared", () => {
      const onFilterChange = jest.fn();
      const lookup = buildLookup(aliceProfile, bobProfile);
      // Start with arrivia selected
      render(
        <MemberTable
          {...defaultProps}
          agencyLookup={lookup}
          agencyFilter={new Set(["arrivia"])}
          onAgencyFilterChange={onFilterChange}
        />
      );

      // Only Alice visible (filter active)
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();

      // Open dropdown and click Clear filter
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      fireEvent.click(screen.getByText("Clear filter"));

      // Should call back with empty Set
      const clearCall = onFilterChange.mock.calls.find(
        (call: [Set<string>]) => call[0].size === 0
      );
      expect(clearCall).toBeDefined();
      expect(clearCall![0]).toEqual(new Set());
    });

    it("shows all members when agencyFilter prop is empty Set", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(
        <MemberTable
          {...defaultProps}
          agencyLookup={lookup}
          agencyFilter={new Set()}
          onAgencyFilterChange={() => {}}
        />
      );

      // All members visible with empty filter
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("uses agencyFilter prop for filtering when provided", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(
        <MemberTable
          {...defaultProps}
          agencyLookup={lookup}
          agencyFilter={new Set(["arrivia"])}
          onAgencyFilterChange={() => {}}
        />
      );

      // Only Alice should be visible since the filter is set to arrivia
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    });
  });

  describe("expand/collapse in flat view", () => {
    it("expands member row on click when member has PRs", () => {
      const memberWithPRs = makeMember({
        id: "alice-id",
        displayName: "Alice",
        prs: [
          {
            pullRequestId: 1,
            title: "Fix bug",
            repoName: "repo-a",
            creationDate: "2025-06-01T00:00:00Z",
            url: "https://example.com/pr/1",
          },
        ],
      });
      render(<MemberTable members={[memberWithPRs]} teamName="Team" />);

      // Click the expand button
      const expandBtn = screen.getByRole("button", { name: /expand/i });
      fireEvent.click(expandBtn);

      expect(screen.getByText("Fix bug")).toBeInTheDocument();
    });
  });

  describe("expand/collapse in filtered view", () => {
    it("expands member row in filtered state", () => {
      const memberWithPRs = makeMember({
        id: "alice-id",
        displayName: "Alice",
        prs: [
          {
            pullRequestId: 1,
            title: "Add feature",
            repoName: "repo-a",
            creationDate: "2025-06-01T00:00:00Z",
            url: "https://example.com/pr/1",
          },
        ],
      });
      const lookup = buildLookup(aliceProfile);
      render(
        <MemberTable
          members={[memberWithPRs, bob]}
          teamName="Team"
          agencyLookup={lookup}
        />
      );

      // Apply filter
      fireEvent.click(screen.getByRole("button", { name: /agency/i }));
      const items = screen.getAllByText("arrivia");
      const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
      fireEvent.click(dropdownItem!.closest("button")!);

      // Expand Alice's row
      const expandBtn = screen.getByRole("button", { name: /expand/i });
      fireEvent.click(expandBtn);

      expect(screen.getByText("Add feature")).toBeInTheDocument();
    });
  });
});
