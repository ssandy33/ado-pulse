import { test, expect } from "@playwright/test";

test.describe("Authentication / Connection Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the connection form with heading and inputs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "PR Hygiene Dashboard" })).toBeVisible();
    await expect(page.locator("#org-url")).toBeVisible();
    await expect(page.locator("#pat")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("shows Organization URL and PAT labels", async ({ page }) => {
    await expect(page.getByText("Organization URL")).toBeVisible();
    await expect(page.getByText("Personal Access Token")).toBeVisible();
  });

  test("shows error message on invalid PAT", async ({ page }) => {
    await page.locator("#org-url").fill("https://dev.azure.com/testorg/testproject");
    await page.locator("#pat").fill("bad-pat-value");
    await page.getByRole("button", { name: "Connect" }).click();

    // Should show an error — either auth failed or connection failed
    await expect(
      page.getByText(/authentication failed|connection failed/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows the remember PAT checkbox", async ({ page }) => {
    await expect(page.getByText("Remember my PAT for next time")).toBeVisible();
  });

  test("remember checkbox is checked by default", async ({ page }) => {
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test("shows PAT scope requirements info", async ({ page }) => {
    await expect(page.getByText(/Code \(Read\)/)).toBeVisible();
    await expect(page.getByText(/Policy \(Read\)/)).toBeVisible();
  });

  test("connect button shows 'Connecting...' while submitting", async ({ page }) => {
    await page.locator("#org-url").fill("https://dev.azure.com/testorg/testproject");
    await page.locator("#pat").fill("some-pat-value");
    await page.getByRole("button", { name: "Connect" }).click();

    // Button should briefly show "Connecting..." state
    await expect(page.getByRole("button", { name: "Connecting..." })).toBeVisible();
  });

  test("shows validation error for malformed org URL", async ({ page }) => {
    await page.locator("#org-url").fill("not-a-valid-url");
    await page.locator("#pat").fill("some-pat");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText(/Enter your org and project/)).toBeVisible();
  });
});
