import * as Sentry from "@sentry/nextjs";
import { readSentryDsn, scrubSentryEvent, sentryPrivacy } from "@/lib/sentry/options";

Sentry.init({
  dsn: readSentryDsn(),
  ...sentryPrivacy,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
