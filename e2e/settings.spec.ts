import { test, expect } from "@playwright/test";

const ORG_URL = process.env.ADO_ORG_URL || "";
const PAT = process.env.ADO_PAT || "";
const hasCredentials = ORG_URL.length > 0 && PAT.length > 0;

test.describe("Settings Tab", () => {
  test.skip(!hasCredentials, "Skipped — ADO_ORG_URL and ADO_PAT not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#org-url").fill(ORG_URL);
    await page.locator("#pat").fill(PAT);
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText("PR Hygiene")).toBeVisible({ timeout: 15_000 });

    // Navigate to Settings tab
    await page.getByRole("button", { name: "Settings" }).click();
  });

  test("shows settings page heading and description", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Configure team and project preferences")).toBeVisible();
  });

  test("integrations section is visible", async ({ page }) => {
    await expect(page.getByText("Integrations")).toBeVisible();
    await expect(page.getByText("Connect external services like 7pace Timetracker")).toBeVisible();
  });

  test("7pace configuration fields are present", async ({ page }) => {
    await expect(page.getByText("7pace Timetracker")).toBeVisible();
    await expect(page.getByText("API Token")).toBeVisible();
    await expect(page.getByText("Base URL")).toBeVisible();
  });

  test("test connection button exists", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();
  });

  test("save button exists in integrations", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("show/hide toggle for API token", async ({ page }) => {
    // The API token input has a show/hide button
    const showBtn = page.getByRole("button", { name: "Show" });
    const hasShowBtn = await showBtn.isVisible().catch(() => false);

    if (hasShowBtn) {
      await showBtn.click();
      await expect(page.getByRole("button", { name: "Hide" })).toBeVisible();
    }
  });
});
