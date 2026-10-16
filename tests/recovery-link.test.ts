import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  establishRecoverySession,
  parseAuthHash,
  parseRecoverySearch,
  urlWithoutAuthHash,
  urlWithoutRecoveryParams,
  type RecoverySessionClient,
} from "@/lib/auth/recovery-link";

function authDouble(): RecoverySessionClient & {
  setSession: ReturnType<typeof vi.fn>;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
} {
  return {
    setSession: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("recovery hash", () => {
  it("reads the implicit recovery tokens", () => {
    expect(parseAuthHash("#access_token=aaa&refresh_token=bbb&expires_in=3600&token_type=bearer&type=recovery")).toEqual({
      kind: "tokens",
      accessToken: "aaa",
      refreshToken: "bbb",
      type: "recovery",
    });
    expect(parseAuthHash("access_token=aaa&refresh_token=bbb&type=recovery").kind).toBe("tokens");
  });

  it("treats an error fragment as a failed link", () => {
    expect(parseAuthHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toEqual({
      kind: "error",
      error: "access_denied",
      description: "Email link is invalid or has expired",
    });
    expect(parseAuthHash("#error_description=expired")).toMatchObject({ kind: "error", description: "expired" });
  });

  it("ignores a fragment that is not a session", () => {
    expect(parseAuthHash("")).toEqual({ kind: "none" });
    expect(parseAuthHash("#")).toEqual({ kind: "none" });
    expect(parseAuthHash("#type=recovery")).toEqual({ kind: "none" });
    expect(parseAuthHash("#access_token=only-one")).toEqual({ kind: "none" });
  });

  it("reads a code or token_hash that arrives in the query", () => {
    expect(parseRecoverySearch("?code=abc&next=/reset-password")).toMatchObject({ code: "abc", tokenHash: null, error: null });
    expect(parseRecoverySearch("?token_hash=hashed&type=recovery")).toEqual({
      code: null,
      tokenHash: "hashed",
      type: "recovery",
      error: null,
      errorDescription: null,
    });
    expect(parseRecoverySearch("?error=access_denied&error_description=expired").error).toBe("access_denied");
    expect(parseRecoverySearch("")).toEqual({
      code: null,
      tokenHash: null,
      type: null,
      error: null,
      errorDescription: null,
    });
  });

  it("drops the fragment and keeps the path", () => {
    expect(urlWithoutAuthHash("https://schoolledger.test/reset-password?next=/app#access_token=aaa&refresh_token=bbb")).toBe(
      "/reset-password?next=/app",
    );
    expect(
      urlWithoutRecoveryParams(
        "https://schoolledger.test/reset-password?code=abc&token_hash=hashed&type=recovery&error=access_denied&keep=1#access_token=aaa",
      ),
    ).toBe("/reset-password?keep=1");
  });
});

describe("establish recovery session", () => {
  let auth: ReturnType<typeof authDouble>;
  let hashClears = 0;

  beforeEach(() => {
    auth = authDouble();
    hashClears = 0;
  });

  function clearHash() {
    hashClears += 1;
  }

  it("sets the session from the hash, then clears it", async () => {
    const order: string[] = [];
    auth.setSession.mockImplementation(async () => {
      order.push("setSession");
      return { error: null };
    });

    const result = await establishRecoverySession({
      hash: "#access_token=aaa&refresh_token=bbb&type=recovery",
      search: "",
      auth,
      clearHash: () => {
        order.push("clearHash");
      },
    });

    expect(result).toBe("ready");
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "aaa", refresh_token: "bbb" });
    expect(order).toEqual(["setSession", "clearHash"]);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("clears the hash when setSession fails and reports the link expired", async () => {
    auth.setSession.mockResolvedValue({ error: { message: "invalid" } });
    const result = await establishRecoverySession({
      hash: "#access_token=aaa&refresh_token=bbb&type=recovery",
      search: "",
      auth,
      clearHash,
    });
    expect(result).toBe("expired");
    expect(hashClears).toBe(1);
  });

  it("does not set a session when the hash itself is an error", async () => {
    const result = await establishRecoverySession({
      hash: "#error=access_denied&error_description=expired",
      search: "",
      auth,
      clearHash,
    });
    expect(result).toBe("expired");
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(hashClears).toBe(0);
  });

  it("exchanges a code that arrives on the reset page", async () => {
    const result = await establishRecoverySession({
      hash: "",
      search: "?code=abc",
      auth,
      clearHash,
    });
    expect(result).toBe("ready");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("reports an expired link when the code exchange fails", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "code expired" } });
    const result = await establishRecoverySession({
      hash: "",
      search: "?code=used",
      auth,
      clearHash,
    });
    expect(result).toBe("expired");
  });

  it("verifies a token_hash that arrives on the reset page", async () => {
    const result = await establishRecoverySession({
      hash: "",
      search: "?token_hash=hashed&type=recovery",
      auth,
      clearHash,
    });
    expect(result).toBe("ready");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed", type: "recovery" });
  });

  it("reports an expired link when token_hash has no type or verification fails", async () => {
    const missingType = await establishRecoverySession({
      hash: "",
      search: "?token_hash=hashed",
      auth,
      clearHash,
    });
    expect(missingType).toBe("expired");
    expect(auth.verifyOtp).not.toHaveBeenCalled();

    auth.verifyOtp.mockResolvedValue({ error: { message: "otp expired" } });
    const failed = await establishRecoverySession({
      hash: "",
      search: "?token_hash=hashed&type=recovery",
      auth,
      clearHash,
    });
    expect(failed).toBe("expired");
  });

  it("leaves a bare visit for the session check", async () => {
    const result = await establishRecoverySession({ hash: "", search: "", auth, clearHash });
    expect(result).toBe("missing");
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
