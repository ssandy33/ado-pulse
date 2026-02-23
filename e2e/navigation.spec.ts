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
    // Click Organization tab
    await page.getByRole("button", { name: "Organization" }).click();
    // Organization-level content should appear (no team-specific empty state)

    // Click Settings tab
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Configure team and project preferences")).toBeVisible();
  });

  test("team selector is visible in the header", async ({ page }) => {
    // Team selector shows "Select team" or an auto-selected team name
    await expect(
      page.locator("button").filter({ hasText: /select team|team/i }).first()
    ).toBeVisible();
  });

  test("time range buttons are visible", async ({ page }) => {
    // Wait for a team to be selected (buttons appear after team selection)
    await page.waitForTimeout(2000);

    const ranges = ["7d", "14d", "MTD"];
    for (const range of ranges) {
      await expect(page.getByRole("button", { name: range })).toBeVisible();
    }
  });

  test("disconnect button is visible and returns to connection form", async ({ page }) => {
    const disconnectBtn = page.getByRole("button", { name: "Disconnect" });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Should return to connection form
    await expect(page.getByRole("heading", { name: "PR Hygiene Dashboard" })).toBeVisible();
  });

  test("refresh button is visible", async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});
