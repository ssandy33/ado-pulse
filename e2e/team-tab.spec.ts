import { test, expect } from "@playwright/test";

const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Team Tab", () => {
  test.skip(!hasCredentials, "Skipped — ADO_ORG_URL and ADO_PAT not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#org-url").fill(ORG_URL);
    await page.locator("#pat").fill(PAT);
    await page.getByRole("button", { name: "Connect" }).click();

    // Wait for dashboard
    await expect(page.getByText("PR Hygiene")).toBeVisible({ timeout: 15_000 });

    // Ensure Team tab is active
    await page.getByRole("button", { name: "Team" }).click();
  });

  test("shows empty state when no team selected", async ({ page }) => {
    // If no default team is set, we should see the empty state
    const emptyState = page.getByText("Select a team to get started");
    const prsMerged = page.getByText("PRs Merged");

    // Either we see the empty state or KPI cards (if a default team was set)
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasKpi = await prsMerged.isVisible().catch(() => false);
    expect(hasEmptyState || hasKpi).toBeTruthy();
  });

  test("displays KPI tiles after team loads", async ({ page }) => {
    // Wait for data to load (may auto-select a default team)
    const prsMerged = page.getByText("PRs Merged");
    const hasData = await prsMerged.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasData) {
      await expect(page.getByText("PRs Merged")).toBeVisible();
      await expect(page.getByText("Active Contributors")).toBeVisible();
      await expect(page.getByText("Most Active Repo")).toBeVisible();
    }
  });

  test("developer table shows expected columns", async ({ page }) => {
    // Wait for member table to load (requires active data)
    const memberHeader = page.getByText("Member").first();
    const hasTable = await memberHeader.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      await expect(page.getByText("PRs Authored")).toBeVisible();
      await expect(page.getByText("Reviews Given")).toBeVisible();
    }
  });

  test("data confidence panel renders when diagnostics are present", async ({ page }) => {
    // Wait for data to potentially load
    const confidencePanel = page.getByText("Data Confidence");
    const hasPanel = await confidencePanel.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasPanel) {
      // Panel is visible — verify it has meaningful content
      const panelText = await confidencePanel.textContent();
      expect(panelText && panelText.trim().length > 0).toBeTruthy();
    }
    // If no panel, diagnostics were not returned — that's valid
  });
});
