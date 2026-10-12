import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRedirect } from "@/lib/auth/redirect";
import { publicSupabaseConfig } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const demo = request.cookies.get("slgh_mode")?.value ?? "";
  const config = publicSupabaseConfig();

  if (!config) {
    const redirectTo = decideRedirect({ pathname, demo, signedIn: false, supabaseConfigured: false });
    if (redirectTo) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers ?? {}).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (pathname.startsWith("/api")) return supabaseResponse;

  const redirectTo = decideRedirect({ pathname, demo, signedIn, supabaseConfigured: true });
  if (!redirectTo) return supabaseResponse;

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  const redirected = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirected.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(header);
    if (value) redirected.headers.set(header, value);
  }
  return redirected;
}
