import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/app/admin/layout";
import { GET as getMe } from "@/app/api/admin/me/route";
import { DELETE as deleteSchool } from "@/app/api/admin/schools/[id]/route";
import { GET as getSchools, POST as postSchool } from "@/app/api/admin/schools/route";
import { isAllowlistedAdmin } from "@/lib/auth/admin-allowlist";
import { proxy } from "@/proxy";

const { authState } = vi.hoisted(() => ({
  authState: {
    claims: null as { email?: string; sub?: string } | null,
    user: null as { id: string; email: string } | null,
    isPlatformAdmin: false,
    profileError: null as string | null,
    serviceEnabled: false,
    demo: "",
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  usePathname: () => "/admin",
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "slgh_mode" && authState.demo ? { name, value: authState.demo } : undefined),
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: authState.claims } }),
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: authState.user }, error: null }),
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (!authState.serviceEnabled) return null;
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: authState.profileError ? null : { is_platform_admin: authState.isPlatformAdmin },
              error: authState.profileError ? { message: authState.profileError } : null,
            }),
          }),
        }),
      }),
    };
  },
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAILS",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_DEMO_MODE",
] as const;

const savedEnv = new Map<string, string | undefined>();

function locationPath(response: Response): string {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!, "http://localhost").pathname;
}

function signIn(email: string, id = "user-1") {
  authState.claims = { email, sub: id };
  authState.user = { id, email };
}

beforeEach(() => {
  authState.claims = null;
  authState.user = null;
  authState.isPlatformAdmin = false;
  authState.profileError = null;
  authState.serviceEnabled = false;
  authState.demo = "";
  for (const key of ENV_KEYS) {
    if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
});

describe("admin allow list", () => {
  it("matches emails without case or surrounding spaces", () => {
    expect(isAllowlistedAdmin("Admin@School.edu.gh", " other@school.edu.gh, admin@school.edu.gh ")).toBe(true);
    expect(isAllowlistedAdmin("school@example.com", "admin@school.edu.gh")).toBe(false);
    expect(isAllowlistedAdmin("", "admin@school.edu.gh")).toBe(false);
    expect(isAllowlistedAdmin("admin@school.edu.gh", undefined)).toBe(false);
  });
});

describe("admin page", () => {
  it("redirects a signed-in non-admin from /admin to /app", async () => {
    signIn("school@example.com");
    authState.serviceEnabled = true;
    const response = await proxy(new NextRequest("http://localhost/admin"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/app");
    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/app");
  });

  it("redirects a signed-in non-admin from nested admin pages, even with the demo cookie", async () => {
    signIn("school@example.com");
    authState.serviceEnabled = true;
    authState.demo = "admin";
    const response = await proxy(new NextRequest("http://localhost/admin/schools", { headers: { cookie: "slgh_mode=admin" } }));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/app");
    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/app");
  });

  it("allows an admin whose email is in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "Admin@School.edu.gh";
    signIn("admin@school.edu.gh", "admin-1");
    const response = await proxy(new NextRequest("http://localhost/admin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    await expect(AdminLayout({ children: "schools" })).resolves.toBeTruthy();
  });

  it("allows an admin with the platform admin role", async () => {
    signIn("owner@school.edu.gh", "admin-2");
    authState.serviceEnabled = true;
    authState.isPlatformAdmin = true;
    const response = await proxy(new NextRequest("http://localhost/admin/tickets"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    await expect(AdminLayout({ children: "tickets" })).resolves.toBeTruthy();
  });

  it("keeps the unsigned admin demo on /admin and sends other visitors to sign in", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    authState.demo = "admin";
    const demo = await proxy(new NextRequest("http://localhost/admin", { headers: { cookie: "slgh_mode=admin" } }));
    expect(demo.status).toBe(200);
    await expect(AdminLayout({ children: null })).resolves.toBeTruthy();

    authState.demo = "";
    const visitor = await proxy(new NextRequest("http://localhost/admin"));
    expect(visitor.status).toBe(307);
    expect(locationPath(visitor)).toBe("/login");
    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("admin API", () => {
  it("returns 403 when a signed-in non-admin calls an admin route", async () => {
    signIn("school@example.com");
    authState.serviceEnabled = true;

    const me = await getMe();
    expect(me.status).toBe(403);
    expect(await me.json()).toMatchObject({ admin: false });

    const list = await getSchools();
    expect(list.status).toBe(403);

    const created = await postSchool(new Request("http://localhost/api/admin/schools", { method: "POST", body: "{}" }));
    expect(created.status).toBe(403);

    const removed = await deleteSchool(new Request("http://localhost/api/admin/schools/school-1"), {
      params: Promise.resolve({ id: "school-1" }),
    });
    expect(removed.status).toBe(403);

    const proxied = await proxy(new NextRequest("http://localhost/api/admin/schools"));
    expect(proxied.status).toBe(403);
    expect(await proxied.json()).toMatchObject({ admin: false });
  });

  it("allows an allowlisted admin and an admin role through /api/admin/me", async () => {
    process.env.ADMIN_EMAILS = "admin@school.edu.gh";
    signIn("admin@school.edu.gh", "admin-1");
    const byEmail = await getMe();
    expect(byEmail.status).toBe(200);
    expect(await byEmail.json()).toMatchObject({ admin: true, email: "admin@school.edu.gh" });

    const emailProxy = await proxy(new NextRequest("http://localhost/api/admin/me"));
    expect(emailProxy.status).toBe(200);

    delete process.env.ADMIN_EMAILS;
    signIn("owner@school.edu.gh", "admin-2");
    authState.serviceEnabled = true;
    authState.isPlatformAdmin = true;
    const byRole = await getMe();
    expect(byRole.status).toBe(200);
    expect(await byRole.json()).toMatchObject({ admin: true, email: "owner@school.edu.gh" });

    const roleProxy = await proxy(new NextRequest("http://localhost/api/admin/me"));
    expect(roleProxy.status).toBe(200);
  });

  it("keeps a signed-out admin API call at 401 so the demo can tell it is unsigned", async () => {
    const me = await getMe();
    expect(me.status).toBe(401);
    const proxied = await proxy(new NextRequest("http://localhost/api/admin/me"));
    expect(proxied.status).toBe(401);
  });
});
