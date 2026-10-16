import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { createDemoSnapshot } from "@/lib/demo/store";
import { appModeFromCookie, demoModeCookie, writeAppMode } from "@/lib/mode";
import { proxy } from "@/proxy";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: null } }),
    },
  }),
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_APP_ENV",
  "APP_ENV",
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

function productionEnv() {
  process.env.APP_ENV = "production";
  process.env.NEXT_PUBLIC_APP_ENV = "production";
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
}

describe("production demo mode", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  it("shows the login page and never the demo school when the flag is unset", async () => {
    productionEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";
    const home = await proxy(new NextRequest("http://localhost/", { headers: { cookie: "slgh_mode=school" } }));
    expect(home.status).toBe(307);
    expect(locationPath(home)).toBe("/login");
    expect(await home.text()).not.toContain("Bright Future Academy");
    expect(home.headers.get("set-cookie") ?? "").toMatch(/slgh_mode=;/);

    const app = await proxy(new NextRequest("http://localhost/app", { headers: { cookie: "slgh_mode=school" } }));
    expect(app.status).toBe(307);
    expect(locationPath(app)).toBe("/login");
    expect(await app.text()).not.toContain("Bright Future Academy");

    const mode = appModeFromCookie("school");
    const schoolName = mode === "demo-school" ? createDemoSnapshot().school?.name : null;
    expect(mode).toBe("live");
    expect(schoolName).toBeNull();
    expect(createDemoSnapshot().school?.name).toBe("Bright Future Academy");

    const login = renderToStaticMarkup(createElement(LoginPage));
    expect(login).toContain("SchoolLedger GH");
    expect(login).not.toContain("Try the school demo");
    expect(login).not.toContain("Bright Future Academy");
  });

  it("still opens the sample school when demo mode is explicitly enabled", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    const response = await proxy(new NextRequest("http://localhost/", { headers: { cookie: "slgh_mode=school" } }));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/app");
    expect(appModeFromCookie("school")).toBe("demo-school");
  });

  it("clears a persisted demo cookie on sign out", () => {
    productionEnv();
    expect(demoModeCookie("school")).toBe("slgh_mode=; Path=/; Max-Age=0; SameSite=Lax");
    expect(demoModeCookie(null, true)).toBe("slgh_mode=; Path=/; Max-Age=0; SameSite=Lax");

    const writes: string[] = [];
    vi.stubGlobal("document", {
      cookie: "slgh_mode=school",
    });
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "slgh_mode=school",
      set: (value: string) => {
        writes.push(value);
      },
    });
    writeAppMode(null);
    expect(writes).toEqual(["slgh_mode=; Path=/; Max-Age=0; SameSite=Lax"]);
  });
});
