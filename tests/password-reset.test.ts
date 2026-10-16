import { beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyAuth, sendPasswordReset } from "@/lib/auth/password-reset";

const { resetPasswordForEmail } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

describe("password reset", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("sends a reset email back through the auth callback", async () => {
    await sendPasswordReset("bursar@school.edu.gh", "https://schoolledger.test");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("bursar@school.edu.gh", {
      redirectTo: "https://schoolledger.test/auth/callback",
    });
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
});
