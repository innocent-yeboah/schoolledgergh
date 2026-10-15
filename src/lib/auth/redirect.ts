export function decideRedirect(input: {
  pathname: string;
  demo: string;
  signedIn: boolean;
  supabaseConfigured: boolean;
  admin?: boolean;
}): string | null {
  const { pathname, demo, signedIn, admin = false } = input;
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) return null;

  if (pathname === "/") {
    if (signedIn) return "/app";
    if (demo === "admin") return "/admin";
    if (demo === "school") return "/app";
    return "/login";
  }

  if (pathname.startsWith("/admin")) {
    if (demo === "school") return "/app";
    if (!signedIn && demo !== "admin") return "/login";
    if (signedIn && !admin) return "/app";
    return null;
  }

  if (pathname.startsWith("/app")) {
    if (demo === "admin" && !signedIn) return "/admin";
    if (!signedIn && demo !== "school") return "/login";
    return null;
  }

  return null;
}
