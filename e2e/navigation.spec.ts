import { test, expect } from "@playwright/test";

/**
 * Navigation tests require a live ADO connection.
 * Set ADO_ORG_URL and ADO_PAT env vars to run authenticated tests.
 * Unauthenticated tests are skipped when credentials are not available.
 */
const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Dashboard Navigation", () => {
  test.skip(!hasCredentials, "Skipped — ADO_ORG_URL and ADO_PAT not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#org-url").fill(ORG_URL);
    await page.locator("#pat").fill(PAT);
    await page.getByRole("button", { name: "Connect" }).click();

    // Wait for dashboard to load
    await expect(page.getByText("PR Hygiene")).toBeVisible({ timeout: 15_000 });
  });

  test("tab bar shows all navigation tabs", async ({ page }) => {
    const tabs = ["Team", "Organization", "Time Tracking", "Debug", "Settings"];
    for (const tab of tabs) {
      await expect(page.getByRole("button", { name: tab })).toBeVisible();
    }
  });

  test("clicking tabs switches content", async ({ page }) => {
    // Click Organization tab and verify org-level content appears
    await page.getByRole("button", { name: "Organization" }).click();
    await expect(page.getByText("Unmatched Authors")).toBeVisible({ timeout: 15_000 });

    // Click Settings tab
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Configure team and project preferences")).toBeVisible();
  });

  test("team selector is visible in the header", async ({ page }) => {
    // The team selector sits in the org / project / team breadcrumb.
    // It shows "Select team" when no default or the team name when auto-selected.
    // Parse org name from the URL to locate the breadcrumb row.
    const orgName = ORG_URL.match(/dev\.azure\.com\/([^/]+)/)?.[1] || "";
    const breadcrumb = page.locator("div").filter({ hasText: orgName }).filter({ has: page.locator("button") });
    await expect(breadcrumb.locator("button").first()).toBeVisible();
  });

  test("time range buttons are visible", async ({ page }) => {
    // Wait for the first time range button to appear (team auto-selects)
    await expect(page.getByRole("button", { name: "7d" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "14d" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MTD" })).toBeVisible();
  });

  test("disconnect button is visible and returns to connection form", async ({ page }) => {
    const disconnectBtn = page.getByRole("button", { name: "Disconnect" });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Should return to connection form
    await expect(page.getByRole("heading", { name: "PR Hygiene Dashboard" })).toBeVisible();
  });

  test("refresh button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible({ timeout: 10_000 });
  });
});
