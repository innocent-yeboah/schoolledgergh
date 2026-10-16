import { expect, test } from "@playwright/test";

test("an expired reset link explains itself on the login page", async ({ page }) => {
  await page.goto("/login?error=link_expired");
  await expect(page.locator("#form-error")).toHaveText("That reset link has expired. Request a new one.");
});

function expectOnThisSite(location: string, pathname: string) {
  const url = new URL(location);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.port).toBe("3000");
  expect(url.pathname).toBe(pathname);
  expect(url.hostname).not.toContain("evil.example");
}

test("auth callback follows a safe next path to reset password", async ({ request }) => {
  const response = await request.get("/auth/callback?next=/reset-password", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expectOnThisSite(response.headers().location ?? "", "/reset-password");
});

test("auth callback stays on this site when next is not a safe relative path", async ({ request }) => {
  for (const next of ["//evil.example", "/\\evil.example", "https://evil.example"]) {
    const response = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = response.headers().location ?? "";
    expectOnThisSite(location, "/app");
    expect(location).not.toContain("evil.example");
  }
});

test("reset password without a session returns to login", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login\/?$/);
});

test("reset password page is rendered in the login green and gold", async ({ request }) => {
  const response = await request.get("/reset-password");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("New password");
  expect(html).toContain("Confirm password");
  expect(html).toContain("Set a new password");
  expect(html).toContain("#07421F");
  expect(html).toContain("#C9A227");
  expect(html).toContain("At least 8 characters.");
});
