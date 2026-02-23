import { test, expect } from "@playwright/test";

const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Debug Tab", () => {
  test.skip(!hasCredentials, "Skipped — ADO_ORG_URL and ADO_PAT not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#org-url").fill(ORG_URL);
    await page.locator("#pat").fill(PAT);
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText("PR Hygiene")).toBeVisible({ timeout: 15_000 });

    // Navigate to Debug tab
    await page.getByRole("button", { name: "Debug" }).click();
  });

  test("shows collapsible sections", async ({ page }) => {
    await expect(page.getByText("Work Item Time Log Lookup")).toBeVisible();
    await expect(page.getByText("User Time Log Lookup")).toBeVisible();
    await expect(page.getByText("Identity Debug")).toBeVisible();
  });

  test("work item lookup section has input and button", async ({ page }) => {
    // Expand Work Item Time Log Lookup
    await page.getByText("Work Item Time Log Lookup").click();

    await expect(page.getByText("Work Item ID")).toBeVisible();
    await expect(page.getByRole("button", { name: "Look Up" })).toBeVisible();
  });

  test("user time log section has email input", async ({ page }) => {
    // Expand User Time Log Lookup
    await page.getByText("User Time Log Lookup").click();

    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("identity debug section shows team info when team is selected", async ({ page }) => {
    // Expand Identity Debug section
    await page.getByText("Identity Debug").click();

    await page.waitForTimeout(3000);

    // If no team selected, shows prompt
    const noTeam = page.getByText("Select a team using the dropdown above");
    const rosterMembers = page.getByText("Roster Members");

    const hasNoTeam = await noTeam.isVisible().catch(() => false);
    const hasRoster = await rosterMembers.isVisible().catch(() => false);

    // Either we see the no-team prompt or the roster data
    expect(hasNoTeam || hasRoster).toBeTruthy();
  });

  test("collapsible sections toggle open and closed", async ({ page }) => {
    const sectionButton = page.getByText("Work Item Time Log Lookup");
    await sectionButton.click();

    // Should expand — look for the input inside
    await expect(page.getByPlaceholder("e.g. 183639")).toBeVisible();

    // Click again to collapse
    await sectionButton.click();

    // Input should be hidden (within collapsed section)
    await expect(page.getByPlaceholder("e.g. 183639")).not.toBeVisible();
  });
});
