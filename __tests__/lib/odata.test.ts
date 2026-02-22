import { analyticsUrl } from "@/lib/ado/odata";
import type { AdoConfig } from "@/lib/ado/types";

// Mock adoFetch to avoid real HTTP calls
jest.mock("@/lib/ado/client", () => ({
  adoFetch: jest.fn().mockResolvedValue({ value: [] }),
}));

const config: AdoConfig = {
  org: "test-org",
  project: "test-project",
  pat: "test-pat",
};

describe("analyticsUrl", () => {
  it("generates correct OData URL", () => {
    const url = analyticsUrl(config, "PullRequests?$top=10");
    expect(url).toBe(
      "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0/PullRequests?$top=10"
    );
  });

  it("encodes special characters in org/project", () => {
    const cfg: AdoConfig = { org: "my org", project: "my project", pat: "p" };
    const url = analyticsUrl(cfg, "WorkItems");
    expect(url).toBe(
      "https://analytics.dev.azure.com/my%20org/my%20project/_odata/v4.0/WorkItems"
    );
  });
});

describe("odataFetch", () => {
  it("delegates to adoFetch with analytics URL", async () => {
    const { adoFetch } = require("@/lib/ado/client");
    const { odataFetch } = require("@/lib/ado/odata");

    adoFetch.mockResolvedValueOnce({ value: [{ id: 1 }] });

    const result = await odataFetch(config, "PullRequests");
    expect(adoFetch).toHaveBeenCalledWith(
      config,
      "https://analytics.dev.azure.com/test-org/test-project/_odata/v4.0/PullRequests"
      // test-org and test-project have no special chars, so encoding is a no-op
    );
    expect(result).toEqual({ value: [{ id: 1 }] });
  });
});
