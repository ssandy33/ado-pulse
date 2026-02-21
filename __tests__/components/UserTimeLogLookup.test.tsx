/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UserTimeLogLookup } from "@/components/IdentityDebug";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const defaultHeaders = {
  "x-ado-org": "test-org",
  "x-ado-project": "test-project",
};

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      user: {
        id: "user-1",
        email: "test@arrivia.com",
        displayName: "Test User",
      },
      summary: {
        totalHours: 40.5,
        workItemCount: 3,
        entryCount: 18,
        dateRange: {
          earliest: "2026-01-21T00:00:00",
          latest: "2026-02-20T00:00:00",
        },
        period: {
          from: "2026-01-21T00:00:00",
          to: "2026-02-20T00:00:00",
          days: 30,
        },
      },
      workItems: [],
    }),
  });
});

afterEach(() => jest.clearAllMocks());

describe("UserTimeLogLookup component", () => {
  it("calls the API with only an email param — no days or range", async () => {
    render(<UserTimeLogLookup adoHeaders={defaultHeaders} />);

    const input = screen.getByPlaceholderText(/user@example\.com/i);
    fireEvent.change(input, { target: { value: "test@arrivia.com" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const params = new URL(calledUrl, "http://localhost").searchParams;

    expect(params.get("email")).toBe("test@arrivia.com");
    expect(params.has("days")).toBe(false);
    expect(params.has("range")).toBe(false);
    expect(params.has("period")).toBe(false);
  });

  it("displays the date range from the API response", async () => {
    render(<UserTimeLogLookup adoHeaders={defaultHeaders} />);

    const input = screen.getByPlaceholderText(/user@example\.com/i);
    fireEvent.change(input, { target: { value: "test@arrivia.com" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/Jan 21, 2026/)).toBeInTheDocument();
    });
  });

  it("shows user display name after successful search", async () => {
    render(<UserTimeLogLookup adoHeaders={defaultHeaders} />);

    const input = screen.getByPlaceholderText(/user@example\.com/i);
    fireEvent.change(input, { target: { value: "test@arrivia.com" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });

  it("disables the search button when email is empty", () => {
    render(<UserTimeLogLookup adoHeaders={defaultHeaders} />);
    const button = screen.getByRole("button", { name: /search/i });
    expect(button).toBeDisabled();
  });
});
