import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, safeNextPath } from "@/app/auth/callback/route";

const { exchangeCodeForSession, verifyOtp, createClient } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

function locationOf(response: Response): string {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return location!;
}

describe("auth callback next path", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    createClient.mockReset();
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    createClient.mockResolvedValue({
      auth: { exchangeCodeForSession, verifyOtp },
    });
  });

  it("accepts a same-site relative path and rejects open redirects", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/app/settings")).toBe("/app/settings");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath("/\\evil.example")).toBe("/app");
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("reset-password")).toBe("/app");
    expect(safeNextPath("")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });

  it("sends a recovered session to the reset page", async () => {
    const response = await GET(new Request("https://schoolledger.test/auth/callback?code=abc&next=/reset-password"));
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("https://schoolledger.test/reset-password");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("keeps a visitor on this site when next is protocol-relative or off-site", async () => {
    const urls = [
      "https://schoolledger.test/auth/callback?code=abc&next=//evil.example",
      "https://schoolledger.test/auth/callback?code=abc&next=%2F%2Fevil.example",
      `https://schoolledger.test/auth/callback?code=abc&next=${encodeURIComponent("/\\evil.example")}`,
      `https://schoolledger.test/auth/callback?code=abc&next=${encodeURIComponent("https://evil.example")}`,
    ];
    for (const url of urls) {
      exchangeCodeForSession.mockClear();
      const response = await GET(new Request(url));
      const location = new URL(locationOf(response));
      expect(location.origin).toBe("https://schoolledger.test");
      expect(location.hostname).not.toBe("evil.example");
      expect(location.pathname).toBe("/app");
    }
  });

  it("sends a failed code exchange to login with an expired-link error", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: null, error: { message: "code expired" } });
    const response = await GET(new Request("https://schoolledger.test/auth/callback?code=used&next=/reset-password"));
    expect(locationOf(response)).toBe("https://schoolledger.test/login?error=link_expired");
  });

  it("sends a thrown code exchange to login with an expired-link error", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("network down"));
    const response = await GET(new Request("https://schoolledger.test/auth/callback?code=used&next=/reset-password"));
    expect(locationOf(response)).toBe("https://schoolledger.test/login?error=link_expired");
  });

  it("honors next when the link has no code", async () => {
    const response = await GET(new Request("https://schoolledger.test/auth/callback?next=/reset-password"));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("https://schoolledger.test/reset-password");
  });

  it("verifies a token_hash and follows the safe next path", async () => {
    const response = await GET(
      new Request("https://schoolledger.test/auth/callback?token_hash=hashed-token&type=recovery&next=/reset-password"),
    );
    expect(response.status).toBe(307);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-token", type: "recovery" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("https://schoolledger.test/reset-password");
  });

  it("keeps a token_hash visitor on this site when next is off-site", async () => {
    const response = await GET(
      new Request("https://schoolledger.test/auth/callback?token_hash=hashed-token&type=recovery&next=//evil.example"),
    );
    const location = new URL(locationOf(response));
    expect(location.origin).toBe("https://schoolledger.test");
    expect(location.pathname).toBe("/app");
  });

  it("sends a failed token_hash verification to login", async () => {
    verifyOtp.mockResolvedValue({ data: null, error: { message: "otp expired" } });
    const response = await GET(
      new Request("https://schoolledger.test/auth/callback?token_hash=used&type=recovery&next=/reset-password"),
    );
    expect(locationOf(response)).toBe("https://schoolledger.test/login?error=link_expired");
  });

  it("sends a thrown token_hash verification to login", async () => {
    verifyOtp.mockRejectedValue(new Error("network down"));
    const response = await GET(
      new Request("https://schoolledger.test/auth/callback?token_hash=used&type=recovery&next=/reset-password"),
    );
    expect(locationOf(response)).toBe("https://schoolledger.test/login?error=link_expired");
  });

  it("sends a token_hash with no type to login", async () => {
    const response = await GET(new Request("https://schoolledger.test/auth/callback?token_hash=hashed-token&next=/reset-password"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("https://schoolledger.test/login?error=link_expired");
  });

  it("prefers the code exchange when both a code and a token_hash are present", async () => {
    const response = await GET(
      new Request("https://schoolledger.test/auth/callback?code=abc&token_hash=hashed-token&type=recovery&next=/reset-password"),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("https://schoolledger.test/reset-password");
  });

  it("sends error and error_description query params to login", async () => {
    const withError = await GET(
      new Request("https://schoolledger.test/auth/callback?error=access_denied&error_description=expired&next=/reset-password"),
    );
    expect(locationOf(withError)).toBe("https://schoolledger.test/login?error=link_expired");

    const descriptionOnly = await GET(
      new Request("https://schoolledger.test/auth/callback?error_description=Email+link+is+invalid&next=/reset-password"),
    );
    expect(locationOf(descriptionOnly)).toBe("https://schoolledger.test/login?error=link_expired");

    const errorWithCode = await GET(
      new Request("https://schoolledger.test/auth/callback?error=access_denied&code=abc&token_hash=hashed&type=recovery"),
    );
    expect(locationOf(errorWithCode)).toBe("https://schoolledger.test/login?error=link_expired");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
