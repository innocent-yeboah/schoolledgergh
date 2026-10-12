import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { readSentryDsn, scrubSentryEvent, sentryPrivacy } from "@/lib/sentry/options";

describe("Sentry privacy", () => {
  it("reads the DSN from the public or server env and nowhere else", () => {
    expect(readSentryDsn({})).toBeUndefined();
    expect(readSentryDsn({ NEXT_PUBLIC_SENTRY_DSN: " https://public.example/1 " })).toBe("https://public.example/1");
    expect(readSentryDsn({ SENTRY_DSN: "https://server.example/2" })).toBe("https://server.example/2");
  });

  it("turns off automatic collection of personal data", () => {
    expect(sentryPrivacy.dataCollection.userInfo).toBe(false);
    expect(sentryPrivacy.dataCollection.cookies).toBe(false);
    expect(sentryPrivacy.dataCollection.httpHeaders).toBe(false);
    expect(sentryPrivacy.dataCollection.httpBodies).toEqual([]);
    expect(sentryPrivacy.dataCollection.urlQueryParams).toBe(false);
    expect(sentryPrivacy.dataCollection.stackFrameVariables).toBe(false);
  });

  it("strips user, request details, and console breadcrumbs before send", () => {
    const event = {
      user: { email: "parent@example.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://school.example/app/students?phone=0244001100",
        cookies: { session: "secret" },
        headers: { authorization: "Bearer secret" },
        data: { parent_name: "Akua" },
        query_string: "phone=0244001100",
      },
      breadcrumbs: [{ category: "console", message: "Akua 0244001100" }, { category: "navigation", message: "/app" }],
      extra: { note: "call Akua" },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request?.url).toBe("https://school.example/app/students");
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.breadcrumbs).toEqual([{ category: "navigation", message: "/app" }]);
    expect(scrubbed.extra).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain("Akua");
    expect(JSON.stringify(scrubbed)).not.toContain("0244001100");
  });
});