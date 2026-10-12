import type { DataCollection } from "@sentry/core";
import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Categories the SDK would otherwise attach automatically. All of them can
 * carry names, phone numbers, emails, or payment details, so they stay off.
 */
export const sentryPrivacy: { dataCollection: DataCollection } = {
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  },
};

export function readSentryDsn(source: Record<string, string | undefined> = process.env): string | undefined {
  const value = (source.NEXT_PUBLIC_SENTRY_DSN || source.SENTRY_DSN || "").trim();
  return value || undefined;
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    if (typeof event.request.url === "string") {
      const query = event.request.url.indexOf("?");
      if (query >= 0) event.request.url = event.request.url.slice(0, query);
    }
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.filter((crumb) => crumb.category !== "console");
  }
  if (event.extra) delete event.extra;
  return event;
}
