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
});
