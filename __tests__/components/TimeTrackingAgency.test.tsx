/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeTrackingTab } from "@/components/TimeTrackingTab";
import type { MemberProfile, MemberTimeEntry, TeamTimeData } from "@/lib/ado/types";

// ---------------------------------------------------------------------------
// Mock EmailTooltip to avoid navigator.clipboard issues in jsdom
// ---------------------------------------------------------------------------
jest.mock("@/components/EmailTooltip", () => ({
  EmailTooltip: ({ displayName }: { displayName: string }) => (
    <span>{displayName}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Mock fetch — discriminate between settings/members and timetracking URLs
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

const defaultHeaders = {
  "x-ado-org": "test-org",
  "x-ado-project": "test-project",
  "x-ado-pat": "test-pat",
};

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMember(overrides: Partial<MemberTimeEntry> & { uniqueName: string; displayName: string }): MemberTimeEntry {
  return {
    totalHours: 10,
    capExHours: 6,
    opExHours: 3,
    unclassifiedHours: 1,
    wrongLevelHours: 0,
    wrongLevelCount: 0,
    isExcluded: false,
    role: null,
    features: [],
    ...overrides,
  };
}

const alice = makeMember({ uniqueName: "alice@arrivia.com", displayName: "Alice" });
const bob = makeMember({ uniqueName: "bob@acme.com", displayName: "Bob", totalHours: 8, capExHours: 5, opExHours: 2, unclassifiedHours: 1 });
const charlie = makeMember({ uniqueName: "charlie@example.com", displayName: "Charlie", totalHours: 0, capExHours: 0, opExHours: 0, unclassifiedHours: 0 });
const dave = makeMember({ uniqueName: "dave@acme.com", displayName: "Dave", totalHours: 0, capExHours: 0, opExHours: 0, unclassifiedHours: 0 });

const aliceProfile: MemberProfile = {
  adoId: "alice-id",
  displayName: "Alice",
  email: "alice@arrivia.com",
  employmentType: "fte",
  agency: "arrivia",
};

const bobProfile: MemberProfile = {
  adoId: "bob-id",
  displayName: "Bob",
  email: "bob@acme.com",
  employmentType: "contractor",
  agency: "Acme Consulting",
};

const daveProfile: MemberProfile = {
  adoId: "dave-id",
  displayName: "Dave",
  email: "dave@acme.com",
  employmentType: "contractor",
  agency: "Acme Consulting",
};

function makeTimeData(members: MemberTimeEntry[]): TeamTimeData {
  const active = members.filter((m) => !m.isExcluded);
  const notLogging = active.filter((m) => m.totalHours === 0).length;
  return {
    sevenPaceConnected: true,
    period: { days: 7, from: "2026-02-13", to: "2026-02-20", label: "last 7 days" },
    team: { name: "Partner", totalMembers: members.length },
    summary: {
      totalHours: active.reduce((s, m) => s + m.totalHours, 0),
      capExHours: active.reduce((s, m) => s + m.capExHours, 0),
      opExHours: active.reduce((s, m) => s + m.opExHours, 0),
      unclassifiedHours: active.reduce((s, m) => s + m.unclassifiedHours, 0),
      membersLogging: active.length - notLogging,
      membersNotLogging: notLogging,
      wrongLevelCount: 0,
    },
    members,
    wrongLevelEntries: [],
  };
}

function setupFetchMock(profiles: MemberProfile[], members: MemberTimeEntry[]) {
  const timeData = makeTimeData(members);
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/settings/members")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ profiles }),
      });
    }
    // timetracking endpoint
    return Promise.resolve({
      ok: true,
      json: async () => timeData,
    });
  });
}

async function renderAndWait(profiles: MemberProfile[], members: MemberTimeEntry[]) {
  setupFetchMock(profiles, members);
  const result = render(
    <TimeTrackingTab
      adoHeaders={defaultHeaders}
      selectedTeam="Partner"
      range="7"
    />
  );
  // Wait for data to load
  await waitFor(() => expect(screen.getByText("Member Time Breakdown")).toBeInTheDocument());
  return result;
}

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TimeTrackingTab — agency badge", () => {
  it("renders blue badge for FTE member", async () => {
    await renderAndWait([aliceProfile], [alice]);
    const badges = screen.getAllByTestId("agency-badge");
    const aliceBadge = badges.find((b) => b.textContent === "arrivia");
    expect(aliceBadge).toBeInTheDocument();
    expect(aliceBadge).toHaveClass("bg-blue-50", "text-blue-600");
  });

  it("renders amber badge for contractor member", async () => {
    await renderAndWait([bobProfile], [bob]);
    const badges = screen.getAllByTestId("agency-badge");
    const bobBadge = badges.find((b) => b.textContent === "Acme Consulting");
    expect(bobBadge).toBeInTheDocument();
    expect(bobBadge).toHaveClass("bg-amber-50", "text-amber-600");
  });

  it("renders no badge for members without a profile", async () => {
    await renderAndWait([aliceProfile], [alice, charlie]);
    const badges = screen.getAllByTestId("agency-badge");
    expect(badges).toHaveLength(1); // only alice
  });

  it("renders no badges when profiles fetch returns empty", async () => {
    await renderAndWait([], [alice, bob]);
    expect(screen.queryAllByTestId("agency-badge")).toHaveLength(0);
  });
});

