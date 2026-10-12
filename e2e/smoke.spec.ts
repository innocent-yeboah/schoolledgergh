import { expect, test } from "@playwright/test";

test("login, add a student, and record a payment in the school demo", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "SchoolLedger GH" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(2);
  await expect(page.getByText("Demo mode works without them.")).toBeVisible();

  await page.getByRole("button", { name: "Try the school demo" }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByRole("banner").getByText("Bright Future Academy")).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Students" }).click();
  await expect(page).toHaveURL(/\/app\/students/);
  await page.getByRole("button", { name: "Add student" }).click();
  const dialog = page.getByRole("dialog", { name: "Add student" });
  await dialog.getByLabel("First name").fill("Ama");
  await dialog.getByLabel("Last name").fill("Serwaa");
  await dialog.getByLabel("Parent or guardian").fill("Akua Serwaa");
  await dialog.getByLabel("Parent phone").fill("0244000000");
  await dialog.getByRole("button", { name: "Add student" }).click();

  const card = page.locator("article").filter({ hasText: "Ama Serwaa" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Record payment" }).click();
  await expect(page).toHaveURL(/\/app\/fees\?student=/);
  await page.getByLabel("Amount (GH₵)").fill("50");
  await page.getByRole("button", { name: "Record payment" }).click();

  const receipt = page.getByRole("dialog", { name: "Payment recorded" });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByText("Balance now")).toContainText("200.00");
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
