import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));
    } catch {
      return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));
    }
  }
  return NextResponse.redirect(redirectTarget(url.origin, url.searchParams.get("next")));
}
