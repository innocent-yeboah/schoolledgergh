import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminError from "@/app/admin/error";
import AdminLoading from "@/app/admin/loading";
import AppError from "@/app/app/error";
import AppLoading from "@/app/app/loading";
import RootError from "@/app/error";
import HomePage from "@/app/page";
import { config, proxy } from "@/proxy";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: null } }),
    },
  }),
}));

const SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const savedEnv = new Map<string, string | undefined>();

function locationPath(response: Response): string {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location!, "http://localhost").pathname;
}

describe("signed-out entry", () => {
  beforeEach(() => {
    for (const key of SUPABASE_ENV) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SUPABASE_ENV) {
      const value = savedEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("keeps the proxy matcher", () => {
    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ]);
  });

  it("redirects / to /login", async () => {
    expect(() => HomePage()).toThrow("NEXT_REDIRECT:/login");
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });

  it("redirects /app to /login when signed out", async () => {
    const response = await proxy(new NextRequest("http://localhost/app"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });

  it("redirects /app to /login when Supabase is configured and the visitor is signed out", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
    const response = await proxy(new NextRequest("http://localhost/app"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login");
  });
});

describe("visible route states", () => {
  it("renders loading and error copy for the school app, admin, and the root boundary", () => {
    expect(renderToStaticMarkup(createElement(AppLoading))).toContain("Loading your school");
    expect(renderToStaticMarkup(createElement(AdminLoading))).toContain("Loading admin");

    const schoolError = renderToStaticMarkup(
      createElement(AppError, { error: new Error("School failed"), reset: () => undefined }),
    );
    expect(schoolError).toContain("School failed");
    expect(schoolError).toContain("Try again");

    const adminError = renderToStaticMarkup(
      createElement(AdminError, { error: new Error("Admin failed"), reset: () => undefined }),
    );
    expect(adminError).toContain("Admin failed");
    expect(adminError).toContain("Try again");

    const rootError = renderToStaticMarkup(
      createElement(RootError, {
        error: Object.assign(new Error("Root failed"), { digest: "abc123" }),
        reset: () => undefined,
      }),
    );
    expect(rootError).toContain("Root failed");
    expect(rootError).toContain("abc123");
    expect(rootError).toContain("Back to sign in");
  });
});
