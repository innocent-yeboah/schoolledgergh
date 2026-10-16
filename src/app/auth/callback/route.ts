import { NextResponse } from "next/server";
import { emailOtpType } from "@/lib/auth/recovery-link";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/app";

/** Relative in-app path. Rejects protocol-relative URLs and backslash tricks. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return DEFAULT_NEXT;
  return next;
}

function redirectTarget(origin: string, next: string | null): URL {
  const path = safeNextPath(next);
  try {
    const destination = new URL(path, origin);
    if (destination.origin !== new URL(origin).origin) return new URL(DEFAULT_NEXT, origin);
    return destination;
  } catch {
    return new URL(DEFAULT_NEXT, origin);
  }
}

function expiredLink(origin: string) {
  return NextResponse.redirect(new URL("/login?error=link_expired", origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("error") || url.searchParams.has("error_description")) {
    return expiredLink(url.origin);
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = emailOtpType(url.searchParams.get("type"));
  if (!code && tokenHash && !type) return expiredLink(url.origin);

  if (code || tokenHash) {
    try {
      const supabase = await createClient();
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return expiredLink(url.origin);
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) return expiredLink(url.origin);
      }
    } catch {
      return expiredLink(url.origin);
    }
  }

  // Implicit recovery emails keep access_token in the hash. The browser
  // carries that fragment across this same-origin redirect; the server never sees it.
  return NextResponse.redirect(redirectTarget(url.origin, url.searchParams.get("next")));
}
