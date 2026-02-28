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

/** Click the dropdown item for a given agency label */
function clickDropdownAgency(label: string) {
  const items = screen.getAllByText(label);
  const dropdownItem = items.find((el) => el.className.includes("text-[12px]"));
  fireEvent.click(dropdownItem!.closest("button")!);
}

/** Get the displayed value for a KPI card by its title */
function getKPIValue(title: string): string {
  const titleEl = screen.getByText(title);
  const card = titleEl.closest(".bg-pulse-card")!;
  // The value is a <p> with title attribute and font-mono class
  const valueParagraph = card.querySelector("p[title]") ?? card.querySelectorAll("p")[1];
  return valueParagraph?.textContent ?? "";
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

describe("TimeTrackingTab — agency filter dropdown", () => {
  it("shows Agency button when profiles exist", async () => {
    await renderAndWait([aliceProfile], [alice]);
    expect(screen.getByRole("button", { name: /agency/i })).toBeInTheDocument();
  });

  it("disables Agency button when no profiles loaded", async () => {
    await renderAndWait([], [alice]);
    expect(screen.getByRole("button", { name: /agency/i })).toBeDisabled();
  });

  it("does not show the old 'Group by agency' toggle", async () => {
    await renderAndWait([aliceProfile], [alice]);
    expect(screen.queryByRole("button", { name: /group by agency/i })).not.toBeInTheDocument();
  });

  it("lists agencies in dropdown with FTE/Contractor badge and counts", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    expect(screen.getByText("FTE")).toBeInTheDocument();
    expect(screen.getByText("Contractor")).toBeInTheDocument();
  });

  it("sorts FTE first in dropdown", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob]);
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));

    const fteLabel = screen.getByText("FTE");
    const contractorLabel = screen.getByText("Contractor");
    expect(fteLabel.compareDocumentPosition(contractorLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("filters table to only matching members when agency selected", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);

    // All visible initially
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();

    // Select arrivia
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("hides unlabelled members when any filter is active", async () => {
    await renderAndWait([aliceProfile], [alice, charlie]);

    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");

    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("shows count badge on button when filters active", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob]);

    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");

    const button = screen.getByRole("button", { name: /agency/i });
    expect(button).toHaveTextContent("1");
  });

  it("restores full list when Clear filter clicked", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);

    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    // Dropdown still open — click Clear filter
    fireEvent.click(screen.getByText("Clear filter"));

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("does not show dropdown on Feature View", async () => {
    await renderAndWait([aliceProfile], [alice]);

    // Switch to Feature View
    fireEvent.click(screen.getByText("Feature View"));

    // Feature Breakdown header should be visible, but no Agency button in it
    expect(screen.getByText("Feature Breakdown")).toBeInTheDocument();
    // The Agency button is in Member View only — it should not be rendered now
    expect(screen.queryByRole("button", { name: /agency/i })).not.toBeInTheDocument();
  });
});

describe("TimeTrackingTab — expand/collapse in filtered view", () => {
  it("expands member row in filtered state", async () => {
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
    await renderAndWait([aliceProfile, bobProfile], [aliceWithFeatures, bob]);

    // Apply filter
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");

    // Click Alice's row to expand
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getByText(/Login Feature/)).toBeInTheDocument();
  });
});

describe("TimeTrackingTab — filter resets on team change", () => {
  it("resets filter when team changes", async () => {
    setupFetchMock([aliceProfile, bobProfile], [alice, bob]);
    const { rerender } = render(
      <TimeTrackingTab adoHeaders={defaultHeaders} selectedTeam="Partner" range="7" />
    );
    await waitFor(() => expect(screen.getByText("Member Time Breakdown")).toBeInTheDocument());

    // Apply filter
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    // Change team
    setupFetchMock([aliceProfile, bobProfile], [alice, bob]);
    rerender(
      <TimeTrackingTab adoHeaders={defaultHeaders} selectedTeam="OtherTeam" range="7" />
    );
    await waitFor(() => expect(screen.getByText("Member Time Breakdown")).toBeInTheDocument());

    // Filter should be reset — both visible
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});

describe("TimeTrackingTab — KPI filtering by agency", () => {
  it("shows filtered hours when agency selected", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob, charlie]);

    // Before filter: total = 10 + 8 + 0 = 18
    expect(getKPIValue("Total Hours")).toBe("18.0");

    // Select arrivia (Alice only)
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");

    // After filter: total = 10 (Alice only)
    expect(getKPIValue("Total Hours")).toBe("10.0");
  });

  it("restores full-team KPIs when filter cleared", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob]);

    // Select arrivia
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("arrivia");
    expect(getKPIValue("Total Hours")).toBe("10.0");

    // Clear filter
    fireEvent.click(screen.getByText("Clear filter"));

    // Full team values restored: 10 + 8 = 18
    expect(getKPIValue("Total Hours")).toBe("18.0");
  });

  it("shows filtered CapEx/OpEx when agency selected", async () => {
    await renderAndWait([aliceProfile, bobProfile], [alice, bob]);

    // Before filter: capEx = 6 + 5 = 11, opEx = 3 + 2 = 5
    expect(getKPIValue("CapEx Hours")).toBe("11.0");
    expect(getKPIValue("OpEx Hours")).toBe("5.0");

    // Select Acme (Bob only)
    fireEvent.click(screen.getByRole("button", { name: /agency/i }));
    clickDropdownAgency("Acme Consulting");

    // After filter: capEx = 5, opEx = 2
    expect(getKPIValue("CapEx Hours")).toBe("5.0");
    expect(getKPIValue("OpEx Hours")).toBe("2.0");
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
