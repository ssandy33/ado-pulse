/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemberAgencySettings } from "@/components/MemberAgencySettings";

// ── localStorage mock ────────────────────────────────────────

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

// ── fetch mock ───────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Test data ────────────────────────────────────────────────

const defaultHeaders = { "x-ado-org": "org", "x-ado-project": "proj", "x-ado-pat": "pat" };

const teamsResponse = {
  teams: [{ id: "t1", name: "Partner" }],
  default: "Partner",
};

const teamSummaryResponse = {
  period: { days: 7, from: "2026-02-20", to: "2026-02-27", label: "Last 7 days" },
  team: { name: "Partner", totalPRs: 5, activeContributors: 2, totalMembers: 2 },
  members: [
    {
      id: "abc123",
      displayName: "Shawn Sandy",
      uniqueName: "shawn@arrivia.com",
      prCount: 3,
      repos: [],
      lastPRDate: null,
      isActive: true,
      reviewsGiven: 0,
      reviewFlagged: false,
      isExcluded: false,
      role: null,
      prs: [],
    },
    {
      id: "def456",
      displayName: "Contractor Name",
      uniqueName: "name@vendor.com",
      prCount: 2,
      repos: [],
      lastPRDate: null,
      isActive: true,
      reviewsGiven: 0,
      reviewFlagged: false,
      isExcluded: false,
      role: null,
      prs: [],
    },
  ],
  byRepo: [],
  diagnostics: {
    period: { days: 7, from: "2026-02-20", to: "2026-02-27", label: "Last 7 days" },
    apiLimitHit: false,
    totalProjectPRs: 5,
    rosterMembers: [],
    summary: { totalRosterMembers: 2, membersWithPRs: 2, membersNotFound: 0, membersFoundButZero: 0 },
    confidence: "high" as const,
  },
};

const savedProfilesEmpty = { profiles: [] };

const savedProfilesWithContractor = {
  profiles: [
    {
      adoId: "def456",
      displayName: "Contractor Name",
      email: "name@vendor.com",
      employmentType: "contractor",
      agency: "Apex Staffing",
    },
  ],
};

function setupFetchMock(savedProfiles = savedProfilesEmpty) {
  mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/teams")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(teamsResponse),
      });
    }
    if (typeof url === "string" && url.includes("/api/settings/members")) {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(savedProfiles),
      });
    }
    if (typeof url === "string" && url.includes("/api/prs/team-summary")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(teamSummaryResponse),
      });
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────

async function renderAndExpand(savedProfiles = savedProfilesEmpty) {
  setupFetchMock(savedProfiles);
  await act(async () => {
    render(
      <MemberAgencySettings
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />,
    );
  });
  // Expand the collapsed section
  await act(async () => {
    const toggle = screen.getByRole("button", { name: /member agencies/i });
    fireEvent.click(toggle);
  });
  // Wait for members to appear
  await waitFor(() => {
    expect(screen.getByText("Shawn Sandy")).toBeInTheDocument();
  });
}

// ── Tests ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe("MemberAgencySettings", () => {
  it("renders the 'Member Agencies' collapsible section title", async () => {
    setupFetchMock();
    await act(async () => {
      render(
        <MemberAgencySettings
          adoHeaders={defaultHeaders}
          selectedTeam="Partner"
          range="7"
        />,
      );
    });
    expect(screen.getByText("Member Agencies")).toBeInTheDocument();
  });

  it("shows each team member as a row with type and agency controls", async () => {
    await renderAndExpand();

    expect(screen.getByText("Shawn Sandy")).toBeInTheDocument();
    expect(screen.getByText("Contractor Name")).toBeInTheDocument();

    // Each member row has a type select and agency input
    const selects = screen.getAllByRole("combobox");
    // 1 team selector + 2 employment type selects = 3
    expect(selects.length).toBeGreaterThanOrEqual(3);

    const textInputs = screen.getAllByPlaceholderText("Agency name");
    expect(textInputs).toHaveLength(2);
  });

  it("defaults new members to FTE with agency 'arrivia'", async () => {
    await renderAndExpand(savedProfilesEmpty);

    const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
    expect(agencyInputs[0].value).toBe("arrivia");
    expect(agencyInputs[1].value).toBe("arrivia");
  });

  it("loads saved profiles and shows existing agency values", async () => {
    await renderAndExpand(savedProfilesWithContractor);

    // Wait for the saved profile to be applied to the input
    await waitFor(() => {
      const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
      expect(agencyInputs[1].value).toBe("Apex Staffing");
    });

    const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
    expect(agencyInputs[0].value).toBe("arrivia");
  });

  it("auto-fills agency with 'arrivia' when switching type to FTE", async () => {
    await renderAndExpand(savedProfilesWithContractor);

    // Wait for saved profile merge
    await waitFor(() => {
      const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
      expect(agencyInputs[1].value).toBe("Apex Staffing");
    });

    // Get all employment type selects (skip first which is team selector)
    const selects = screen.getAllByRole("combobox");
    // selects[0] = team selector, selects[1] = Shawn's type, selects[2] = Contractor's type
    const contractorTypeSelect = selects[2];

    // Contractor is currently "contractor"; switch to FTE
    fireEvent.change(contractorTypeSelect, { target: { value: "fte" } });

    const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
    expect(agencyInputs[1].value).toBe("arrivia");
  });

  it("clears agency when switching type to Contractor", async () => {
    await renderAndExpand(savedProfilesEmpty);

    // Shawn defaults to FTE/arrivia; switch to Contractor
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "contractor" } });

    const agencyInputs = screen.getAllByPlaceholderText("Agency name") as HTMLInputElement[];
    expect(agencyInputs[0].value).toBe("");
  });

  it("fires POST to /api/settings/members when Save is clicked", async () => {
    await renderAndExpand();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    const postCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        call[0].includes("/api/settings/members") &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);

    const body = JSON.parse((postCalls[0][1] as RequestInit).body as string);
    expect(body.adoId).toBe("abc123");
    expect(body.displayName).toBe("Shawn Sandy");
    expect(body.employmentType).toBe("fte");
    expect(body.agency).toBe("arrivia");
  });

  it("shows success checkmark after successful save", async () => {
    await renderAndExpand();

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    // Checkmark character rendered via &#10003;
    await waitFor(() => {
      expect(screen.getByText("\u2713")).toBeInTheDocument();
    });
  });

  it("shows error feedback when POST fails", async () => {
    setupFetchMock();
    // Override mock to fail on POST
    const originalImpl = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (
        typeof url === "string" &&
        url.includes("/api/settings/members") &&
        opts?.method === "POST"
      ) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "fail" }),
        });
      }
      return originalImpl(url, opts);
    });

    await act(async () => {
      render(
        <MemberAgencySettings
          adoHeaders={defaultHeaders}
          selectedTeam="Partner"
          range="7"
        />,
      );
    });
    await act(async () => {
      const toggle = screen.getByRole("button", { name: /member agencies/i });
      fireEvent.click(toggle);
    });
    await waitFor(() => {
      expect(screen.getByText("Shawn Sandy")).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
    });
  });

  it("disables Save button when agency is empty", async () => {
    await renderAndExpand();

    // Switch to Contractor to clear agency
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "contractor" } });

    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).toBeDisabled();
  });
});
