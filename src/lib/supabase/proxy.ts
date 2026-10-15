import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePlatformAdmin } from "@/lib/auth/platform-role";
import { decideRedirect } from "@/lib/auth/redirect";
import { activeDemoCookie, demoModeEnabled } from "@/lib/mode";
import { publicSupabaseConfig } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const rawDemo = request.cookies.get("slgh_mode")?.value ?? "";
  const demo = activeDemoCookie(rawDemo);
  const clearDemo = Boolean(rawDemo) && !demoModeEnabled();
  const config = publicSupabaseConfig();

  if (!config) {
    const redirectTo = decideRedirect({ pathname, demo, signedIn: false, supabaseConfigured: false });
    if (redirectTo) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      return finish(NextResponse.redirect(url), clearDemo);
    }
    return finish(NextResponse.next({ request }), clearDemo);
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
  const claims = data?.claims;
  const signedIn = Boolean(claims);
  let admin = false;
  if (signedIn && claims && (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))) {
    const decision = await resolvePlatformAdmin({
      email: claims.email ?? "",
      userId: claims.sub,
    });
    admin = decision.admin;
  }

  if (pathname.startsWith("/api/admin")) {
    if (!signedIn) {
      return applySession(supabaseResponse, NextResponse.json({ admin: false, error: "Sign in required." }, { status: 401 }), clearDemo);
    }
    if (!admin) {
      return applySession(
        supabaseResponse,
        NextResponse.json({ admin: false, error: "This account is not a platform admin." }, { status: 403 }),
        clearDemo,
      );
    }
    return finish(supabaseResponse, clearDemo);
  }

  if (pathname.startsWith("/api")) return finish(supabaseResponse, clearDemo);

  const redirectTo = decideRedirect({ pathname, demo, signedIn, supabaseConfigured: true, admin });
  if (!redirectTo) return finish(supabaseResponse, clearDemo);

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  return applySession(supabaseResponse, NextResponse.redirect(url), clearDemo);
}

function finish(response: NextResponse, clearDemo: boolean) {
  if (clearDemo) response.cookies.set("slgh_mode", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}

function applySession(session: NextResponse, response: NextResponse, clearDemo: boolean) {
  session.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = session.headers.get(header);
    if (value) response.headers.set(header, value);
  }
  return finish(response, clearDemo);
}
