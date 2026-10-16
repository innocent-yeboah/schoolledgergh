import { expect, test } from "@playwright/test";

test("opening the app shows login and not the demo school", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole("heading", { name: "SchoolLedger GH" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(2);
  await expect(page.getByText("Bright Future Academy")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try the school demo" })).toHaveCount(0);

  await page.context().addCookies([{ name: "slgh_mode", value: "school", url: "http://127.0.0.1:3000" }]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText("Bright Future Academy")).toHaveCount(0);
});

test("responses send security headers", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBe(true);
  const csp = response.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("sk_live_");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
