import { expect, test } from "@playwright/test";

test("opening the app shows login and not the demo school", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole("heading", { name: "School fees, collected and tracked, without the stress." })).toBeVisible();
  await expect(page.getByText("SchoolLedger GH").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByText("Bright Future Academy")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try the school demo" })).toHaveCount(0);

  await page.context().addCookies([{ name: "slgh_mode", value: "school", url: "http://127.0.0.1:3000" }]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText("Bright Future Academy")).toHaveCount(0);
});

test("login page supports sign-in, registration, and password reset", async ({ page }) => {
  const visibleText = (text: string) => page.getByText(text, { exact: true }).locator("visible=true");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "School fees, collected and tracked, without the stress." })).toBeVisible();
  await expect(page.getByText("Built in Accra for Ghanaian schools")).toBeVisible();
  await expect(page.getByText("Bank-grade encryption · Your school's data stays private")).toBeVisible();
  await expect(visibleText("MTN MoMo, Telecel Cash, and AirtelTigo Money")).toBeVisible();
  await expect(page.locator("#sl-kente")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Try the school demo" })).toHaveCount(0);

  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "current-password");

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");

  await email.fill("bursar@school.edu.gh");
  await password.fill("ledger-secret");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("ledger-secret");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("bursar@school.edu.gh");
  await page.getByLabel("Email", { exact: true }).fill("");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "Sign in" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Register school" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Register school" })).toBeFocused();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await page.getByRole("button", { name: "Create school account" }).click();
  await expect(page.getByText("Enter the school name.")).toBeVisible();
  await expect(page.getByLabel("School name")).toBeFocused();
  await expect(page.getByLabel("School name")).toHaveAttribute("aria-invalid", "true");

  const support = page.getByRole("link", { name: /WhatsApp support/ });
  await expect(support).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+$/);
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "#");
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "#");
  await expect(page.getByText(/© \d{4} SchoolLedger GH/)).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(visibleText("Automatic SMS reminders to parents")).toBeVisible();
  await expect(visibleText("Real-time balances in GH₵")).toBeVisible();
  await expect(visibleText("Receipts for every payment")).toBeVisible();
  await expect(visibleText("Mobile Money and Paystack payments")).toBeVisible();
  await expect(visibleText("MTN MoMo, Telecel Cash, and AirtelTigo Money")).toBeVisible();
});

test("login entrance respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const animation = await page.locator(".sl-enter").first().evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
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
