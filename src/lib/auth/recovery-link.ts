import type { EmailOtpType } from "@supabase/supabase-js";

export type AuthHash =
  | { kind: "tokens"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "error"; error: string; description: string | null }
  | { kind: "none" };

export type RecoverySearch = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
};

export type RecoveryResult = "ready" | "expired" | "missing";

type AuthErrorLike = { message: string } | null;

export type RecoverySessionClient = {
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ error: AuthErrorLike }>;
  exchangeCodeForSession: (code: string) => Promise<{ error: AuthErrorLike }>;
  verifyOtp: (params: { token_hash: string; type: EmailOtpType }) => Promise<{ error: AuthErrorLike }>;
};

/** Supabase implicit recovery links put the session in the fragment. */
export function parseAuthHash(hash: string): AuthHash {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { kind: "none" };
  const params = new URLSearchParams(raw);
  if (params.has("error") || params.has("error_description")) {
    return {
      kind: "error",
      error: params.get("error") ?? "",
      description: params.get("error_description"),
    };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken, type: params.get("type") };
  }
  return { kind: "none" };
}

export function parseRecoverySearch(search: string): RecoverySearch {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    code: params.get("code"),
    tokenHash: params.get("token_hash"),
    type: params.get("type"),
    error: params.has("error") ? (params.get("error") ?? "") : null,
    errorDescription: params.has("error_description") ? (params.get("error_description") ?? "") : null,
  };
}

export function emailOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return value;
}

/** Current path with the fragment removed. Implicit tokens must not stay in the address bar. */
export function urlWithoutAuthHash(href: string): string {
  const url = new URL(href);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

/** Drop the fragment and one-time recovery query params so a refresh does not replay them. */
export function urlWithoutRecoveryParams(href: string): string {
  const url = new URL(href);
  url.hash = "";
  for (const key of ["code", "token_hash", "type", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

/**
 * Turn an implicit hash, a PKCE code, or a token_hash into a session.
 * Returns "missing" when the URL carries none of those, so the caller can
 * still accept a session the callback already stored.
 */
export async function establishRecoverySession(input: {
  hash: string;
  search: string;
  auth: RecoverySessionClient;
  clearHash: () => void;
}): Promise<RecoveryResult> {
  const parsed = parseAuthHash(input.hash);
  if (parsed.kind === "error") return "expired";

  if (parsed.kind === "tokens") {
    try {
      const { error } = await input.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) return "expired";
      return "ready";
    } catch {
      return "expired";
    } finally {
      input.clearHash();
    }
  }

  const query = parseRecoverySearch(input.search);
  if (query.error !== null || query.errorDescription !== null) return "expired";

  if (query.code) {
    try {
      const { error } = await input.auth.exchangeCodeForSession(query.code);
      if (error) return "expired";
      return "ready";
    } catch {
      return "expired";
    }
  }

  if (query.tokenHash) {
    const type = emailOtpType(query.type);
    if (!type) return "expired";
    try {
      const { error } = await input.auth.verifyOtp({ token_hash: query.tokenHash, type });
      if (error) return "expired";
      return "ready";
    } catch {
      return "expired";
    }
  }

  return "missing";
}
