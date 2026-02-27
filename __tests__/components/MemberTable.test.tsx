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

  describe("group-by-agency toggle", () => {
    it("shows toggle button when profiles exist", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);
      expect(screen.getByRole("button", { name: /group by agency/i })).toBeInTheDocument();
    });

    it("does not show toggle button when no profiles", () => {
      render(<MemberTable {...defaultProps} agencyLookup={new Map()} />);
      expect(screen.queryByRole("button", { name: /group by agency/i })).not.toBeInTheDocument();
    });

    it("does not show toggle button when agencyLookup is undefined", () => {
      render(<MemberTable {...defaultProps} />);
      expect(screen.queryByRole("button", { name: /group by agency/i })).not.toBeInTheDocument();
    });

    it("groups members under agency headers when toggled on", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      fireEvent.click(screen.getByRole("button", { name: /group by agency/i }));

      // Agency group headers should appear
      expect(screen.getByTestId("agency-group-arrivia")).toBeInTheDocument();
      expect(screen.getByTestId("agency-group-Acme Consulting")).toBeInTheDocument();
      expect(screen.getByTestId("agency-group-Unlabelled")).toBeInTheDocument();
    });

    it("shows member count in group headers", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      fireEvent.click(screen.getByRole("button", { name: /group by agency/i }));

      // Each group has 1 member: arrivia (Alice), Acme (Bob), Unlabelled (Charlie)
      const arriviaHeader = screen.getByTestId("agency-group-arrivia");
      expect(arriviaHeader).toHaveTextContent("arrivia");
      expect(arriviaHeader).toHaveTextContent("1 member");

      const unlabelledHeader = screen.getByTestId("agency-group-Unlabelled");
      expect(unlabelledHeader).toHaveTextContent("Unlabelled");
      expect(unlabelledHeader).toHaveTextContent("1 member");
    });

    it("sorts FTE groups before contractor groups, Unlabelled last", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      fireEvent.click(screen.getByRole("button", { name: /group by agency/i }));

      const groupHeaders = screen.getAllByTestId(/^agency-group-/);
      expect(groupHeaders).toHaveLength(3);
      expect(groupHeaders[0]).toHaveAttribute("data-testid", "agency-group-arrivia");
      expect(groupHeaders[1]).toHaveAttribute("data-testid", "agency-group-Acme Consulting");
      expect(groupHeaders[2]).toHaveAttribute("data-testid", "agency-group-Unlabelled");
    });

    it("returns to flat view when toggled off", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      render(<MemberTable {...defaultProps} agencyLookup={lookup} />);

      const toggleBtn = screen.getByRole("button", { name: /group by agency/i });
      fireEvent.click(toggleBtn); // on
      expect(screen.queryAllByTestId(/^agency-group-/).length).toBeGreaterThan(0);

      fireEvent.click(toggleBtn); // off
      expect(screen.queryAllByTestId(/^agency-group-/)).toHaveLength(0);
    });

    it("resets toggle when members prop changes", () => {
      const lookup = buildLookup(aliceProfile, bobProfile);
      const { rerender } = render(
        <MemberTable {...defaultProps} agencyLookup={lookup} />
      );

      // Toggle on
      fireEvent.click(screen.getByRole("button", { name: /group by agency/i }));
      expect(screen.queryAllByTestId(/^agency-group-/).length).toBeGreaterThan(0);

      // Rerender with new members (simulating team change)
      const newMembers = [makeMember({ id: "dave-id", displayName: "Dave" })];
      rerender(
        <MemberTable
          members={newMembers}
          teamName="Team Beta"
          agencyLookup={lookup}
        />
      );

      // Grouped view should be reset
      expect(screen.queryAllByTestId(/^agency-group-/)).toHaveLength(0);
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

  describe("expand/collapse in grouped view", () => {
    it("expands member row on click within a group", () => {
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
          members={[memberWithPRs]}
          teamName="Team"
          agencyLookup={lookup}
        />
      );

      // Toggle grouping on
      fireEvent.click(screen.getByRole("button", { name: /group by agency/i }));

      // Expand Alice's row
      const expandBtn = screen.getByRole("button", { name: /expand/i });
      fireEvent.click(expandBtn);

      expect(screen.getByText("Add feature")).toBeInTheDocument();
    });
  });
});