describe("TimeTrackingTab — agency toggle", () => {
  it("shows Agency toggle button when profiles exist", async () => {
    await renderAndWait([aliceProfile], [alice]);
    expect(screen.getByRole("button", { name: /agency/i })).toBeInTheDocument();
  });

  it("hides Agency toggle when no profiles", async () => {
    await renderAndWait([], [alice]);
    expect(screen.queryByRole("button", { name: /agency/i })).not.toBeInTheDocument();
  });

  it("groups members under agency headers when toggled on", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    expect(screen.getByTestId("agency-group-arrivia")).toBeInTheDocument();
    expect(screen.getByTestId("agency-group-Acme Consulting")).toBeInTheDocument();
    expect(screen.getByTestId("agency-group-Unlabelled")).toBeInTheDocument();
  });

  it("shows hour subtotals in group headers", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    const arriviaHeader = screen.getByTestId("agency-group-arrivia");
    // Alice: 10.0h total
    expect(arriviaHeader).toHaveTextContent("10.0");

    const acmeHeader = screen.getByTestId("agency-group-Acme Consulting");
    // Bob: 8.0h total
    expect(acmeHeader).toHaveTextContent("8.0");
  });

  it("sorts FTE groups before contractor groups, Unlabelled last", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    const groupHeaders = screen.getAllByTestId(/^agency-group-/);
    expect(groupHeaders[0]).toHaveAttribute("data-testid", "agency-group-arrivia");
    expect(groupHeaders[1]).toHaveAttribute("data-testid", "agency-group-Acme Consulting");
    expect(groupHeaders[2]).toHaveAttribute("data-testid", "agency-group-Unlabelled");
  });

  it("returns to flat view when toggled off", async () => {
    await renderAndWait([aliceProfile], [alice]);
    const toggleBtn = screen.getByRole("button", { name: /agency/i });
    fireEvent.click(toggleBtn); // on
    expect(screen.queryAllByTestId(/^agency-group-/).length).toBeGreaterThan(0);
    fireEvent.click(toggleBtn); // off
    expect(screen.queryAllByTestId(/^agency-group-/)).toHaveLength(0);
  });

  it("shows not-logging count in group header when members have 0 hours", async () => {
    await renderAndWait([aliceProfile, bobProfile, daveProfile], [alice, bob, dave]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    const acmeHeader = screen.getByTestId("agency-group-Acme Consulting");
    expect(acmeHeader).toHaveTextContent("1 not logging");
  });
});

describe("TimeTrackingTab — Not Logging KPI agency breakdown", () => {
  it("shows agency breakdown when 2+ members not logging and profiles exist", async () => {
    await renderAndWait([bobProfile, daveProfile], [bob, charlie, dave]);
    // charlie (Unlabelled) and dave (Acme) are not logging
    const breakdown = screen.getByTestId("not-logging-agencies");
    expect(breakdown).toBeInTheDocument();
    expect(breakdown.textContent).toContain("Acme Consulting (1)");
    expect(breakdown.textContent).toContain("Unlabelled (1)");
  });

  it("hides agency breakdown when only 1 member not logging", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);
    // Only charlie (1 member) is not logging
    expect(screen.queryByTestId("not-logging-agencies")).not.toBeInTheDocument();
  });

  it("hides agency breakdown when no profiles loaded", async () => {
    await renderAndWait([], [alice, charlie, dave]);
    // 2 not logging but no profiles
    expect(screen.queryByTestId("not-logging-agencies")).not.toBeInTheDocument();
  });
});

describe("TimeTrackingTab — expand/collapse in grouped view", () => {
  it("expands member row within a group", async () => {
    const aliceWithFeatures = makeMember({
      uniqueName: "alice@arrivia.com",
      displayName: "Alice",
      features: [{
        featureId: 1,
        featureTitle: "Login Feature",
        expenseType: "CapEx",
        hours: 10,
        loggedAtWrongLevel: false,
      }],
    });
    await renderAndWait([aliceProfile], [aliceWithFeatures]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    // Click Alice's row to expand
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getByText(/Login Feature/)).toBeInTheDocument();
  });
});

describe("TimeTrackingTab — toggle resets on team change", () => {
  it("resets grouped view when team changes", async () => {
    setupFetchMock([aliceProfile], [alice]);
    const { rerender } = render(
      <TimeTrackingTab adoHeaders={defaultHeaders} selectedTeam="Partner" range="7" />
    );
    await waitFor(() => expect(screen.getByText("Member Time Breakdown")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    expect(screen.queryAllByTestId(/^agency-group-/).length).toBeGreaterThan(0);

    // Change team triggers fetchData which resets groupByAgency
    setupFetchMock([aliceProfile], [alice]);
    rerender(
      <TimeTrackingTab adoHeaders={defaultHeaders} selectedTeam="OtherTeam" range="7" />
    );
    await waitFor(() => expect(screen.getByText("Member Time Breakdown")).toBeInTheDocument());

    // Grouped view should be reset
    expect(screen.queryAllByTestId(/^agency-group-/)).toHaveLength(0);
  });
});
