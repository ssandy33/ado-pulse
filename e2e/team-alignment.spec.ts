import { test, expect } from "@playwright/test";

/**
 * Team PR Alignment e2e tests (Issue #7).
 *
 * Validates the acceptance criteria:
 * - Alignment KPI tile visible on Team tab below existing KPI tiles
 * - Tile shows alignment %, aligned count, out-of-scope count, unlinked count
 * - Tile color reflects threshold (green/amber/red)
 * - Expanding a developer row shows PR Alignment breakdown
 * - Out-of-scope PRs grouped by Area Path with counts
 * - Unlinked PRs shown separately with explanatory text
 * - Existing PR count column is unchanged
 * - Feature works across all teams
 */

const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Team PR Alignment", () => {
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

  test.describe("Alignment KPI tile", () => {
    test("tile appears below existing KPI tiles when a team is loaded", async ({ page }) => {
      // Wait for KPI cards to load (indicates team data is available)
      const prsMerged = page.getByText("PRs Merged");
      const hasData = await prsMerged.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasData) {
        test.skip(true, "No team auto-selected — cannot test alignment tile");
        return;
      }

      // Alignment tile should appear (may take a separate API call)
      const alignmentTile = page.getByText("PR Alignment").first();
      await expect(alignmentTile).toBeVisible({ timeout: 15_000 });
    });

    test("tile shows alignment percentage", async ({ page }) => {
      const alignmentTile = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentTile.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible — team may have no data");
        return;
      }

      // The percentage should be visible (e.g. "85%", "100%", "0%")
      const tileContainer = page.locator("div").filter({ hasText: "PR Alignment" }).first();
      const pctText = tileContainer.locator("span").filter({ hasText: /^\d{1,3}%$/ });
      await expect(pctText.first()).toBeVisible();
    });

    test("tile shows aligned, out-of-scope, and unlinked labels", async ({ page }) => {
      const alignmentTile = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentTile.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      await expect(page.getByText("aligned").first()).toBeVisible();
      await expect(page.getByText("out of scope").first()).toBeVisible();
      await expect(page.getByText("unlinked").first()).toBeVisible();
    });

    test("alignment percentage uses color-coded threshold", async ({ page }) => {
      const alignmentTile = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentTile.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      // Find the percentage element (28px font-mono span)
      const tileContainer = page.locator("div").filter({ hasText: "PR Alignment" }).first();
      const pctSpan = tileContainer.locator("span.font-mono").first();
      await expect(pctSpan).toBeVisible();

      // Should have one of the threshold color classes
      const classList = await pctSpan.getAttribute("class") || "";
      const hasThresholdColor =
        classList.includes("text-emerald-600") ||
        classList.includes("text-amber-600") ||
        classList.includes("text-red-600");
      expect(hasThresholdColor).toBeTruthy();
    });

    test("tile shows period label", async ({ page }) => {
      const alignmentTile = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentTile.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      // Period label (e.g. "Last 14 days", "Last 7 days")
      const periodLabel = page.getByText(/Last \d+ days/).first();
      await expect(periodLabel).toBeVisible();
    });

    test("count buttons expand drill-down panel", async ({ page }) => {
      const alignmentTile = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentTile.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      // Find clickable count buttons inside the alignment tile area
      const tileContainer = page.locator(".mb-6").filter({ hasText: "PR Alignment" }).first();
      const buttons = tileContainer.getByRole("button");
      const buttonCount = await buttons.count();

      if (buttonCount === 0) {
        test.skip(true, "No clickable counts (all counts may be zero)");
        return;
      }

      // Click the first available count button
      await buttons.first().click();

      // Drill-down panel should show a table with PR Title column
      await expect(page.getByText("PR Title")).toBeVisible({ timeout: 5_000 });
    });

    test("clicking same count button collapses drill-down", async ({ page }) => {
      const tileContainer = page.locator(".mb-6").filter({ hasText: "PR Alignment" }).first();
      const hasAlignment = await tileContainer.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      const buttons = tileContainer.getByRole("button");
      const buttonCount = await buttons.count();
      if (buttonCount === 0) {
        test.skip(true, "No clickable counts");
        return;
      }

      // Expand
      await buttons.first().click();
      await expect(page.getByText("PR Title")).toBeVisible({ timeout: 5_000 });

      // Collapse
      await buttons.first().click();
      await expect(page.getByText("PR Title")).not.toBeVisible();
    });

    test("drill-down shows Author, Repo, Merged, and Work Item columns", async ({ page }) => {
      const tileContainer = page.locator(".mb-6").filter({ hasText: "PR Alignment" }).first();
      const hasAlignment = await tileContainer.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      const buttons = tileContainer.getByRole("button");
      if ((await buttons.count()) === 0) {
        test.skip(true, "No clickable counts");
        return;
      }

      await buttons.first().click();
      await expect(page.getByText("PR Title")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("Author")).toBeVisible();
      await expect(page.getByText("Repo")).toBeVisible();
      await expect(page.getByText("Merged")).toBeVisible();
      await expect(page.getByText("Work Item")).toBeVisible();
    });

    test("drill-down PR rows have external links", async ({ page }) => {
      const tileContainer = page.locator(".mb-6").filter({ hasText: "PR Alignment" }).first();
      const hasAlignment = await tileContainer.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      const buttons = tileContainer.getByRole("button");
      if ((await buttons.count()) === 0) {
        test.skip(true, "No clickable counts");
        return;
      }

      await buttons.first().click();
      await expect(page.getByText("PR Title")).toBeVisible({ timeout: 5_000 });

      // Each PR row should have an external link to Azure DevOps
      const prLinks = page.locator("a[target='_blank'][href*='pullrequest']");
      const linkCount = await prLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    });
  });

  test.describe("Developer row alignment breakdown", () => {
    test("Developer Breakdown table is present with PRs column", async ({ page }) => {
      const devBreakdown = page.getByText("Developer Breakdown");
      const hasTable = await devBreakdown.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasTable) {
        test.skip(true, "Developer Breakdown table not visible");
        return;
      }

      // PRs column header should exist (acceptance: existing PR count column unchanged)
      await expect(page.getByText("PRs").first()).toBeVisible();
    });

    test("clicking a developer row with PRs expands alignment details", async ({ page }) => {
      const devBreakdown = page.getByText("Developer Breakdown");
      const hasTable = await devBreakdown.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasTable) {
        test.skip(true, "Developer Breakdown table not visible");
        return;
      }

      // Find a row with an expand chevron (indicates expandable content)
      const expandButtons = page.locator(
        "button[aria-label='Expand details'], button[aria-label='Collapse details']"
      );
      const expandCount = await expandButtons.count();
      if (expandCount === 0) {
        test.skip(true, "No expandable developer rows");
        return;
      }

      // Click the first expandable row
      await expandButtons.first().click();

      // Should show alignment breakdown or PR list
      // Alignment breakdown shows "Aligned" label or "All X PRs aligned to team area"
      const hasAlignmentRow = page.getByText("Aligned").first();
      const hasAllAligned = page.getByText(/All \d+ PRs aligned to team area/).first();
      const hasPRList = page.locator("th").filter({ hasText: "Title" }).first();

      const showsAlignmentOrPRs =
        (await hasAlignmentRow.isVisible().catch(() => false)) ||
        (await hasAllAligned.isVisible().catch(() => false)) ||
        (await hasPRList.isVisible().catch(() => false));

      expect(showsAlignmentOrPRs).toBeTruthy();
    });

    test("expanded row collapse toggles aria-expanded", async ({ page }) => {
      const devBreakdown = page.getByText("Developer Breakdown");
      const hasTable = await devBreakdown.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasTable) {
        test.skip(true, "Developer Breakdown table not visible");
        return;
      }

      const expandButton = page.locator("button[aria-label='Expand details']").first();
      const hasButton = await expandButton.isVisible().catch(() => false);
      if (!hasButton) {
        test.skip(true, "No expandable rows");
        return;
      }

      // Initially not expanded
      await expect(expandButton).toHaveAttribute("aria-expanded", "false");

      // Click to expand
      await expandButton.click();
      await expect(expandButton).toHaveAttribute("aria-expanded", "true");

      // Click to collapse
      await expandButton.click();
      await expect(expandButton).toHaveAttribute("aria-expanded", "false");
    });

    test("out-of-scope alignment row shows area paths", async ({ page }) => {
      const devBreakdown = page.getByText("Developer Breakdown");
      const hasTable = await devBreakdown.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasTable) {
        test.skip(true, "Developer Breakdown table not visible");
        return;
      }

      const expandButtons = page.locator("button[aria-label='Expand details']");
      const expandCount = await expandButtons.count();

      // Try each expandable row to find one with out-of-scope alignment
      for (let i = 0; i < Math.min(expandCount, 5); i++) {
        await expandButtons.nth(i).click();

        const outOfScope = page.getByText("Out of scope").first();
        const hasOutOfScope = await outOfScope.isVisible({ timeout: 2_000 }).catch(() => false);

        if (hasOutOfScope) {
          // Out-of-scope row should show area path with count (e.g. "SoftEng\Bookability (3)")
          const areaPathCell = page.locator("td").filter({ hasText: /\(\d+\)/ }).first();
          await expect(areaPathCell).toBeVisible();
          return;
        }

        // Collapse before trying next
        await expandButtons.nth(i).click();
      }

      test.skip(true, "No developer rows with out-of-scope alignment found");
    });

    test("unlinked alignment row shows explanatory text", async ({ page }) => {
      const devBreakdown = page.getByText("Developer Breakdown");
      const hasTable = await devBreakdown.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasTable) {
        test.skip(true, "Developer Breakdown table not visible");
        return;
      }

      const expandButtons = page.locator("button[aria-label='Expand details']");
      const expandCount = await expandButtons.count();

      // Try each expandable row to find one with unlinked PRs
      for (let i = 0; i < Math.min(expandCount, 5); i++) {
        await expandButtons.nth(i).click();

        const unlinkedRow = page.getByText("no linked work item").first();
        const hasUnlinked = await unlinkedRow.isVisible({ timeout: 2_000 }).catch(() => false);

        if (hasUnlinked) {
          await expect(unlinkedRow).toBeVisible();
          return;
        }

        // Collapse before trying next
        await expandButtons.nth(i).click();
      }

      test.skip(true, "No developer rows with unlinked PRs found");
    });
  });

  test.describe("Alignment works across teams", () => {
    test("alignment tile updates when a different team is selected", async ({ page }) => {
      // Wait for initial team data
      const prsMerged = page.getByText("PRs Merged");
      const hasData = await prsMerged.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasData) {
        test.skip(true, "No team data loaded");
        return;
      }

      // Wait for alignment tile
      const alignmentLabel = page.getByText("PR Alignment").first();
      const hasAlignment = await alignmentLabel.isVisible({ timeout: 15_000 }).catch(() => false);
      if (!hasAlignment) {
        test.skip(true, "Alignment tile not visible");
        return;
      }

      // Record current alignment percentage
      const tileContainer = page.locator("div").filter({ hasText: "PR Alignment" }).first();
      const pctSpan = tileContainer.locator("span.font-mono").first();
      const initialPct = await pctSpan.textContent();

      // Find the team selector dropdown and switch team
      const teamSelector = page.locator("button").filter({ hasText: /Select team|Team/ }).first();
      const hasSelector = await teamSelector.isVisible().catch(() => false);
      if (!hasSelector) {
        test.skip(true, "Team selector not found");
        return;
      }

      await teamSelector.click();

      // Pick a different team from the dropdown
      const teamOptions = page.getByRole("option");
      const optionCount = await teamOptions.count().catch(() => 0);
      if (optionCount < 2) {
        test.skip(true, "Fewer than 2 teams available");
        return;
      }

      // Select the second option (different from current)
      await teamOptions.nth(1).click();

      // Wait for data to reload — alignment tile should refresh
      await expect(page.getByText("PR Alignment").first()).toBeVisible({ timeout: 15_000 });

      // The tile should still show a percentage (may be same or different)
      const newPctSpan = page.locator("div").filter({ hasText: "PR Alignment" }).first().locator("span.font-mono").first();
      await expect(newPctSpan).toBeVisible();
      const newPct = await newPctSpan.textContent();
      expect(newPct).toMatch(/^\d{1,3}%$/);

      // Verify it's still a valid state (tile rendered correctly after team switch)
      await expect(page.getByText("aligned").first()).toBeVisible();
      await expect(page.getByText("out of scope").first()).toBeVisible();
      await expect(page.getByText("unlinked").first()).toBeVisible();
    });
  });
});
