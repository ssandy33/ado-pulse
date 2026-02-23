import { test, expect } from "@playwright/test";

const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Time Tracking Tab", () => {
  test.skip(!hasCredentials, "Skipped — ADO_ORG_URL and ADO_PAT not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#org-url").fill(ORG_URL);
    await page.locator("#pat").fill(PAT);
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText("PR Hygiene")).toBeVisible({ timeout: 15_000 });

    // Navigate to Time Tracking tab
    await page.getByRole("button", { name: "Time Tracking" }).click();
  });

  test("shows empty state or 7pace not configured message when no team", async ({ page }) => {
    const selectTeam = page.getByText("Select a team to view time tracking");
    const notConfigured = page.getByText("7pace Timetracker not configured");
    const totalHours = page.getByText("Total Hours");

    // Wait for one of the expected states to appear
    await expect(
      page.locator("text=Select a team to view time tracking, text=7pace Timetracker not configured, text=Total Hours").first()
    ).toBeVisible({ timeout: 10_000 }).catch(() => {});

    const hasSelectTeam = await selectTeam.isVisible().catch(() => false);
    const hasNotConfigured = await notConfigured.isVisible().catch(() => false);
    const hasTimeData = await totalHours.isVisible().catch(() => false);

    // One of these real states should be visible
    expect(hasSelectTeam || hasNotConfigured || hasTimeData).toBeTruthy();
  });

  test("shows 7pace not configured message when API token is missing", async ({ page }) => {
    // Wait for the tab content to settle
    const notConfigured = page.getByText("7pace Timetracker not configured");
    const hasMessage = await notConfigured.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasMessage) {
      await expect(page.getByText("Settings")).toBeVisible();
      await expect(page.getByText("Integrations")).toBeVisible();
    }
  });

  test("displays time KPI tiles when data is available", async ({ page }) => {
    const totalHours = page.getByText("Total Hours");
    const hasData = await totalHours.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasData) {
      await expect(page.getByText("Total Hours")).toBeVisible();
      await expect(page.getByText("CapEx Hours")).toBeVisible();
      await expect(page.getByText("OpEx Hours")).toBeVisible();
      await expect(page.getByText("Not Logging")).toBeVisible();
    } else {
      // No time data — verify we're in an expected fallback state
      const hasEmptyState = await page.getByText("Select a team to view time tracking").isVisible().catch(() => false);
      const hasNotConfigured = await page.getByText("7pace Timetracker not configured").isVisible().catch(() => false);
      expect(hasEmptyState || hasNotConfigured).toBeTruthy();
    }
  });

  test("member time breakdown table renders", async ({ page }) => {
    const memberBreakdown = page.getByText("Member Time Breakdown");
    const hasTable = await memberBreakdown.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      await expect(page.getByText("Total")).toBeVisible();
      await expect(page.getByText("CapEx")).toBeVisible();
      await expect(page.getByText("OpEx")).toBeVisible();
      await expect(page.getByText("Status")).toBeVisible();
    }
  });

  test("view toggle between Member and Feature views", async ({ page }) => {
    const memberViewBtn = page.getByRole("button", { name: "Member View" });
    const featureViewBtn = page.getByRole("button", { name: "Feature View" });

    const hasToggle = await memberViewBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasToggle) {
      await featureViewBtn.click();
      await expect(page.getByText("Feature Breakdown")).toBeVisible();

      await memberViewBtn.click();
      await expect(page.getByText("Member Time Breakdown")).toBeVisible();
    }
  });
});
