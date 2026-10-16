import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideRedirect } from "@/lib/auth/redirect";
import {
  friendlyAuth,
  hasAuthSession,
  LINK_EXPIRED_MESSAGE,
  loginErrorFromQuery,
  PASSWORD_UPDATED_MESSAGE,
  passwordResetRedirect,
  passwordUpdatedFromSearch,
  RESET_EMAIL_SENT,
  resetPasswordFieldErrors,
  sendPasswordReset,
  updatePassword,
} from "@/lib/auth/password-reset";

const { resetPasswordForEmail, updateUser, getUser, createAuthClient } = vi.hoisted(() => {
  const resetPasswordForEmail = vi.fn();
  const updateUser = vi.fn();
  const getUser = vi.fn();
  const createAuthClient = vi.fn(() => ({
    auth: { resetPasswordForEmail, updateUser, getUser },
  }));
  return { resetPasswordForEmail, updateUser, getUser, createAuthClient };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => createAuthClient(),
}));

describe("password reset", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    updateUser.mockReset();
    getUser.mockReset();
    createAuthClient.mockReset();
    createAuthClient.mockImplementation(() => ({
      auth: { resetPasswordForEmail, updateUser, getUser },
    }));
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("sends a reset email through the callback and on to the reset page", async () => {
    await sendPasswordReset("bursar@school.edu.gh", "https://schoolledger.test");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("bursar@school.edu.gh", {
      redirectTo: "https://schoolledger.test/auth/callback?next=/reset-password",
    });
    expect(passwordResetRedirect("https://schoolledger.test/")).toBe(
      "https://schoolledger.test/auth/callback?next=/reset-password",
    );
  });

  it("turns a rate limit into a plain message", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: "Email rate limit exceeded" } });
    await expect(sendPasswordReset("bursar@school.edu.gh", "https://schoolledger.test")).rejects.toThrow(
      "Too many attempts. Wait a few minutes and try again.",
    );
  });

  it("keeps sign-in errors in plain English", () => {
    expect(friendlyAuth("Invalid login credentials")).toBe("Incorrect email or password.");
    expect(friendlyAuth("Email not confirmed")).toBe("Confirm your email before signing in.");
    expect(friendlyAuth("Something else went wrong")).toBe("Something else went wrong");
  });

  it("uses an enumeration-safe notice after the reset email is sent", () => {
    expect(RESET_EMAIL_SENT).toBe(
      "If an account exists for this email, we've sent a reset link. Check your inbox and spam.",
    );
    const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
    expect(login).toContain("RESET_EMAIL_SENT");
    expect(login).not.toContain("Check your email for a reset link.");
  });

  it("maps an expired link to the login message", () => {
    expect(loginErrorFromQuery("link_expired")).toBe(LINK_EXPIRED_MESSAGE);
    expect(loginErrorFromQuery("something_else")).toBeNull();
    expect(loginErrorFromQuery(null)).toBeNull();
  });

  it("asks for a new password of at least 8 characters that matches", () => {
    expect(resetPasswordFieldErrors("", "")).toEqual({
      password: "Enter a new password.",
      confirm: "Confirm your new password.",
    });
    expect(resetPasswordFieldErrors("short", "short").password).toBe("Password must be at least 8 characters.");
    expect(resetPasswordFieldErrors("long-enough", "different").confirm).toBe("Passwords do not match.");
    expect(resetPasswordFieldErrors("long-enough", "long-enough")).toEqual({});
  });

  it("saves the new password with updateUser", async () => {
    await updatePassword("long-enough");
    expect(updateUser).toHaveBeenCalledWith({ password: "long-enough" });
  });

  it("turns a rejected password update into a plain message", async () => {
    updateUser.mockResolvedValue({ data: null, error: { message: "Email rate limit exceeded" } });
    await expect(updatePassword("long-enough")).rejects.toThrow("Too many attempts. Wait a few minutes and try again.");
  });

  it("knows when the recovery session is missing", async () => {
    await expect(hasAuthSession()).resolves.toBe(true);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(hasAuthSession()).resolves.toBe(false);
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await expect(hasAuthSession()).resolves.toBe(false);
    createAuthClient.mockImplementation(() => {
      throw new Error("Supabase is not configured.");
    });
    await expect(hasAuthSession()).resolves.toBe(false);
  });

  it("carries a password-updated notice onto the school app", () => {
    expect(passwordUpdatedFromSearch("")).toEqual({ message: null, nextSearch: "" });
    expect(passwordUpdatedFromSearch("?notice=password-updated")).toEqual({
      message: PASSWORD_UPDATED_MESSAGE,
      nextSearch: "",
    });
    expect(passwordUpdatedFromSearch("?notice=password-updated&student=1")).toEqual({
      message: PASSWORD_UPDATED_MESSAGE,
      nextSearch: "?student=1",
    });
    expect(PASSWORD_UPDATED_MESSAGE).toBe("Your password has been updated.");
  });

  it("leaves the callback and reset page reachable while signed out", () => {
    expect(decideRedirect({ pathname: "/auth/callback", demo: "", signedIn: false, supabaseConfigured: true })).toBeNull();
    expect(decideRedirect({ pathname: "/reset-password", demo: "", signedIn: false, supabaseConfigured: true })).toBeNull();
    expect(decideRedirect({ pathname: "/reset-password", demo: "", signedIn: true, supabaseConfigured: true })).toBeNull();
  });
});
