/**
 * @jest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeTrackingTab } from "@/components/TimeTrackingTab";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const defaultHeaders = {
  "x-ado-org": "test-org",
  "x-ado-project": "test-project",
};

const mockTimeData = (range: string) => ({
  ok: true,
  json: async () => ({
    sevenPaceConnected: true,
    period: { days: 7, from: "2026-02-13", to: "2026-02-20", label: `last ${range}` },
    team: { name: "Partner", totalMembers: 10 },
    summary: {
      totalHours: 65.5,
      capExHours: 37,
      opExHours: 28.5,
      unclassifiedHours: 0,
      membersLogging: 8,
      membersNotLogging: 2,
      wrongLevelCount: 0,
    },
    members: [],
    wrongLevelEntries: [],
    governance: {
      expectedHours: 400,
      businessDays: 5,
      hoursPerDay: 8,
      activeMembers: 10,
      compliancePct: 16.4,
      isCompliant: false,
    },
  }),
});

beforeEach(() => {
  mockFetch.mockResolvedValue(mockTimeData("7"));
});

afterEach(() => jest.clearAllMocks());

describe("TimeTrackingTab — re-fetches on range change", () => {
  it("makes an API call on initial render with the correct range", async () => {
    render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("range=7");
    expect(calledUrl).toContain("team=Partner");
  });

  it("re-fetches when range prop changes from 7 to 14", async () => {
    const { rerender } = render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValue(mockTimeData("14"));
    rerender(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="14"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain("range=14");
  });

  it("re-fetches when range prop changes to mtd", async () => {
    const { rerender } = render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValue(mockTimeData("mtd"));
    rerender(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="mtd"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain("range=mtd");
  });

  it("does not re-fetch when range stays the same", async () => {
    const { rerender } = render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    // Re-render with same props
    rerender(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="7"
      />
    );

    // Should still be 1 — no unnecessary re-fetch
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });

  it("does not fetch when no team is selected", () => {
    render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam=""
        range="7"
      />
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("includes range in fetch URL — never omits it", async () => {
    render(
      <TimeTrackingTab
        adoHeaders={defaultHeaders}
        selectedTeam="Partner"
        range="14"
      />
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const params = new URL(calledUrl, "http://localhost").searchParams;
    expect(params.has("range")).toBe(true);
    expect(params.get("range")).toBe("14");
  });
});
