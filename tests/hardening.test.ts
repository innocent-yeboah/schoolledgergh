import { describe, expect, it } from "vitest";
import { readAppEnv } from "@/lib/env/app";
import { securityHeaders } from "@/lib/security/headers";
import { findingsIn } from "../scripts/check-client-secrets.mjs";

describe("app environment", () => {
  it("defaults to development and accepts staging or production", () => {
    expect(readAppEnv({})).toBe("development");
    expect(readAppEnv({ APP_ENV: "staging", NEXT_PUBLIC_APP_ENV: "staging" })).toBe("staging");
    expect(readAppEnv({ APP_ENV: "production" })).toBe("production");
  });

  it("rejects an unknown name and a mismatch between server and public env", () => {
    expect(() => readAppEnv({ APP_ENV: "prod" })).toThrow(/development, staging, or production/);
    expect(() => readAppEnv({ APP_ENV: "production", NEXT_PUBLIC_APP_ENV: "staging" })).toThrow(/must match/);
  });
});

describe("security headers", () => {
  it("blocks framing and plugins without embedding a secret", () => {
    const headers = securityHeaders({ production: true });
    const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://*.ingest.de.sentry.io");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("sk_live_");
    expect(headers.find((header) => header.key === "X-Frame-Options")?.value).toBe("DENY");
    expect(headers.find((header) => header.key === "X-Content-Type-Options")?.value).toBe("nosniff");
  });
});

describe("client secret scan", () => {
  it("flags secret values and public aliases, and ignores the Supabase prefix guard", () => {
    expect(findingsIn('e.startsWith("sb_secret_")')).toEqual([]);
    expect(findingsIn("https://example.ingest.de.sentry.io")).toEqual([]);
    expect(findingsIn("sk_live_abcdefghij")).toEqual(["sk_live_[A-Za-z0-9]{8,}"]);
    expect(findingsIn("sb_secret_abcdefgh")).toEqual(["sb_secret_[A-Za-z0-9_-]{8,}"]);
    expect(findingsIn("sk_test_abcdefghij", { source: true })).toContain("sk_test_");
    expect(findingsIn("sk_live_short", { source: true })).toContain("sk_live_");
    expect(findingsIn("process.env.PAYSTACK_SECRET_KEY", { source: true })).toContain("process.env.PAYSTACK_SECRET_KEY");
    expect(findingsIn("NEXT_PUBLIC_SMS_API_KEY")).toContain("NEXT_PUBLIC_SMS_API_KEY");
  });
});
