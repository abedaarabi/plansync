import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("landing loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("viewer loads", async ({ page }) => {
    await page.goto("/viewer");
    await expect(page.locator("body")).toBeVisible();
  });

  test("pricing page shows Team / Pro / Enterprise list prices", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("$99/month").first()).toBeVisible();
    await expect(page.getByText("$179/month").first()).toBeVisible();
    await expect(page.getByText("$299/month").first()).toBeVisible();
  });
});
